import type { Config } from "../lib/config";
import type { ModelAnalysis } from "../lib/schema";

export const testConfig: Config = {
  apiKey: "test-key-not-real",
  model: "test-model",
  mode: "live",
  timeoutMs: 1000,
  maxInputChars: 4000,
  maxOutputTokens: 2048,
};

export const modelAnalysis: ModelAnalysis = {
  summary: "Client portal outage blocking staff.",
  flags: { dataExposure: false, criticalOutage: false },
  evidence: [{ for: "priority", quote: "as soon as possible" }],
  category: "Support",
  priority: "Medium",
  priorityReason: "Staff need access.",
  needsReview: false,
  reviewReason: null,
  draftResponse: "Thanks for contacting us. [Your name]",
};

export const REQUEST = "The client portal is unavailable. Please help as soon as possible.";
