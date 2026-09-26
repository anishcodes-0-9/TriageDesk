import { TriageError } from "./errors";

export type LlmMode = "live" | "recorded";

export type Config = {
  apiKey: string | undefined;
  model: string;
  mode: LlmMode;
  timeoutMs: number;
  maxInputChars: number;
  maxOutputTokens: number;
};

const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/**
 * Read and validate config on demand, never at import time, so tests and
 * `next build` work without a Gemini key. The key is only required in live
 * mode, and its value is never included in an error message.
 */
export function getConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rawMode = env.LLM_MODE?.trim() || "live";
  if (rawMode !== "live" && rawMode !== "recorded") {
    throw new TriageError("CONFIGURATION_ERROR", "LLM_MODE must be 'live' or 'recorded'.");
  }

  const apiKey = env.GEMINI_API_KEY?.trim() || undefined;
  if (rawMode === "live" && !apiKey) {
    throw new TriageError("CONFIGURATION_ERROR", "GEMINI_API_KEY is not set.");
  }

  return {
    apiKey,
    model: env.LLM_MODEL?.trim() || DEFAULT_MODEL,
    mode: rawMode,
    timeoutMs: 12_000,
    maxInputChars: 4000,
    maxOutputTokens: 2048,
  };
}
