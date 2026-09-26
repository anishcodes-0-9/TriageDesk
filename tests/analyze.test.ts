import { describe, expect, it, vi } from "vitest";
import { analyze, normalizeForMatch, parseModelOutput, verifyEvidence } from "../lib/analyze";
import { TriageError } from "../lib/errors";
import { buildUserPrompt, SYSTEM_PROMPT } from "../lib/prompt";
import type { Evidence } from "../lib/schema";
import { modelAnalysis, REQUEST } from "./fixtures";

const request =
  "The client portal has been unavailable since this morning and our staff cannot access active customer records. Please help as soon as possible.";

const ev = (quote: string, target: Evidence["for"] = "priority"): Evidence => ({ for: target, quote });
const quotes = (list: readonly { quote: string }[]) => list.map((e) => e.quote);

describe("verifyEvidence: verification", () => {
  it("keeps a verbatim quote", () => {
    const item = ev("portal has been unavailable", "criticalOutage");
    expect(verifyEvidence(request, [item])).toEqual([item]);
  });

  it("keeps the model's original quote text, not the normalised form", () => {
    const [kept] = verifyEvidence(request, [ev("  As Soon As Possible. ")]);
    expect(kept?.quote).toBe("  As Soon As Possible. ");
  });

  it("drops a quote that is not in the request", () => {
    expect(verifyEvidence(request, [ev("the database was deleted")])).toEqual([]);
  });

  it("drops paraphrases, reordered words and near-misses (no fuzzy matching)", () => {
    const items = [
      ev("portal was unavailable"),
      ev("unavailable portal has been the"),
      ev("staff can not access"),
      ev("portal has been unavailable since this evening"),
    ];
    expect(verifyEvidence(request, items)).toEqual([]);
  });

  it("drops a quote that only matches with ellipsis or extra words", () => {
    expect(verifyEvidence(request, [ev("portal ... unavailable")])).toEqual([]);
  });

  it("drops a quote that normalises to nothing", () => {
    expect(verifyEvidence(request, [ev("...")])).toEqual([]);
    expect(verifyEvidence(request, [ev("   ")])).toEqual([]);
  });

  it("handles multiple items, keeping only the verifiable ones in order", () => {
    const items = [
      ev("cannot access active customer records", "criticalOutage"),
      ev("this was invented"),
      ev("as soon as possible"),
    ];
    expect(quotes(verifyEvidence(request, items))).toEqual([
      "cannot access active customer records",
      "as soon as possible",
    ]);
  });

  it("returns an empty list for empty evidence", () => {
    expect(verifyEvidence(request, [])).toEqual([]);
  });

  it("preserves each of the three allowed 'for' values", () => {
    const text = "Customer emails were sent to the wrong workspace and the portal is down. Fix it today.";
    const items = [
      ev("wrong workspace", "dataExposure"),
      ev("the portal is down", "criticalOutage"),
      ev("fix it today", "priority"),
    ];
    expect(verifyEvidence(text, items).map((e) => e.for)).toEqual(["dataExposure", "criticalOutage", "priority"]);
  });

  it("does not mutate its inputs", () => {
    const items = [ev("As Soon As Possible."), ev("invented")];
    const before = structuredClone(items);
    verifyEvidence(request, items);
    expect(items).toEqual(before);
  });
});

describe("verifyEvidence: normalisation", () => {
  it("is case-insensitive in both directions", () => {
    expect(verifyEvidence(request, [ev("PORTAL HAS BEEN UNAVAILABLE")])).toHaveLength(1);
    expect(verifyEvidence("URGENT: PLEASE HELP", [ev("please help")])).toHaveLength(1);
  });

  it("normalises whitespace, including newlines and tabs, on either side", () => {
    expect(verifyEvidence(request, [ev("portal   has\tbeen\nunavailable")])).toHaveLength(1);
    expect(verifyEvidence("Please\n\n  help   us\tnow", [ev("please help us now")])).toHaveLength(1);
  });

  it("matches curly quotes in the request against straight quotes in the quote", () => {
    const text = "We can’t log in and the “billing” page won’t load.";
    expect(verifyEvidence(text, [ev("we can't log in")])).toHaveLength(1);
    expect(verifyEvidence(text, [ev('the "billing" page')])).toHaveLength(1);
  });

  it("matches straight quotes in the request against curly quotes in the quote", () => {
    const text = `We can't log in and the "billing" page won't load.`;
    expect(verifyEvidence(text, [ev("we can’t log in")])).toHaveLength(1);
    expect(verifyEvidence(text, [ev("the “billing” page")])).toHaveLength(1);
  });

  it("trims surrounding punctuation and quote marks from the quote", () => {
    for (const q of ["unavailable.", "...unavailable", "“unavailable”", "(unavailable)", "  , unavailable ! "]) {
      expect(verifyEvidence(request, [ev(q)]), q).toHaveLength(1);
    }
  });

  it("trims trailing punctuation that the request has but the quote lacks", () => {
    expect(verifyEvidence(request, [ev("as soon as possible")])).toHaveLength(1);
    expect(verifyEvidence("Help now!!!", [ev("help now")])).toHaveLength(1);
  });

  it("does not remove punctuation inside a quote", () => {
    expect(verifyEvidence("Invoice NS-1048 is wrong", [ev("invoice ns-1048")])).toHaveLength(1);
    expect(verifyEvidence("Invoice NS-1048 is wrong", [ev("invoice ns 1048")])).toEqual([]);
  });
});

