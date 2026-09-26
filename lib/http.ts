import { TriageError, type ErrorCode } from "./errors";
import type { TriageResult } from "./schema";
import { triage } from "./triage";

export const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  INPUT_TOO_LONG: 400,
  RATE_LIMITED: 429,
  CONFIGURATION_ERROR: 500,
  PROVIDER_ERROR: 502,
  MODEL_OUTPUT_INVALID: 502,
  PROVIDER_TIMEOUT: 504,
  INTERNAL: 500,
};

// Fixed public messages. Only input errors echo the (user-safe) TriageError message.
const PUBLIC_MESSAGE: Record<ErrorCode, string> = {
  INVALID_INPUT: "Request text is required.",
  INPUT_TOO_LONG: "Request text is too long.",
  RATE_LIMITED: "The service is busy. Please try again shortly.",
  CONFIGURATION_ERROR: "The service is not configured correctly.",
  PROVIDER_ERROR: "The analysis service failed. Please try again.",
  MODEL_OUTPUT_INVALID: "The analysis could not be completed. Please try again.",
  PROVIDER_TIMEOUT: "The analysis timed out. Please try again.",
  INTERNAL: "Something went wrong.",
};

export type TriageFn = (input: unknown) => Promise<TriageResult>;

function errorResponse(code: ErrorCode, message: string, retryable: boolean, startedAt: number): Response {
  const status = STATUS_BY_CODE[code];
  // Safe metadata only: never the request, result text, prompts or provider payloads.
  console.error(
    JSON.stringify({ op: "triage", code, status, retryable, durationMs: Date.now() - startedAt }),
  );
  return Response.json({ error: { code, message } }, { status });
}

/** Thin HTTP adapter around triage(). Validation of the text itself stays in triage(). */
export async function handleTriageRequest(req: Request, run: TriageFn = (input) => triage(input)): Promise<Response> {
  const startedAt = Date.now();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("INVALID_INPUT", "Request body must be valid JSON.", false, startedAt);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return errorResponse("INVALID_INPUT", "Request body must be a JSON object.", false, startedAt);
  }

  try {
    const result = await run((body as Record<string, unknown>).request);
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof TriageError) {
      const message =
        err.code === "INVALID_INPUT" || err.code === "INPUT_TOO_LONG" ? err.message : PUBLIC_MESSAGE[err.code];
      return errorResponse(err.code, message, err.retryable, startedAt);
    }
    return errorResponse("INTERNAL", PUBLIC_MESSAGE.INTERNAL, false, startedAt);
  }
}
