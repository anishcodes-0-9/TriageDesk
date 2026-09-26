import { analyze } from "./analyze";
import { getConfig, type Config } from "./config";
import { TriageError } from "./errors";
import { callGemini, type LlmCall } from "./llm";
import { applyPolicy } from "./policy";
import type { TriageResult } from "./schema";

export type TriageOptions = {
  /** Test seam: replaces the Gemini call. */
  call?: LlmCall;
  /** Test seam: replaces environment config. */
  config?: Config;
  retryDelayMs?: number;
};

/**
 * raw request -> LLM -> Zod validation -> evidence verification -> policy -> TriageResult.
 * LLM proposes, policy enforces. Input is validated before any provider call.
 */
export async function triage(input: unknown, options: TriageOptions = {}): Promise<TriageResult> {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new TriageError("INVALID_INPUT", "Request text is required.");
  }
  const requestText = input.trim();

  const config = options.config ?? getConfig();
  if (requestText.length > config.maxInputChars) {
    throw new TriageError("INPUT_TOO_LONG", `Request text must be at most ${config.maxInputChars} characters.`);
  }

  let call = options.call;
  if (!call) {
    if (config.mode !== "live") {
      throw new TriageError("CONFIGURATION_ERROR", "Recorded mode is not available yet.");
    }
    call = (llmInput) => callGemini(llmInput, config);
  }

  const { analysis, evidence } = await analyze(requestText, call, {
    timeoutMs: config.timeoutMs,
    retryDelayMs: options.retryDelayMs,
  });
  return applyPolicy(analysis, evidence);
}
