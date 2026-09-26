import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
const constructed = vi.fn();

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  class FakeGoogleGenAI {
    models = { generateContent };
    constructor(options: unknown) {
      constructed(options);
    }
  }
  return { ...actual, GoogleGenAI: FakeGoogleGenAI };
});

import { ThinkingLevel } from "@google/genai";
import { TriageError } from "../lib/errors";
import { callGemini, mapProviderError } from "../lib/llm";
import { testConfig } from "./fixtures";

const input = () => ({ system: "SYS", user: "USER", signal: new AbortController().signal });
const httpError = (status: number, message = "raw provider text with key sk-SECRET and request body") =>
  Object.assign(new Error(message), { status });

describe("callGemini", () => {
  beforeEach(() => {
    generateContent.mockReset();
    constructed.mockReset();
  });

  it("calls generateContent with the frozen settings and returns the raw text", async () => {
    generateContent.mockResolvedValue({ text: '{"a":1}', candidates: [{ finishReason: "STOP" }] });
    const i = input();
    await expect(callGemini(i, testConfig)).resolves.toBe('{"a":1}');

    expect(constructed).toHaveBeenCalledWith({ apiKey: testConfig.apiKey });
    const args = generateContent.mock.calls[0]![0];
    expect(args.model).toBe("test-model");
    expect(args.contents).toBe("USER");
    expect(args.config).toMatchObject({
      systemInstruction: "SYS",
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      maxOutputTokens: 2048,
      abortSignal: i.signal,
    });
    expect(args.config.responseJsonSchema.properties).toHaveProperty("draftResponse");
  });

  it("fails as CONFIGURATION_ERROR without calling Gemini when the key is missing", async () => {
    await expect(callGemini(input(), { ...testConfig, apiKey: undefined })).rejects.toMatchObject({
      code: "CONFIGURATION_ERROR",
    });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it.each([
    ["truncated (MAX_TOKENS)", { text: '{"a"', candidates: [{ finishReason: "MAX_TOKENS" }] }],
    ["blocked (SAFETY)", { text: undefined, candidates: [{ finishReason: "SAFETY" }] }],
    ["empty text", { text: "", candidates: [{ finishReason: "STOP" }] }],
  ])("reports %s as MODEL_OUTPUT_INVALID", async (_name, response) => {
    generateContent.mockResolvedValue(response);
    await expect(callGemini(input(), testConfig)).rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });
  });

  it("converts SDK errors to safe TriageErrors", async () => {
    generateContent.mockRejectedValue(httpError(429));
    const err = (await callGemini(input(), testConfig).catch((e: unknown) => e)) as TriageError;
    expect(err).toBeInstanceOf(TriageError);
    expect(err.code).toBe("RATE_LIMITED");
  });
});

describe("mapProviderError", () => {
  it.each([
    [429, "RATE_LIMITED", true],
    [400, "PROVIDER_ERROR", false],
    [401, "CONFIGURATION_ERROR", false],
    [403, "CONFIGURATION_ERROR", false],
    [404, "CONFIGURATION_ERROR", false],
    [422, "PROVIDER_ERROR", false],
    [500, "PROVIDER_ERROR", true],
    [503, "PROVIDER_ERROR", true],
  ])("HTTP %i -> %s (retryable %s)", (status, code, retryable) => {
    const e = mapProviderError(httpError(status));
    expect(e).toBeInstanceOf(TriageError);
    expect(e.code).toBe(code);
    expect(e.retryable).toBe(retryable);
  });

  it("treats an error with no status (network failure) as a retryable provider error", () => {
    const e = mapProviderError(new TypeError("fetch failed: ECONNRESET 10.0.0.1"));
    expect(e).toMatchObject({ code: "PROVIDER_ERROR", retryable: true });
  });

  it("maps an aborted signal or AbortError to PROVIDER_TIMEOUT", () => {
    const controller = new AbortController();
    controller.abort();
    expect(mapProviderError(new Error("x"), controller.signal).code).toBe("PROVIDER_TIMEOUT");
    const abort = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    expect(mapProviderError(abort).code).toBe("PROVIDER_TIMEOUT");
  });

  it("never leaks provider text, keys or request data in the message", () => {
    for (const status of [400, 401, 403, 429, 500, undefined]) {
      const raw = status === undefined ? new Error("sk-SECRET request body") : httpError(status);
      const message = mapProviderError(raw).message;
      expect(message).not.toMatch(/sk-SECRET|raw provider|request body|key/i);
    }
  });

  it("passes an existing TriageError through unchanged", () => {
    const original = new TriageError("INTERNAL", "x");
    expect(mapProviderError(original)).toBe(original);
  });
});
