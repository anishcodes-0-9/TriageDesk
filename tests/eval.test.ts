import { describe, expect, it } from "vitest";
import { CASES, type EvalCase } from "../eval/cases";
import { renderReport } from "../eval/report";
import { scoreResult, summariseCase, tallyDimensions, verdictOf, type RunRecord } from "../eval/score";
import { applyPolicy } from "../lib/policy";
import type { TriageResult } from "../lib/schema";
import { modelAnalysis } from "./fixtures";

// These tests cover the evaluation logic only. They never call Gemini.

const byId = (id: string): EvalCase => CASES.find((c) => c.id === id)!;

const OFFICIAL_TEXTS = [
  "Our team has 40 employees entering the same customer details into three systems. Could you show us how this might be automated? We would like to speak next week.",
  "The client portal has been unavailable since this morning and our staff cannot access active customer records. Please help as soon as possible.",
  "Invoice NS-1048 appears to include the same implementation charge twice. Can someone review it before payment is processed Friday?",
  "Can you add dark mode and change the dashboard font? There is no deadline. I am collecting ideas for a future update.",
  "We accidentally uploaded a spreadsheet containing customer contact information to the wrong workspace. We need immediate help removing access.",
  "I saw your company online and am interested in a custom AI reporting system. What would pricing and a typical timeline look like?",
];

const result = (over: Partial<TriageResult> = {}): TriageResult => ({
  ...applyPolicy({ ...modelAnalysis, category: "Sales", priority: "Medium" }, []),
  ...over,
});

describe("evaluation cases", () => {
  it("has unique ids", () => {
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
  });

  it("holds the six official requests verbatim, in order", () => {
    const official = CASES.filter((c) => c.group === "official");
    expect(official.map((c) => c.text)).toEqual(OFFICIAL_TEXTS);
    expect(official.map((c) => c.id)).toEqual(["official-01", "official-02", "official-03", "official-04", "official-05", "official-06"]);
  });

  it("stays within the input limit and has non-empty allowed sets", () => {
    for (const c of CASES) {
      expect(c.text.length).toBeLessThanOrEqual(4000);
      expect(c.expect.category.length).toBeGreaterThan(0);
      expect(c.expect.priority.length).toBeGreaterThan(0);
    }
  });

  it("marks data exposure and outages as forced Technical/Urgent, and data exposure with escalation", () => {
    expect(byId("official-05").expect).toMatchObject({ category: ["Technical"], priority: ["Urgent"], safety: "dataExposure" });
    expect(byId("official-02").expect.safety).toBe("forced");
    expect(byId("edge-systemic-login").expect.safety).toBe("forced");
  });
});

