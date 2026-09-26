import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import type { Config } from "./config";
import { TriageError } from "./errors";
import { ModelAnalysisSchema } from "./schema";

export type LlmCall = (input: {
  system: string;
  user: string;
  signal: AbortSignal;
}) => Promise<string>;

const RESPONSE_JSON_SCHEMA = z.toJSONSchema(ModelAnalysisSchema, { target: "draft-7" });

function statusOf(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

/**
 * Convert any provider failure into a TriageError with a fixed, safe message.
 * The original error (which can contain quota details or request context) is
 * deliberately discarded.
 */
export function mapProviderError(error: unknown, signal?: AbortSignal): TriageError {
  if (error instanceof TriageError) return error;

  const aborted = signal?.aborted === true || (error instanceof Error && error.name === "AbortError");
  if (aborted) {
    return new TriageError("PROVIDER_TIMEOUT", "The AI provider took too long to respond.");
  }

  const status = statusOf(error);
  if (status === 429) {
    return new TriageError("RATE_LIMITED", "The AI provider is rate limiting requests. Please try again shortly.");
  }
  if (status === 401 || status === 403 || status === 404) {
    return new TriageError("CONFIGURATION_ERROR", "The AI provider rejected the configured credentials or model.", {
      retryable: false,
    });
  }
  if (status !== undefined && status >= 400 && status < 500) {
    return new TriageError("PROVIDER_ERROR", "The AI provider rejected the request.", { retryable: false });
  }
  // 5xx, or no status at all (network failure).
  return new TriageError("PROVIDER_ERROR", "The AI provider is temporarily unavailable.", { retryable: true });
}

/**
 * The only place that talks to Gemini. Returns the raw model text, which is
 * untrusted; parsing and validation happen in analyze.ts.
 */
export async function callGemini(
  input: { system: string; user: string; signal: AbortSignal },
  config: Config,
): Promise<string> {
  if (!config.apiKey) {
    throw new TriageError("CONFIGURATION_ERROR", "GEMINI_API_KEY is not set.");
  }

  let response;
  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    response = await ai.models.generateContent({
      model: config.model,
      contents: input.user,
      config: {
        systemInstruction: input.system,
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_JSON_SCHEMA,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: config.maxOutputTokens,
        abortSignal: input.signal,
      },
    });
  } catch (error) {
    throw mapProviderError(error, input.signal);
  }

  const finishReason = response.candidates?.[0]?.finishReason;
  const text = response.text;
  if ((finishReason !== undefined && finishReason !== "STOP") || !text) {
    throw new TriageError("MODEL_OUTPUT_INVALID", "The AI provider returned an incomplete response.");
  }
  return text;
}
