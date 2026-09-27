// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTriageSubmission } from "../features/triage/state/useTriageSubmission";
import { triage, TriageClientError } from "../features/triage/api/triageClient";
import type { TriageResult } from "../lib/schema";

// State-machine tests only: triageClient itself is mocked (its own contract
// is covered by tests/triage-client.test.ts), and the real TriageClientError
// class is kept so `error` values in state are the genuine class.
vi.mock("../features/triage/api/triageClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/triage/api/triageClient")>();
  return { ...actual, triage: vi.fn() };
});

const triageMock = vi.mocked(triage);

function result(over: Partial<TriageResult> = {}): TriageResult {
  return {
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
    ...over,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  triageMock.mockReset();
});

describe("useTriageSubmission", () => {
  it("starts idle", () => {
    const { result: hook } = renderHook(() => useTriageSubmission());
    expect(hook.current.state).toEqual({ status: "idle" });
  });

  it("moves to submitting as soon as submit is called, before the request settles", () => {
    const pending = deferred<TriageResult>();
    triageMock.mockReturnValue(pending.promise);
    const { result: hook } = renderHook(() => useTriageSubmission());

    act(() => hook.current.submit("hello"));

    expect(hook.current.state).toEqual({ status: "submitting", previousResult: null });
    expect(triageMock).toHaveBeenCalledWith({ text: "hello", signal: expect.any(AbortSignal) });
  });

  it("moves to success once the request resolves", async () => {
    const value = result();
    triageMock.mockResolvedValue(value);
    const { result: hook } = renderHook(() => useTriageSubmission());

    await act(async () => hook.current.submit("hello"));

    expect(hook.current.state).toEqual({ status: "success", result: value });
  });

  it("moves to error, with no previous result, on a first failed submission", async () => {
    const error = new TriageClientError("The service is busy. Please try again shortly.", "RATE_LIMITED");
    triageMock.mockRejectedValue(error);
    const { result: hook } = renderHook(() => useTriageSubmission());

    await act(async () => hook.current.submit("hello"));

    expect(hook.current.state).toEqual({ status: "error", error, previousResult: null });
  });

  it("keeps the prior success result available while a resubmission is in flight", async () => {
    const first = result({ summary: "First" });
    triageMock.mockResolvedValueOnce(first);
    const { result: hook } = renderHook(() => useTriageSubmission());
    await act(async () => hook.current.submit("first"));

    const pending = deferred<TriageResult>();
    triageMock.mockReturnValueOnce(pending.promise);
    act(() => hook.current.submit("second"));

    expect(hook.current.state).toEqual({ status: "submitting", previousResult: first });
  });

  it("restores the prior success result in full if the resubmission fails", async () => {
    const first = result({ summary: "First" });
    triageMock.mockResolvedValueOnce(first);
    const { result: hook } = renderHook(() => useTriageSubmission());
    await act(async () => hook.current.submit("first"));

    const error = new TriageClientError("Something went wrong. Please try again.");
    triageMock.mockRejectedValueOnce(error);
    await act(async () => hook.current.submit("second"));

    expect(hook.current.state).toEqual({ status: "error", error, previousResult: first });
  });

  it("carries a previous result forward across a chain of failures", async () => {
    const first = result({ summary: "First" });
    triageMock.mockResolvedValueOnce(first);
    const { result: hook } = renderHook(() => useTriageSubmission());
    await act(async () => hook.current.submit("first"));

    triageMock.mockRejectedValueOnce(new TriageClientError("fail one"));
    await act(async () => hook.current.submit("second"));

    const pending = deferred<TriageResult>();
    triageMock.mockReturnValueOnce(pending.promise);
    act(() => hook.current.submit("third"));

    expect(hook.current.state).toEqual({ status: "submitting", previousResult: first });
  });

  it("ignores a superseded request's resolution once a newer submission has started", async () => {
    const first = deferred<TriageResult>();
    const second = deferred<TriageResult>();
    triageMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result: hook } = renderHook(() => useTriageSubmission());

    act(() => hook.current.submit("first"));
    const firstSignal = triageMock.mock.calls[0]?.[0].signal;
    act(() => hook.current.submit("second"));

    // Starting the second submission aborts the first's in-flight request.
    expect(firstSignal?.aborted).toBe(true);

    await act(async () => {
      first.resolve(result({ summary: "stale" }));
    });
    expect(hook.current.state.status).toBe("submitting"); // still waiting on the second

    const secondResult = result({ summary: "current" });
    await act(async () => {
      second.resolve(secondResult);
    });
    expect(hook.current.state).toEqual({ status: "success", result: secondResult });
  });

  it("does not surface a lone abort as an error", async () => {
    triageMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const { result: hook } = renderHook(() => useTriageSubmission());

    await act(async () => hook.current.submit("hello"));

    expect(hook.current.state.status).toBe("submitting");
  });

  it("aborts the in-flight request on unmount", () => {
    const pending = deferred<TriageResult>();
    triageMock.mockReturnValue(pending.promise);
    const { result: hook, unmount } = renderHook(() => useTriageSubmission());

    act(() => hook.current.submit("hello"));
    const signal = triageMock.mock.calls[0]?.[0].signal;
    unmount();

    expect(signal?.aborted).toBe(true);
  });
});