describe("scoreResult", () => {
  const sales = byId("official-01");

  it("conforms when the result is inside the allowed sets", () => {
    const checks = scoreResult(sales, result());
    expect(verdictOf(checks)).toBe("conforms");
  });

  it("accepts any value from an allowed range and rejects values outside it", () => {
    expect(verdictOf(scoreResult(sales, result({ priority: "High" })))).toBe("conforms");
    const low = scoreResult(sales, result({ priority: "Low" }));
    expect(low.find((c) => c.name === "priority")).toMatchObject({ verdict: "does_not_conform", cause: "prompt_model_judgment" });
  });

  it("flags a wrong category", () => {
    const checks = scoreResult(sales, result({ category: "Billing", owner: "Finance" }));
    expect(checks.find((c) => c.name === "category")?.verdict).toBe("does_not_conform");
  });

  it("flags an owner that does not match the category as a policy problem", () => {
    const checks = scoreResult(sales, result({ owner: "Finance" }));
    expect(checks.find((c) => c.name === "owner_consistency")).toMatchObject({
      verdict: "does_not_conform",
      cause: "deterministic_policy",
    });
  });

  it("requires Technical/Urgent/Engineering plus escalation for data exposure", () => {
    const exposure = byId("official-05");
    const good = applyPolicy(
      { ...modelAnalysis, flags: { dataExposure: true, criticalOutage: false }, category: "Support", priority: "Low" },
      [],
    );
    expect(verdictOf(scoreResult(exposure, good))).toBe("conforms");

    const missed = applyPolicy({ ...modelAnalysis, category: "Support", priority: "Medium" }, []);
    const checks = scoreResult(exposure, missed);
    expect(checks.find((c) => c.name === "safety_override")?.verdict).toBe("does_not_conform");
  });

  it("requires no escalation for negation cases", () => {
    const negation = byId("edge-negation");
    const clean = result({ category: "Billing", owner: "Finance", priority: "Low" });
    expect(verdictOf(scoreResult(negation, clean))).toBe("conforms");

    const overEscalated = applyPolicy(
      { ...modelAnalysis, flags: { dataExposure: true, criticalOutage: false }, category: "Billing" },
      [],
    );
    expect(scoreResult(negation, overEscalated).find((c) => c.name === "safety_override")?.verdict).toBe("does_not_conform");
  });

  it("fails a result whose evidence quote is not in the request", () => {
    const checks = scoreResult(sales, result({ evidence: [{ for: "priority", quote: "a fabricated quote" }] }));
    expect(checks.find((c) => c.name === "evidence_validity")).toMatchObject({
      verdict: "does_not_conform",
      cause: "evidence_handling",
    });
  });

  it("accepts evidence quoted verbatim, ignoring case and curly quotes", () => {
    const ok = scoreResult(sales, result({ evidence: [{ for: "priority", quote: "WE WOULD LIKE TO SPEAK NEXT WEEK" }] }));
    expect(ok.find((c) => c.name === "evidence_validity")?.verdict).toBe("conforms");
  });

  it("checks that category Other carries needsReview, and explicit review expectations", () => {
    const vague = byId("edge-vague");
    const review = (r: TriageResult, c: EvalCase = vague) => scoreResult(c, r).filter((x) => x.name === "review_state");

    const bad = result({ category: "Other", owner: "Client Success", priority: "Low", needsReview: false });
    expect(review(bad)).toMatchObject([{ verdict: "does_not_conform", cause: "deterministic_policy" }, { verdict: "does_not_conform" }]);

    const noReview = result({ category: "Support", owner: "Client Success", priority: "Low", needsReview: false });
    expect(review(noReview)).toMatchObject([{ verdict: "conforms" }, { verdict: "does_not_conform", cause: "prompt_model_judgment" }]);

    const reviewed = result({ category: "Support", owner: "Client Success", priority: "Low", needsReview: true });
    expect(review(reviewed).every((c) => c.verdict === "conforms")).toBe(true);
  });

  it("asserts an explicit needsReview expectation whenever a case sets one", () => {
    const official5 = byId("official-05");
    expect(official5.expect.needsReview).toBe(false);
    const exposure = (needsReview: boolean) =>
      applyPolicy({ ...modelAnalysis, flags: { dataExposure: true, criticalOutage: false }, needsReview, reviewReason: needsReview ? "x" : null }, []);

    expect(verdictOf(scoreResult(official5, exposure(false)))).toBe("conforms");
    const flipped = scoreResult(official5, exposure(true));
    expect(verdictOf(flipped)).toBe("does_not_conform");
    expect(flipped.filter((c) => c.name === "review_state" && c.verdict === "does_not_conform")).toHaveLength(1);
  });

  it("leaves needsReview unconstrained where the frozen rules do not determine it", () => {
    const de = byId("edge-data-exposure");
    expect(de.expect.needsReview).toBeUndefined();
    expect(de.basis).toMatch(/unconstrained/i);
    for (const needsReview of [true, false]) {
      const r = applyPolicy(
        { ...modelAnalysis, flags: { dataExposure: true, criticalOutage: false }, needsReview, reviewReason: needsReview ? "x" : null },
        [],
      );
      expect(verdictOf(scoreResult(de, r))).toBe("conforms");
    }
  });

  it("keeps edge-mixed-intent strict: Billing only, so a Sales result does not conform", () => {
    const mixed = byId("edge-mixed-intent");
    expect(mixed.expect.category).toEqual(["Billing"]);
    expect(mixed.expect.priority).toEqual(["Medium", "High"]);
    const sales = result({ priority: "High" });
    expect(scoreResult(mixed, sales).find((c) => c.name === "category")?.verdict).toBe("does_not_conform");
  });
});

