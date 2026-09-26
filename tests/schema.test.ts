import { describe, expect, it } from "vitest";
import {
  AdjustmentSchema,
  MAX_DRAFT_CHARS,
  MAX_EVIDENCE_ITEMS,
  MAX_QUOTE_CHARS,
  ModelAnalysisSchema,
  TriageResultSchema,
} from "../lib/schema";
import { CATEGORIES, OWNER_BY_CATEGORY } from "../lib/taxonomy";

const validAnalysis = {
  summary: "Client portal outage blocking staff.",
  flags: { dataExposure: false, criticalOutage: true },
  evidence: [{ for: "criticalOutage", quote: "portal has been unavailable" }],
  category: "Technical",
  priority: "Urgent",
  priorityReason: "Staff cannot reach active customer records.",
  needsReview: false,
  reviewReason: null,
  draftResponse: "Thanks for flagging this. We are looking into it. [Your name]",
};

const validResult = {
  summary: "Client portal outage blocking staff.",
  category: "Technical",
  priority: "Urgent",
  priorityReason: "Staff cannot reach active customer records.",
  owner: "Engineering",
  needsReview: false,
  reviewReason: null,
  evidence: [{ for: "criticalOutage", quote: "portal has been unavailable" }],
  draftResponse: "Thanks for flagging this. We are looking into it. [Your name]",
  adjustments: [],
  escalation: null,
};

const analysisOk = (v: unknown) => ModelAnalysisSchema.safeParse(v).success;
const resultOk = (v: unknown) => TriageResultSchema.safeParse(v).success;
const adjustmentOk = (v: unknown) => AdjustmentSchema.safeParse(v).success;

describe("ModelAnalysisSchema", () => {
  it("accepts a valid analysis", () => {
    expect(analysisOk(validAnalysis)).toBe(true);
  });

  it("rejects an invalid category", () => {
    expect(analysisOk({ ...validAnalysis, category: "Security" })).toBe(false);
  });

  it("rejects an invalid priority", () => {
    expect(analysisOk({ ...validAnalysis, priority: "Critical" })).toBe(false);
  });

  it("rejects an invalid evidence target", () => {
    const evidence = [{ for: "tone", quote: "as soon as possible" }];
    expect(analysisOk({ ...validAnalysis, evidence })).toBe(false);
  });

  it("rejects an owner chosen by the model (unknown keys)", () => {
    expect(analysisOk({ ...validAnalysis, owner: "Engineering" })).toBe(false);
  });

  it("requires flags", () => {
    const { flags: _flags, ...withoutFlags } = validAnalysis;
    expect(analysisOk(withoutFlags)).toBe(false);
  });

  describe("reviewReason", () => {
    it("accepts null", () => {
      expect(analysisOk({ ...validAnalysis, reviewReason: null })).toBe(true);
    });

    it("accepts a string", () => {
      expect(analysisOk({ ...validAnalysis, needsReview: true, reviewReason: "Could be Sales or Support." })).toBe(true);
    });

    it("does not tie needsReview to reviewReason (policy decides)", () => {
      expect(analysisOk({ ...validAnalysis, needsReview: true, reviewReason: null })).toBe(true);
      expect(analysisOk({ ...validAnalysis, needsReview: false, reviewReason: "Unsure" })).toBe(true);
    });

    it("rejects an empty or missing reason", () => {
      expect(analysisOk({ ...validAnalysis, reviewReason: "" })).toBe(false);
      const { reviewReason: _r, ...without } = validAnalysis;
      expect(analysisOk(without)).toBe(false);
    });
  });

  describe("evidence bounds", () => {
    const item = { for: "priority", quote: "as soon as possible" };

    it("accepts an empty array and the maximum size", () => {
      expect(analysisOk({ ...validAnalysis, evidence: [] })).toBe(true);
      const full = Array.from({ length: MAX_EVIDENCE_ITEMS }, () => item);
      expect(analysisOk({ ...validAnalysis, evidence: full })).toBe(true);
    });

    it("rejects too many items", () => {
      const tooMany = Array.from({ length: MAX_EVIDENCE_ITEMS + 1 }, () => item);
      expect(analysisOk({ ...validAnalysis, evidence: tooMany })).toBe(false);
    });

    it("rejects an empty quote and a quote that is too long", () => {
      const short = [{ ...item, quote: "" }];
      const long = [{ ...item, quote: "x".repeat(MAX_QUOTE_CHARS + 1) }];
      expect(analysisOk({ ...validAnalysis, evidence: short })).toBe(false);
      expect(analysisOk({ ...validAnalysis, evidence: long })).toBe(false);
    });

    it("accepts a one-character quote", () => {
      expect(analysisOk({ ...validAnalysis, evidence: [{ ...item, quote: "?" }] })).toBe(true);
    });

    it("accepts a quote at the maximum length", () => {
      const ok = [{ ...item, quote: "x".repeat(MAX_QUOTE_CHARS) }];
      expect(analysisOk({ ...validAnalysis, evidence: ok })).toBe(true);
    });
  });

  describe("draftResponse", () => {
    it("rejects an empty draft", () => {
      expect(analysisOk({ ...validAnalysis, draftResponse: "" })).toBe(false);
    });

    it("rejects a draft over the length cap", () => {
      expect(analysisOk({ ...validAnalysis, draftResponse: "x".repeat(MAX_DRAFT_CHARS + 1) })).toBe(false);
    });

    it("rejects a non-string draft", () => {
      expect(analysisOk({ ...validAnalysis, draftResponse: null })).toBe(false);
    });
  });
});