describe("useTriageSubmission — explicit acceptance invariants", () => {
  it("replaces the previous result outright when a resubmission also succeeds", async () => {
    const resultA = result({ summary: "Result A" });
    const resultB = result({ summary: "Result B" });
    triageMock.mockResolvedValueOnce(resultA).mockResolvedValueOnce(resultB);
    const { result: hook } = renderHook(() => useTriageSubmission());

    await act(async () => hook.current.submit("A"));
    expect(hook.current.state).toEqual({ status: "success", result: resultA });

    await act(async () => hook.current.submit("B"));

    expect(hook.current.state).toEqual({ status: "success", result: resultB });
  });

  it("clears a previous error the moment a new submission starts", async () => {
    const errorA = new TriageClientError("Error A");
    triageMock.mockRejectedValueOnce(errorA);
    const { result: hook } = renderHook(() => useTriageSubmission());

    await act(async () => hook.current.submit("A"));
    expect(hook.current.state).toEqual({ status: "error", error: errorA, previousResult: null });

    const pendingB = deferred<TriageResult>();
    triageMock.mockReturnValueOnce(pendingB.promise);
    act(() => hook.current.submit("B"));

    // Submitting state carries no `error` field at all, and the previous
    // result is still null since no submission has ever succeeded.
    expect(hook.current.state).toEqual({ status: "submitting", previousResult: null });
    expect("error" in hook.current.state).toBe(false);
  });

  it("keeps the latest error once it arrives, even if an older, superseded submission later resolves", async () => {
    const pendingA = deferred<TriageResult>();
    const pendingB = deferred<TriageResult>();
    triageMock.mockReturnValueOnce(pendingA.promise).mockReturnValueOnce(pendingB.promise);
    const { result: hook } = renderHook(() => useTriageSubmission());

    act(() => hook.current.submit("A"));
    act(() => hook.current.submit("B"));

    const errorB = new TriageClientError("Error B");
    await act(async () => pendingB.reject(errorB));
    expect(hook.current.state).toEqual({ status: "error", error: errorB, previousResult: null });

    // A was superseded when B started; A resolving afterwards must not
    // overwrite B's error.
    await act(async () => pendingA.resolve(result({ summary: "stale A" })));
    expect(hook.current.state).toEqual({ status: "error", error: errorB, previousResult: null });
  });

  it("never retries automatically after a failure", async () => {
    const error = new TriageClientError("Something went wrong. Please try again.");
    triageMock.mockRejectedValue(error);
    const { result: hook } = renderHook(() => useTriageSubmission());

    await act(async () => hook.current.submit("hello"));

    expect(hook.current.state).toEqual({ status: "error", error, previousResult: null });
    expect(triageMock).toHaveBeenCalledTimes(1);

    // Flushing further microtasks must not trigger any additional call.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(triageMock).toHaveBeenCalledTimes(1);
  });
});
