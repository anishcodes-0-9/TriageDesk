import type { ErrorCode } from "@/lib/errors";
import { TriageResultSchema, type TriageResult } from "@/lib/schema";

/**
 * The only frontend module allowed to call POST /api/triage. No component
 * knows this URL or calls fetch directly.
 *
 * The success path is runtime-validated with the backend's own
 * TriageResultSchema (not a second, hand-rolled frontend schema) — trusting
 * same-origin JSON typing alone is not enough, since a type-only import
 * disappears at runtime and cannot catch an actual shape mismatch.
 */
const ENDPOINT = "/api/triage";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/**
 * A normalized client-side failure. `code` is only present when the backend
 * returned a recognizable error envelope; it exists solely so a caller can
 * frame its message (e.g. "edit and resubmit" vs "just try again") — never
 * to reimplement the backend's own retry/backoff behavior.
 */
export class TriageClientError extends Error {
  readonly code?: ErrorCode;

  constructor(message: string, code?: ErrorCode) {
    super(message);
    this.name = "TriageClientError";
    this.code = code;
  }
}

export type TriageRequest = {
  text: string;
  signal?: AbortSignal;
};

function isAbortError(err: unknown): err is DOMException {
  return err instanceof DOMException && err.name === "AbortError";
}

function readErrorEnvelope(body: unknown): { code?: ErrorCode; message: string } | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const error = (body as { error: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof message !== "string") return null;
  return { message, code: typeof code === "string" ? (code as ErrorCode) : undefined };
}

/**
 * Calls POST /api/triage with the given request text. Resolves with a
 * schema-validated TriageResult, or rejects with a TriageClientError. An
 * abort via `signal` is not wrapped — it propagates as its own AbortError so
 * a caller can tell "cancelled" apart from "failed".
 */
export async function triage({ text, signal }: TriageRequest): Promise<TriageResult> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request: text }),
      signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new TriageClientError(GENERIC_ERROR_MESSAGE);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    // A signal can also abort while the response body is still being read
    // (fetch() having already resolved), not only during the initial call.
    if (isAbortError(err)) throw err;
    throw new TriageClientError(GENERIC_ERROR_MESSAGE);
  }

  if (!response.ok) {
    const envelope = readErrorEnvelope(body);
    throw envelope
      ? new TriageClientError(envelope.message, envelope.code)
      : new TriageClientError(GENERIC_ERROR_MESSAGE);
  }

  const parsed = TriageResultSchema.safeParse(body);
  if (!parsed.success) throw new TriageClientError(GENERIC_ERROR_MESSAGE);
  return parsed.data;
}
