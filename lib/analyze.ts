import { TriageError } from "./errors";
import type { LlmCall } from "./llm";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import { ModelAnalysisSchema, type Evidence, type ModelAnalysis, type VerifiedEvidence } from "./schema";

const CURLY_SINGLE = /[‘’‚‛′]/g;
const CURLY_DOUBLE = /[“”„‟″]/g;
const EDGE_PUNCTUATION = /^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu;

/**
 * Normalisation for comparing a quote with the request: casefold, straight
 * quotes, collapsed whitespace, no surrounding punctuation. Nothing fuzzy.
 */
export function normalizeForMatch(text: string): string {
  return text
    .replace(CURLY_SINGLE, "'")
    .replace(CURLY_DOUBLE, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(EDGE_PUNCTUATION, "");
}

/**
 * Model evidence is untrusted. Keep an item only if its normalised quote is
 * a verbatim substring of the normalised request. Unverifiable items are
 * dropped, never repaired. Kept items retain the model's original quote text.
 * The flags and reasoning they supported are unaffected by a drop.
 */
export function verifyEvidence(requestText: string, evidence: readonly Evidence[]): VerifiedEvidence[] {
  const haystack = normalizeForMatch(requestText);
  const verified: VerifiedEvidence[] = [];
  for (const item of evidence) {
    const needle = normalizeForMatch(item.quote);
    if (needle.length > 0 && haystack.includes(needle)) {
      verified.push({ for: item.for, quote: item.quote });
    }
  }
  return verified;
}

const MAX_ATTEMPTS = 2;

const INVALID_OUTPUT = "The AI provider returned a response that could not be used.";

/**
 * Raw model text -> validated (still untrusted) ModelAnalysis. No repair, no
 * coercion: anything that is not exactly the schema is rejected. The message
 * never includes model output.
 */
export function parseModelOutput(raw: string): ModelAnalysis {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new TriageError("MODEL_OUTPUT_INVALID", INVALID_OUTPUT);
  }
  const parsed = ModelAnalysisSchema.safeParse(json);
  if (!parsed.success) throw new TriageError("MODEL_OUTPUT_INVALID", INVALID_OUTPUT);
  return parsed.data;
}

/** Per-attempt timeout. Races the call so a provider that ignores the signal still times out. */
function callWithTimeout(call: LlmCall, system: string, user: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TriageError("PROVIDER_TIMEOUT", "The AI provider took too long to respond."));
    }, timeoutMs);
  });
  const attempt = Promise.resolve().then(() => call({ system, user, signal: controller.signal }));
  return Promise.race([attempt, timeout]).finally(() => clearTimeout(timer));
}

// Retry parse/schema failures at once, and transient provider failures after a short delay.
// Never retry 429, 4xx, configuration errors or timeouts.
function shouldRetry(error: TriageError): boolean {
  return error.code === "MODEL_OUTPUT_INVALID" || (error.code === "PROVIDER_ERROR" && error.retryable);
}

export type AnalyzeOptions = { timeoutMs: number; retryDelayMs?: number };

/**
 * One provider call -> parse -> validate -> verify evidence, with at most one
 * retry. The returned analysis is still an untrusted proposal; only
 * applyPolicy() produces the trusted result.
 *
 * Evidence that cannot be verified is dropped, not treated as a failure, so
 * there is no evidence-specific retry.
 */
export async function analyze(
  requestText: string,
  call: LlmCall,
  options: AnalyzeOptions,
): Promise<{ analysis: ModelAnalysis; evidence: VerifiedEvidence[] }> {
  const user = buildUserPrompt(requestText);

  for (let attempt = 1; ; attempt++) {
    try {
      const raw = await callWithTimeout(call, SYSTEM_PROMPT, user, options.timeoutMs);
      const analysis = parseModelOutput(raw);
      return { analysis, evidence: verifyEvidence(requestText, analysis.evidence) };
    } catch (error) {
      const failure =
        error instanceof TriageError ? error : new TriageError("INTERNAL", "Unexpected error while triaging the request.");
      if (attempt >= MAX_ATTEMPTS || !shouldRetry(failure)) throw failure;
      if (failure.code === "PROVIDER_ERROR") {
        await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs ?? 500));
      }
    }
  }
}
