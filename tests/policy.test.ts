import { describe, expect, it } from "vitest";
import { applyPolicy, maxPriority } from "../lib/policy";
import { TriageResultSchema, type ModelAnalysis, type VerifiedEvidence } from "../lib/schema";
import { CATEGORIES, OWNER_BY_CATEGORY, PRIORITIES, type Category, type Priority } from "../lib/taxonomy";

const base: ModelAnalysis = {
  summary: "A request.",
  flags: { dataExposure: false, criticalOutage: false },
  evidence: [],
  category: "Support",
  priority: "Medium",
  priorityReason: "Default.",
  needsReview: false,
  reviewReason: null,
  draftResponse: "Thanks for getting in touch. [Your name]",
};

type Over = Partial<Omit<ModelAnalysis, "flags">> & { flags?: Partial<ModelAnalysis["flags"]> };

const make = (over: Over = {}): ModelAnalysis => ({
  ...base,
  ...over,
  flags: { ...base.flags, ...over.flags },
});

const run = (over: Over = {}, evidence: VerifiedEvidence[] = []) =>
  applyPolicy(make(over), evidence);

const adjustmentFields = (r: ReturnType<typeof run>) => r.adjustments.map((a) => a.field);

describe("owner derivation", () => {
  it.each([
    ["Sales", "Sales Team"],
    ["Support", "Client Success"],
    ["Billing", "Finance"],
    ["Technical", "Engineering"],
    ["Other", "Client Success"],
  ] as const)("%s -> %s", (category, owner) => {
    expect(run({ category, needsReview: true, reviewReason: "x" }).owner).toBe(owner);
  });

  it("is derived from the final category, not the proposed one", () => {
    const r = run({ category: "Sales", flags: { criticalOutage: true } });
    expect(r.category).toBe("Technical");
    expect(r.owner).toBe("Engineering");
  });

  it("never produces an owner adjustment", () => {
    for (const category of CATEGORIES) {
      for (const flags of [{}, { dataExposure: true }, { criticalOutage: true }]) {
        const r = run({ category, flags });
        expect(adjustmentFields(r).every((f) => ["category", "priority", "needsReview"].includes(f))).toBe(true);
      }
    }
  });
});

describe("priority ordering", () => {
  const pairs = PRIORITIES.flatMap((a) => PRIORITIES.map((b) => [a, b] as const));

  it.each(pairs)("maxPriority(%s, %s) never goes below either", (a, b) => {
    const m = maxPriority(a, b);
    expect(PRIORITIES.indexOf(m)).toBe(Math.max(PRIORITIES.indexOf(a), PRIORITIES.indexOf(b)));
  });

  it("is not lexicographic (High < Urgent although 'H' < 'U'; Low < Medium although 'L' < 'M')", () => {
    expect(maxPriority("High", "Low")).toBe("High");
    expect(maxPriority("Medium", "Low")).toBe("Medium");
    expect(maxPriority("Urgent", "High")).toBe("Urgent");
  });
});

describe("priority escalation (hard override floors at Urgent)", () => {
  it.each([
    ["Low", "Urgent"],
    ["Medium", "Urgent"],
    ["High", "Urgent"],
  ] as const)("%s -> %s with a priority adjustment", (from, to) => {
    const r = run({ category: "Technical", priority: from, flags: { criticalOutage: true } });
    expect(r.priority).toBe(to);
    expect(r.adjustments).toEqual([expect.objectContaining({ field: "priority", from, to })]);
  });

  it("never decreases priority for any category/priority/flag combination", () => {
    const flagSets = [{}, { dataExposure: true }, { criticalOutage: true }, { dataExposure: true, criticalOutage: true }];
    for (const category of CATEGORIES) {
      for (const priority of PRIORITIES) {
        for (const flags of flagSets) {
          const r = run({ category, priority, flags, needsReview: true, reviewReason: "x" });
          expect(PRIORITIES.indexOf(r.priority)).toBeGreaterThanOrEqual(PRIORITIES.indexOf(priority));
        }
      }
    }
  });

  it("leaves priority untouched when no hard override applies", () => {
    for (const priority of PRIORITIES) {
      const r = run({ priority });
      expect(r.priority).toBe(priority);
      expect(adjustmentFields(r)).not.toContain("priority");
    }
  });
});

