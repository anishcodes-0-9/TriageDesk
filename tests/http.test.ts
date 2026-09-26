import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODES, TriageError, type ErrorCode } from "../lib/errors";
import { handleTriageRequest, STATUS_BY_CODE, type TriageFn } from "../lib/http";
import { applyPolicy } from "../lib/policy";
import { TriageResultSchema } from "../lib/schema";
import { triage } from "../lib/triage";
import { modelAnalysis, REQUEST, testConfig } from "./fixtures";

const post = (body: string | undefined) =>
  new Request("http://test/api/triage", { method: "POST", body, headers: { "content-type": "application/json" } });
const json = (value: unknown) => post(JSON.stringify(value));

// Real triage() with a fake model call: exercises real validation, never Gemini.
const modelCall = vi.fn();
const realTriage: TriageFn = (input) =>
  triage(input, {
    config: testConfig,
    call: async (i) => {
      modelCall(i);
      return JSON.stringify({ ...modelAnalysis, flags: { dataExposure: true, criticalOutage: false } });
    },
    retryDelayMs: 0,
  });

beforeEach(() => {
  modelCall.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/triage success", () => {
  it("returns 200 with the policy-enforced TriageResult, not raw model output", async () => {
    const res = await handleTriageRequest(json({ request: REQUEST }), realTriage);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(TriageResultSchema.safeParse(body).success).toBe(true);
    // Model said Support/Medium with a dataExposure flag; policy forces Technical/Urgent/Engineering.
    expect(body).toMatchObject({ category: "Technical", priority: "Urgent", owner: "Engineering" });
    expect(body.escalation).not.toBeNull();
    expect(body).not.toHaveProperty("flags");
    expect(JSON.stringify(body)).not.toMatch(/dataExposure|criticalOutage/);
  });

  it("passes the request value to triage", async () => {
    const run = vi.fn<TriageFn>().mockResolvedValue(applyPolicy(modelAnalysis, []));
    await handleTriageRequest(json({ request: "hello" }), run);
    expect(run).toHaveBeenCalledWith("hello");
  });
});

describe("POST /api/triage input handling", () => {
  const cases: [string, Request][] = [
    ["malformed JSON", post("{not json")],
    ["missing body", post(undefined)],
    ["non-object body", json("text")],
    ["array body", json([])],
    ["missing request", json({})],
    ["non-string request", json({ request: 42 })],
    ["empty request", json({ request: "   " })],
    ["too-long request", json({ request: "a".repeat(4001) })],
  ];

  it.each(cases)("%s returns 400 without calling the model", async (_name, req) => {
    const res = await handleTriageRequest(req, realTriage);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(["INVALID_INPUT", "INPUT_TOO_LONG"]).toContain(body.error.code);
    expect(typeof body.error.message).toBe("string");
    expect(modelCall).not.toHaveBeenCalled();
  });
});

describe("POST /api/triage error mapping", () => {
  const expected: Record<ErrorCode, number> = {
    INVALID_INPUT: 400,
    INPUT_TOO_LONG: 400,
    RATE_LIMITED: 429,
    CONFIGURATION_ERROR: 500,
    PROVIDER_ERROR: 502,
    MODEL_OUTPUT_INVALID: 502,
    PROVIDER_TIMEOUT: 504,
    INTERNAL: 500,
  };

  it("covers every error code", () => {
    expect(Object.keys(STATUS_BY_CODE).sort()).toEqual([...ERROR_CODES].sort());
  });

  it.each(ERROR_CODES)("maps %s to its HTTP status with a small stable body", async (code) => {
    const run: TriageFn = async () => {
      throw new TriageError(code, "SECRET-INTERNAL-DETAIL key=abc");
    };
    const res = await handleTriageRequest(json({ request: "x" }), run);
    expect(res.status).toBe(expected[code]);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(["error"]);
    expect(body.error.code).toBe(code);
    if (code !== "INVALID_INPUT" && code !== "INPUT_TOO_LONG") {
      expect(JSON.stringify(body)).not.toContain("SECRET-INTERNAL-DETAIL");
    }
  });

  it("returns a generic 500 for unexpected errors and hides the message and stack", async () => {
    const run: TriageFn = async () => {
      throw new Error("boom sk-secret stack");
    };
    const res = await handleTriageRequest(json({ request: "x" }), run);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text).error.code).toBe("INTERNAL");
    expect(text).not.toMatch(/boom|sk-secret|stack/);
  });
});

describe("POST /api/triage logging", () => {
  it("logs safe metadata only, never the request text", async () => {
    const secret = "ULTRA-PRIVATE-CUSTOMER-TEXT";
    const run: TriageFn = async () => {
      throw new TriageError("PROVIDER_ERROR", `failed on ${secret}`);
    };
    await handleTriageRequest(json({ request: secret }), run);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain(secret);
    expect(logged).toContain("PROVIDER_ERROR");
  });
});

describe("POST /api/triage without configuration", () => {
  it("returns 400 INPUT_TOO_LONG, not a configuration error, when no API key is set", async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const res = await handleTriageRequest(json({ request: "a".repeat(4001) }));
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("INPUT_TOO_LONG");
    } finally {
      if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
    }
  });
});