describe("TriageResultSchema", () => {
  it("accepts a valid result", () => {
    expect(resultOk(validResult)).toBe(true);
  });

  it("does not accept raw model flags", () => {
    const flags = { dataExposure: false, criticalOutage: true };
    expect(resultOk({ ...validResult, flags })).toBe(false);
  });

  it("requires an owner", () => {
    const { owner: _owner, ...withoutOwner } = validResult;
    expect(resultOk(withoutOwner)).toBe(false);
  });

  it("rejects an unknown owner", () => {
    expect(resultOk({ ...validResult, owner: "Security" })).toBe(false);
  });

  it("accepts every category with its derived owner", () => {
    for (const category of CATEGORIES) {
      expect(resultOk({ ...validResult, category, owner: OWNER_BY_CATEGORY[category] })).toBe(true);
    }
  });

  it("rejects an owner that does not match the category", () => {
    expect(resultOk({ ...validResult, category: "Billing", owner: "Engineering" })).toBe(false);
    expect(resultOk({ ...validResult, category: "Sales", owner: "Finance" })).toBe(false);
  });

  it("does not tie needsReview to reviewReason (policy decides)", () => {
    expect(resultOk({ ...validResult, needsReview: true, reviewReason: null })).toBe(true);
  });

  it("accepts an escalation note and rejects an empty one", () => {
    expect(resultOk({ ...validResult, escalation: "Possible data exposure." })).toBe(true);
    expect(resultOk({ ...validResult, escalation: "" })).toBe(false);
  });

  it("accepts a valid adjustment", () => {
    const adjustments = [
      { field: "priority", from: "High", to: "Urgent", reason: "Data exposure floors priority at Urgent." },
    ];
    expect(resultOk({ ...validResult, adjustments })).toBe(true);
  });

  it("rejects an adjustment to an unsupported field", () => {
    const adjustments = [{ field: "owner", from: "Finance", to: "Engineering", reason: "x" }];
    expect(resultOk({ ...validResult, adjustments })).toBe(false);
  });
});

describe("AdjustmentSchema", () => {
  it("allows category, priority and needsReview", () => {
    expect(adjustmentOk({ field: "category", from: "Support", to: "Technical", reason: "Outage." })).toBe(true);
    expect(adjustmentOk({ field: "priority", from: "Low", to: "High", reason: "Deadline." })).toBe(true);
    expect(adjustmentOk({ field: "needsReview", from: false, to: true, reason: "Ambiguous." })).toBe(true);
  });

  it("rejects other fields", () => {
    for (const field of ["owner", "summary", "draftResponse", "reviewReason"]) {
      expect(adjustmentOk({ field, from: "a", to: "b", reason: "x" })).toBe(false);
    }
  });

  it("rejects values that do not fit the field", () => {
    expect(adjustmentOk({ field: "priority", from: "Low", to: "Critical", reason: "x" })).toBe(false);
    expect(adjustmentOk({ field: "category", from: "Sales", to: "Urgent", reason: "x" })).toBe(false);
    expect(adjustmentOk({ field: "needsReview", from: "false", to: true, reason: "x" })).toBe(false);
  });
});