describe.each([
  ["dataExposure", { dataExposure: true }],
  ["criticalOutage", { criticalOutage: true }],
] as const)("%s override", (_name, flags) => {
  const cases: [Category, Priority][] = [
    ["Sales", "Low"],
    ["Support", "Medium"],
    ["Billing", "High"],
    ["Other", "Low"],
    ["Technical", "Low"],
  ];

  it.each(cases)("%s + %s -> Technical + Urgent + Engineering", (category, priority) => {
    const r = run({ category, priority, flags, needsReview: category === "Other", reviewReason: category === "Other" ? "x" : null });
    expect(r.category).toBe("Technical");
    expect(r.priority).toBe("Urgent");
    expect(r.owner).toBe("Engineering");
  });

  it("leaves Technical + Urgent unchanged with no adjustments", () => {
    const r = run({ category: "Technical", priority: "Urgent", flags });
    expect(r).toMatchObject({ category: "Technical", priority: "Urgent", owner: "Engineering", adjustments: [] });
  });

  it("records category and priority adjustments when the model was lower", () => {
    const r = run({ category: "Sales", priority: "Low", flags });
    expect(r.adjustments).toEqual([
      expect.objectContaining({ field: "category", from: "Sales", to: "Technical" }),
      expect.objectContaining({ field: "priority", from: "Low", to: "Urgent" }),
    ]);
  });

  it("records only the category adjustment when priority was already Urgent", () => {
    const r = run({ category: "Billing", priority: "Urgent", flags });
    expect(adjustmentFields(r)).toEqual(["category"]);
  });

  it("does not carry raw flags into the result", () => {
    expect(run({ flags })).not.toHaveProperty("flags");
  });
});

describe("escalation", () => {
  it("is present for data exposure and mentions security/privacy", () => {
    const r = run({ category: "Support", flags: { dataExposure: true } });
    expect(r.escalation).toMatch(/security\/privacy escalation required/i);
  });

  it("does not invent a Security owner or category", () => {
    const r = run({ flags: { dataExposure: true } });
    expect(r.owner).toBe("Engineering");
    expect(r.category).toBe("Technical");
    expect(r.escalation).not.toMatch(/security team/i);
  });

  it("is a single message when both flags are set, noting the outage", () => {
    const r = run({ flags: { dataExposure: true, criticalOutage: true } });
    expect(r.escalation?.match(/Security\/privacy escalation required/g)).toHaveLength(1);
    expect(r.escalation).toMatch(/critical outage/i);
  });

  it("is null for a critical outage alone and for normal requests", () => {
    expect(run({ flags: { criticalOutage: true } }).escalation).toBeNull();
    expect(run().escalation).toBeNull();
  });

  it("uses the data-exposure cause in adjustment reasons when both flags are set", () => {
    const r = run({ category: "Sales", priority: "Low", flags: { dataExposure: true, criticalOutage: true } });
    expect(r.adjustments.every((a) => /data exposure/i.test(a.reason))).toBe(true);
  });
});

describe("Other category", () => {
  it("forces needsReview and Client Success", () => {
    const r = run({ category: "Other", needsReview: false });
    expect(r.owner).toBe("Client Success");
    expect(r.needsReview).toBe(true);
  });

  it("records a needsReview adjustment false -> true and supplies a reason", () => {
    const r = run({ category: "Other", needsReview: false, reviewReason: null });
    expect(r.adjustments).toEqual([expect.objectContaining({ field: "needsReview", from: false, to: true })]);
    expect(r.reviewReason).not.toBeNull();
  });

  it("keeps the model's reason when it had none to override", () => {
    const r = run({ category: "Other", needsReview: false, reviewReason: "Looks like spam." });
    expect(r.reviewReason).toBe("Looks like spam.");
  });

  it("records no adjustment when needsReview was already true", () => {
    const r = run({ category: "Other", needsReview: true, reviewReason: "Gibberish." });
    expect(r.needsReview).toBe(true);
    expect(r.reviewReason).toBe("Gibberish.");
    expect(r.adjustments).toEqual([]);
  });
});

