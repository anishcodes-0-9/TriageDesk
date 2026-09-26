export const ERROR_CODES = [
  "INVALID_INPUT",
  "INPUT_TOO_LONG",
  "RATE_LIMITED",
  "PROVIDER_ERROR",
  "MODEL_OUTPUT_INVALID",
  "PROVIDER_TIMEOUT",
  "CONFIGURATION_ERROR",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const RETRYABLE_BY_DEFAULT: Record<ErrorCode, boolean> = {
  INVALID_INPUT: false,
  INPUT_TOO_LONG: false,
  RATE_LIMITED: true,
  PROVIDER_ERROR: true,
  MODEL_OUTPUT_INVALID: true,
  PROVIDER_TIMEOUT: true,
  CONFIGURATION_ERROR: false,
  INTERNAL: false,
};

/**
 * The message is user-safe. Never put provider payloads, headers or keys in it.
 * No `cause` is stored, so raw provider errors cannot leak through serialisation.
 */
export class TriageError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(code: ErrorCode, message: string, options?: { retryable?: boolean }) {
    super(message);
    this.name = "TriageError";
    this.code = code;
    this.retryable = options?.retryable ?? RETRYABLE_BY_DEFAULT[code];
  }
}
