import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/policy")>();
  return { ...actual, applyPolicy: vi.fn(actual.applyPolicy) };
});

import { TriageError } from "../lib/errors";
import * as policyModule from "../lib/policy";
import { TriageResultSchema } from "../lib/schema";
import { modelAnalysis, REQUEST, testConfig } from "./fixtures";

import { triage } from "../lib/triage";

const respond = (over: Record<string, unknown> = {}) => JSON.stringify({ ...modelAnalysis, ...over });
const opts = (call: (...a: never[]) => unknown) => ({
  call: call as never,
  config: { ...testConfig, timeoutMs: 200 },
  retryDelayMs: 1,
});

beforeEach(() => vi.clearAllMocks());

describe("triage pipeline", () => {
  it("returns a trusted TriageResult for a successful call", async () => {
    const call = vi.fn().mockResolvedValue(respond());
    const result = await triage(REQUEST, opts(call));
    expect(TriageResultSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({ category: "Support", priority: "Medium", owner: "Client Success" });
    expect(result).not.toHaveProperty("flags");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("hands policy verified evidence (verification runs before policy)", async () => {
    const evidence = [
      { for: "priority", quote: "as soon as possible" },
      { for: "priority", quote: "a fabricated quote" },
    ];
    const call = vi.fn().mockResolvedValue(respond({ evidence }));
    const result = await triage(REQUEST, opts(call));

    // Policy receives the still-untrusted proposal (fabricated quote included)
    // alongside evidence that verification has already filtered.
    const policy = vi.mocked(policyModule.applyPolicy);
    expect(policy).toHaveBeenCalledTimes(1);
    const [analysisArg, evidenceArg] = policy.mock.calls[0]!;
    expect(analysisArg.evidence).toEqual(evidence);
    expect(evidenceArg).toEqual([{ for: "priority", quote: "as soon as possible" }]);
    expect(result.evidence).toEqual(evidenceArg);
  });

  it("lets policy override the model: flags drive category/priority/owner and escalation", async () => {
    const call = vi.fn().mockResolvedValue(
      respond({ category: "Sales", priority: "Low", flags: { dataExposure: true, criticalOutage: false }, owner: undefined }),
    );
    const result = await triage(REQUEST, opts(call));
    expect(result).toMatchObject({ category: "Technical", priority: "Urgent", owner: "Engineering" });
    expect(result.escalation).toMatch(/security\/privacy/i);
    expect(result.adjustments.map((a) => a.field)).toEqual(["category", "priority"]);
  });

  it("keeps policy effects when the evidence for a flag is dropped", async () => {
    const call = vi.fn().mockResolvedValue(
      respond({
        flags: { dataExposure: false, criticalOutage: true },
        evidence: [{ for: "criticalOutage", quote: "not in the request" }],
      }),
    );
    const result = await triage(REQUEST, opts(call));
    expect(result.evidence).toEqual([]);
    expect(result.priority).toBe("Urgent");
  });

  it("trims the request before sending and verifying", async () => {
    const call = vi.fn().mockResolvedValue(respond());
    await triage(`   ${REQUEST}\n\n`, opts(call));
    expect(call.mock.calls[0]![0].user).toBe(`<request>\n${REQUEST}\n</request>`);
  });

  it("retries once through the whole pipeline", async () => {
    const call = vi.fn().mockResolvedValueOnce("not json").mockResolvedValueOnce(respond());
    await expect(triage(REQUEST, opts(call))).resolves.toMatchObject({ category: "Support" });
    expect(call).toHaveBeenCalledTimes(2);
    expect(vi.mocked(policyModule.applyPolicy)).toHaveBeenCalledTimes(1);
  });

  it("does not run policy when the model output stays invalid", async () => {
    const call = vi.fn().mockResolvedValue("nope");
    await expect(triage(REQUEST, opts(call))).rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });
    expect(vi.mocked(policyModule.applyPolicy)).not.toHaveBeenCalled();
  });
});

describe("input validation", () => {
  it.each([
    ["an empty string", ""],
    ["whitespace", "  \n\t "],
    ["undefined", undefined],
    ["null", null],
    ["a number", 42],
    ["an object", { text: "hi" }],
  ])("rejects %s with INVALID_INPUT and never calls the provider", async (_n, input) => {
    const call = vi.fn();
    await expect(triage(input, opts(call))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(call).not.toHaveBeenCalled();
  });

  it("rejects oversized input with INPUT_TOO_LONG and never calls the provider", async () => {
    const call = vi.fn();
    const err = await triage("x".repeat(4001), opts(call)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TriageError);
    expect(err).toMatchObject({ code: "INPUT_TOO_LONG", retryable: false });
    expect(call).not.toHaveBeenCalled();
  });

  it("accepts input at exactly the limit", async () => {
    const call = vi.fn().mockResolvedValue(respond({ evidence: [] }));
    await triage("x".repeat(4000), opts(call));
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("does not need a Gemini key to reject bad input", async () => {
    await expect(triage("", { config: { ...testConfig, apiKey: undefined } })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});

describe("provider failures", () => {
  it.each([
    ["429", new TriageError("RATE_LIMITED", "slow"), "RATE_LIMITED"],
    ["401/403", new TriageError("CONFIGURATION_ERROR", "key"), "CONFIGURATION_ERROR"],
    ["400", new TriageError("PROVIDER_ERROR", "bad", { retryable: false }), "PROVIDER_ERROR"],
  ])("does not retry %s", async (_n, error, code) => {
    const call = vi.fn().mockRejectedValue(error);
    await expect(triage(REQUEST, opts(call))).rejects.toMatchObject({ code });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("retries a 5xx once, then reports PROVIDER_ERROR", async () => {
    const call = vi.fn().mockRejectedValue(new TriageError("PROVIDER_ERROR", "down"));
    await expect(triage(REQUEST, opts(call))).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("reports a timeout as PROVIDER_TIMEOUT without retrying", async () => {
    const call = vi.fn(() => new Promise<string>(() => {}));
    const o = { ...opts(call), config: { ...testConfig, timeoutMs: 30 } };
    await expect(triage(REQUEST, o)).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("refuses recorded mode until it exists, without calling any provider", async () => {
    await expect(triage(REQUEST, { config: { ...testConfig, mode: "recorded" } })).rejects.toMatchObject({
      code: "CONFIGURATION_ERROR",
    });
  });
});

describe("input validation precedes configuration", () => {
  it("rejects over-length input with INPUT_TOO_LONG even when config is unavailable", async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      await expect(triage("x".repeat(4001))).rejects.toMatchObject({ code: "INPUT_TOO_LONG" });
      await expect(triage("   ")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    } finally {
      if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
    }
  });
});