describe("existing review state", () => {
  it("true remains true", () => {
    const r = run({ category: "Sales", needsReview: true, reviewReason: "Mixed intent." });
    expect(r.needsReview).toBe(true);
    expect(r.reviewReason).toBe("Mixed intent.");
    expect(adjustmentFields(r)).not.toContain("needsReview");
  });

  it("false remains false when no rule requires review", () => {
    for (const category of ["Sales", "Support", "Billing", "Technical"] as const) {
      expect(run({ category, needsReview: false }).needsReview).toBe(false);
    }
  });

  it("a category/priority adjustment alone does not create review", () => {
    const r = run({ category: "Sales", priority: "Low", flags: { dataExposure: true } });
    expect(adjustmentFields(r)).toEqual(["category", "priority"]);
    expect(r.needsReview).toBe(false);
    expect(r.reviewReason).toBeNull();
  });
});

describe("adjustments", () => {
  it("records a category adjustment only when the category changes", () => {
    expect(adjustmentFields(run({ category: "Technical", flags: { criticalOutage: true }, priority: "Urgent" }))).toEqual([]);
    expect(adjustmentFields(run({ category: "Support", flags: { criticalOutage: true }, priority: "Urgent" }))).toEqual(["category"]);
  });

  it("records a priority adjustment only when priority increases", () => {
    expect(adjustmentFields(run({ category: "Technical", priority: "Urgent", flags: { dataExposure: true } }))).toEqual([]);
    expect(adjustmentFields(run({ category: "Technical", priority: "High", flags: { dataExposure: true } }))).toEqual(["priority"]);
  });

  it("gives every adjustment a field, from, to and non-empty reason", () => {
    const r = run({ category: "Sales", priority: "Low", flags: { dataExposure: true } });
    for (const a of r.adjustments) {
      expect(a.from).not.toEqual(a.to);
      expect(a.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("result contract", () => {
  it("always satisfies TriageResultSchema", () => {
    const flagSets = [{}, { dataExposure: true }, { criticalOutage: true }, { dataExposure: true, criticalOutage: true }];
    for (const category of CATEGORIES) {
      for (const priority of PRIORITIES) {
        for (const flags of flagSets) {
          const r = run({ category, priority, flags });
          expect(TriageResultSchema.safeParse(r).success).toBe(true);
          expect(r.owner).toBe(OWNER_BY_CATEGORY[r.category]);
        }
      }
    }
  });

  it("passes verified evidence and prose fields through", () => {
    const evidence: VerifiedEvidence[] = [{ for: "criticalOutage", quote: "portal has been unavailable" }];
    const r = run({ summary: "S", priorityReason: "P", draftResponse: "D" }, evidence);
    expect(r.evidence).toEqual(evidence);
    expect([r.summary, r.priorityReason, r.draftResponse]).toEqual(["S", "P", "D"]);
  });
});

describe("immutability", () => {
  it("does not mutate the analysis or evidence", () => {
    const analysis = make({ category: "Sales", priority: "Low", flags: { dataExposure: true, criticalOutage: true } });
    const evidence: VerifiedEvidence[] = [{ for: "dataExposure", quote: "wrong workspace" }];
    const analysisBefore = structuredClone(analysis);
    const evidenceBefore = structuredClone(evidence);

    const result = applyPolicy(analysis, evidence);
    result.evidence[0]!.quote = "changed";

    expect(analysis).toEqual(analysisBefore);
    expect(evidence).toEqual(evidenceBefore);
  });

  it("is deterministic", () => {
    const a = make({ category: "Billing", priority: "Low", flags: { criticalOutage: true } });
    expect(applyPolicy(a, [])).toEqual(applyPolicy(a, []));
  });
});