describe("normalizeForMatch", () => {
  it("applies casefold, quote, whitespace and edge-punctuation rules", () => {
    expect(normalizeForMatch("  “Don’t   PANIC!” ")).toBe("don't panic");
  });
});

describe("parseModelOutput", () => {
  const valid = JSON.stringify(modelAnalysis);

  it("parses and validates raw JSON", () => {
    expect(parseModelOutput(valid)).toEqual(modelAnalysis);
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["empty output", ""],
    ["JSON wrapped in prose or fences", "```json\n" + valid + "\n```"],
    ["a non-object", "[1,2]"],
    ["invalid category", JSON.stringify({ ...modelAnalysis, category: "Security" })],
    ["a missing field", JSON.stringify({ ...modelAnalysis, summary: undefined })],
    ["an extra key", JSON.stringify({ ...modelAnalysis, owner: "Finance" })],
    ["a string boolean (no coercion)", JSON.stringify({ ...modelAnalysis, needsReview: "false" })],
  ])("rejects %s with MODEL_OUTPUT_INVALID and no output in the message", (_name, raw) => {
    try {
      parseModelOutput(raw);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(TriageError);
      expect((e as TriageError).code).toBe("MODEL_OUTPUT_INVALID");
      expect((e as TriageError).message).not.toContain("Security");
    }
  });
});

describe("analyze", () => {
  const ok = JSON.stringify(modelAnalysis);
  const opts = { timeoutMs: 200, retryDelayMs: 1 };
  const providerError = (retryable = true) => new TriageError("PROVIDER_ERROR", "down", { retryable });

  it("returns the validated analysis and verified evidence on success", async () => {
    const call = vi.fn().mockResolvedValue(ok);
    const out = await analyze(REQUEST, call, opts);
    expect(out.analysis).toEqual(modelAnalysis);
    expect(out.evidence).toEqual([{ for: "priority", quote: "as soon as possible" }]);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("sends the system prompt and the delimited request, with an abort signal", async () => {
    const call = vi.fn().mockResolvedValue(ok);
    await analyze(REQUEST, call, opts);
    const arg = call.mock.calls[0]![0];
    expect(arg.system).toBe(SYSTEM_PROMPT);
    expect(arg.user).toBe(buildUserPrompt(REQUEST));
    expect(arg.signal).toBeInstanceOf(AbortSignal);
  });

  it("drops unverifiable evidence without failing or retrying", async () => {
    const raw = JSON.stringify({ ...modelAnalysis, evidence: [{ for: "priority", quote: "invented quote" }] });
    const call = vi.fn().mockResolvedValue(raw);
    const out = await analyze(REQUEST, call, opts);
    expect(out.evidence).toEqual([]);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("retries malformed JSON once and succeeds", async () => {
    const call = vi.fn().mockResolvedValueOnce("{oops").mockResolvedValueOnce(ok);
    expect((await analyze(REQUEST, call, opts)).analysis).toEqual(modelAnalysis);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("retries schema-invalid output once, then fails with MODEL_OUTPUT_INVALID", async () => {
    const call = vi.fn().mockResolvedValue(JSON.stringify({ ...modelAnalysis, priority: "Critical" }));
    await expect(analyze(REQUEST, call, opts)).rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("retries a retryable provider error once (5xx / network) and succeeds", async () => {
    const call = vi.fn().mockRejectedValueOnce(providerError()).mockResolvedValueOnce(ok);
    await analyze(REQUEST, call, opts);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("waits the retry delay before retrying a provider error", async () => {
    const call = vi.fn().mockRejectedValueOnce(providerError()).mockResolvedValueOnce(ok);
    const start = Date.now();
    await analyze(REQUEST, call, { timeoutMs: 200, retryDelayMs: 60 });
    expect(Date.now() - start).toBeGreaterThanOrEqual(55);
  });

  it("makes at most two attempts even if every attempt fails", async () => {
    const call = vi.fn().mockRejectedValue(providerError());
    await expect(analyze(REQUEST, call, opts)).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["429", new TriageError("RATE_LIMITED", "slow down")],
    ["non-retryable provider error (400)", providerError(false)],
    ["configuration error (401/403)", new TriageError("CONFIGURATION_ERROR", "bad key")],
  ])("does not retry %s", async (_name, error) => {
    const call = vi.fn().mockRejectedValue(error);
    await expect(analyze(REQUEST, call, opts)).rejects.toBe(error);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("times out per attempt, aborts the signal, and does not retry", async () => {
    let signal: AbortSignal | undefined;
    const call = vi.fn((input: { signal: AbortSignal }) => {
      signal = input.signal;
      return new Promise<string>(() => {}); // never settles, ignores the signal
    });
    await expect(analyze(REQUEST, call, { timeoutMs: 30, retryDelayMs: 1 })).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
    });
    expect(call).toHaveBeenCalledTimes(1);
    expect(signal?.aborted).toBe(true);
  });

  it("wraps unexpected non-TriageErrors as INTERNAL without leaking their message, and does not retry", async () => {
    const call = vi.fn().mockRejectedValue(new Error("secret internals sk-123"));
    const err = await analyze(REQUEST, call, opts).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "INTERNAL" });
    expect((err as Error).message).not.toContain("sk-123");
    expect(call).toHaveBeenCalledTimes(1);
  });
});