function completed(caseId: string, pass: number, over: Partial<Extract<RunRecord, { status: "completed" }>> = {}): RunRecord {
  const checks = scoreResult(byId(caseId), result());
  return {
    caseId,
    pass,
    status: "completed",
    category: "Sales",
    priority: "Medium",
    owner: "Sales Team",
    needsReview: false,
    escalated: false,
    adjustmentFields: [],
    evidenceCount: 0,
    checks,
    verdict: verdictOf(checks),
    durationMs: 1,
    ...over,
  };
}

describe("summariseCase", () => {
  it("is stable when every pass has the same category, priority and review state", () => {
    const s = summariseCase("official-01", [completed("official-01", 1), completed("official-01", 2), completed("official-01", 3)]);
    expect(s).toMatchObject({ outcome: "conforms", completedPasses: 3, stability: "stable" });
  });

  it("is unstable when a pass differs, and lists both signatures", () => {
    const s = summariseCase("official-01", [completed("official-01", 1), completed("official-01", 2, { priority: "High" })]);
    expect(s.stability).toBe("unstable");
    expect(s.observed).toHaveLength(2);
  });

  it("does not claim stability from a single pass", () => {
    expect(summariseCase("official-01", [completed("official-01", 1)]).stability).toBe("not_applicable");
  });

  it("does not conform if any pass fails a check", () => {
    const bad = scoreResult(byId("official-01"), result({ priority: "Low" }));
    const s = summariseCase("official-01", [
      completed("official-01", 1),
      completed("official-01", 2, { checks: bad, verdict: verdictOf(bad) }),
    ]);
    expect(s.outcome).toBe("does_not_conform");
    expect(s.failedChecks).toMatchObject([{ pass: 2, name: "priority" }]);
  });

  it("reports provider failure and not_run separately", () => {
    expect(
      summariseCase("official-01", [{ caseId: "official-01", pass: 1, status: "provider_failure", errorCode: "RATE_LIMITED", durationMs: 5 }]).outcome,
    ).toBe("provider_failure");
    expect(summariseCase("official-01", [{ caseId: "official-01", pass: 1, status: "not_run", reason: "x" }]).outcome).toBe("not_run");
  });

  it("tallies dimensions only over completed runs", () => {
    const tally = tallyDimensions([completed("official-01", 1), { caseId: "x", pass: 1, status: "not_run", reason: "y" }]);
    expect(tally.find((d) => d.name === "category")).toEqual({ name: "category", conforms: 1, total: 1 });
  });
});

describe("renderReport", () => {
  const meta = { model: "m", passesRequested: 2, delayMs: 0, startedAt: "t", stoppedEarly: null };

  it("reports counts and stability without a score, and never includes request text", () => {
    const md = renderReport([byId("official-01")], [completed("official-01", 1), completed("official-01", 2)], meta);
    expect(md).toContain("Total cases: 1");
    expect(md).toContain("conforms: 1");
    expect(md).toContain("stable: 1 of 1");
    expect(md).not.toMatch(/score|accuracy:/i);
    expect(md).not.toContain(byId("official-01").text);
  });

  it("surfaces a rate-limit stop and failing checks with a suspected cause", () => {
    const bad = scoreResult(byId("official-01"), result({ priority: "Low" }));
    const md = renderReport(
      [byId("official-01"), byId("official-02")],
      [
        completed("official-01", 1, { checks: bad, verdict: "does_not_conform" }),
        { caseId: "official-02", pass: 1, status: "provider_failure", errorCode: "RATE_LIMITED", durationMs: 1 },
      ],
      { ...meta, stoppedEarly: "Provider rate limit (RATE_LIMITED) at official-02, pass 1." },
    );
    expect(md).toContain("Run stopped early");
    expect(md).toContain("does_not_conform: 1");
    expect(md).toContain("suspected: prompt/model judgment");
    expect(md).toContain("official-02 pass 1: RATE_LIMITED");
  });
});
