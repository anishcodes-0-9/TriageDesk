import { afterEach, describe, expect, it, vi } from "vitest";
import { triage, TriageClientError } from "../features/triage/api/triageClient";
import type { TriageResult } from "../lib/schema";

// API client tests only: mock global fetch, never call the real route or Gemini.

const VALID_RESULT: TriageResult = {
  summary: "A customer reports a billing discrepancy.",
  category: "Billing",
  priority: "Medium",
  priorityReason: "No urgent impact stated.",
  owner: "Finance",
  needsReview: false,
  reviewReason: null,
  evidence: [],
  draftResponse: "Thanks for reaching out. [Your name]",
  adjustments: [],
  escalation: null,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("triage", () => {
  it("posts the request text to /api/triage and resolves with the validated result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, VALID_RESULT));
    vi.stubGlobal("fetch", fetchMock);

    const result = await triage({ text: "My invoice looks wrong." });

    expect(result).toEqual(VALID_RESULT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/triage",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: "My invoice looks wrong." }),
      }),
    );
  });

  it("forwards an AbortSignal to fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, VALID_RESULT));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await triage({ text: "hello", signal: controller.signal });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
  });

  it("rejects with a TriageClientError carrying the backend's code and message on a 4xx/5xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: { code: "INPUT_TOO_LONG", message: "Request text is too long." } })),
    );

    await expect(triage({ text: "x".repeat(5000) })).rejects.toMatchObject({
      name: "TriageClientError",
      message: "Request text is too long.",
      code: "INPUT_TOO_LONG",
    });
  });

  it("rejects with a generic, code-less error when the error body does not match the expected envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(502, { unexpected: true })));

    const error = await triage({ text: "hello" }).catch((e) => e);
    expect(error).toBeInstanceOf(TriageClientError);
    expect((error as TriageClientError).code).toBeUndefined();
  });

  it("rejects with a generic error when the response body is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not json", { status: 200 })),
    );

    const error = await triage({ text: "hello" }).catch((e) => e);
    expect(error).toBeInstanceOf(TriageClientError);
    expect((error as TriageClientError).code).toBeUndefined();
  });

  it("rejects with a generic error when a 200 response fails schema validation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { not: "a triage result" })));

    const error = await triage({ text: "hello" }).catch((e) => e);
    expect(error).toBeInstanceOf(TriageClientError);
    expect((error as TriageClientError).code).toBeUndefined();
  });

  it("rejects with a generic error on a network/transport failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await triage({ text: "hello" }).catch((e) => e);
    expect(error).toBeInstanceOf(TriageClientError);
    expect((error as TriageClientError).code).toBeUndefined();
  });

  it("propagates an abort as its own AbortError rather than wrapping it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")));

    const error = await triage({ text: "hello" }).catch((e) => e);
    expect(error).not.toBeInstanceOf(TriageClientError);
    expect((error as DOMException).name).toBe("AbortError");
  });

  it("propagates an abort that fires while the response body is still being read", async () => {
    const response = new Response(null, { status: 200 });
    vi.spyOn(response, "json").mockRejectedValue(new DOMException("Aborted", "AbortError"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const error = await triage({ text: "hello" }).catch((e) => e);
    expect(error).not.toBeInstanceOf(TriageClientError);
    expect((error as DOMException).name).toBe("AbortError");
  });
});
