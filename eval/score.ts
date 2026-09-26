import { verifyEvidence } from "../lib/analyze";
import type { ErrorCode } from "../lib/errors";
import type { TriageResult } from "../lib/schema";
import { OWNER_BY_CATEGORY } from "../lib/taxonomy";
import type { EvalCase } from "./cases";

export type Verdict = "conforms" | "does_not_conform";

/** Where a non-conformance most plausibly comes from. A hint for review, not a ruling. */
export type SuspectedCause =
  | "prompt_model_judgment"
  | "evidence_handling"
  | "deterministic_policy"
  | "test_expectation";

export type CheckName =
  | "category"
  | "priority"
  | "owner_consistency"
  | "safety_override"
  | "evidence_validity"
  | "review_state";

export type Check = { name: CheckName; verdict: Verdict; detail: string; cause?: SuspectedCause };

/** What is stored per run. No request text, summary or draft. */
export type RunRecord =
  | {
      caseId: string;
      pass: number;
      status: "completed";
      category: TriageResult["category"];
      priority: TriageResult["priority"];
      owner: TriageResult["owner"];
      needsReview: boolean;
      escalated: boolean;
      adjustmentFields: string[];
      evidenceCount: number;
      checks: Check[];
      verdict: Verdict;
      durationMs: number;
    }
  | { caseId: string; pass: number; status: "provider_failure"; errorCode: ErrorCode; durationMs: number }
  | { caseId: string; pass: number; status: "not_run"; reason: string };

const oneOf = <T>(allowed: readonly T[], value: T) => allowed.includes(value);
const list = (values: readonly string[]) => values.join(" | ");

/** Run every applicable check against the final (post-policy) result. */
export function scoreResult(testCase: EvalCase, result: TriageResult): Check[] {
  const { expect } = testCase;
  const checks: Check[] = [];
  const add = (name: CheckName, ok: boolean, detail: string, cause?: SuspectedCause) =>
    checks.push({ name, verdict: ok ? "conforms" : "does_not_conform", detail, ...(ok ? {} : { cause }) });

  add(
    "category",
    oneOf(expect.category, result.category),
    `got ${result.category}, allowed ${list(expect.category)}`,
    "prompt_model_judgment",
  );
  add(
    "priority",
    oneOf(expect.priority, result.priority),
    `got ${result.priority}, allowed ${list(expect.priority)}`,
    "prompt_model_judgment",
  );

  add(
    "owner_consistency",
    result.owner === OWNER_BY_CATEGORY[result.category],
    `owner ${result.owner} for category ${result.category}`,
    "deterministic_policy",
  );

  if (expect.safety === "forced" || expect.safety === "dataExposure") {
    const forced = result.category === "Technical" && result.priority === "Urgent" && result.owner === "Engineering";
    const escalated = expect.safety === "dataExposure" ? result.escalation !== null : true;
    add(
      "safety_override",
      forced && escalated,
      forced
        ? escalated
          ? "Technical/Urgent/Engineering"
          : "forced outcome present but escalation note missing"
        : `got ${result.category}/${result.priority}/${result.owner}`,
      // Policy only overrides when the model raised a flag; a miss here is the model not flagging.
      "prompt_model_judgment",
    );
  } else if (expect.safety === "none") {
    const clean = result.escalation === null && result.adjustments.length === 0;
    add(
      "safety_override",
      clean,
      clean ? "no escalation, no policy adjustment" : "escalated or adjusted although the request negates it",
      "prompt_model_judgment",
    );
  }

  // Independent re-check: every returned quote must still be a verbatim substring of the request.
  const surviving = verifyEvidence(testCase.text, result.evidence).length;
  add(
    "evidence_validity",
    surviving === result.evidence.length,
    `${surviving}/${result.evidence.length} quotes verified`,
    "evidence_handling",
  );

  // Two independent assertions. Other => needsReview is guaranteed by policy.
  // An explicit expectation is asserted whenever the case specifies one;
  // cases without one leave review state unconstrained.
  const otherOk = result.category !== "Other" || result.needsReview;
  add(
    "review_state",
    otherOk,
    otherOk ? `Other-implies-review holds (needsReview ${result.needsReview})` : "category Other without needsReview",
    "deterministic_policy",
  );
  if (expect.needsReview !== undefined) {
    add(
      "review_state",
      result.needsReview === expect.needsReview,
      `needsReview ${result.needsReview}, expected ${expect.needsReview}`,
      "prompt_model_judgment",
    );
  }

  return checks;
}

export const verdictOf = (checks: readonly Check[]): Verdict =>
  checks.every((c) => c.verdict === "conforms") ? "conforms" : "does_not_conform";

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export type CaseSummary = {
  caseId: string;
  outcome: "conforms" | "does_not_conform" | "provider_failure" | "not_run";
  completedPasses: number;
  failedChecks: { pass: number; name: CheckName; detail: string; cause?: SuspectedCause }[];
  stability: "stable" | "unstable" | "not_applicable";
  observed: string[];
};

const signature = (r: Extract<RunRecord, { status: "completed" }>) =>
  `${r.category}/${r.priority}/review=${r.needsReview}`;

export function summariseCase(caseId: string, records: readonly RunRecord[]): CaseSummary {
  const mine = records.filter((r) => r.caseId === caseId);
  const completed = mine.filter((r): r is Extract<RunRecord, { status: "completed" }> => r.status === "completed");
  const failedChecks = completed.flatMap((r) =>
    r.checks
      .filter((c) => c.verdict === "does_not_conform")
      .map((c) => ({ pass: r.pass, name: c.name, detail: c.detail, cause: c.cause })),
  );

  let outcome: CaseSummary["outcome"];
  if (completed.length > 0) outcome = completed.every((r) => r.verdict === "conforms") ? "conforms" : "does_not_conform";
  else if (mine.some((r) => r.status === "provider_failure")) outcome = "provider_failure";
  else outcome = "not_run";

  const observed = [...new Set(completed.map(signature))];
  const stability: CaseSummary["stability"] =
    completed.length < 2 ? "not_applicable" : observed.length === 1 ? "stable" : "unstable";

  return { caseId, outcome, completedPasses: completed.length, failedChecks, stability, observed };
}

export type DimensionTally = { name: CheckName; conforms: number; total: number };

export function tallyDimensions(records: readonly RunRecord[]): DimensionTally[] {
  const names: CheckName[] = [
    "category",
    "priority",
    "owner_consistency",
    "safety_override",
    "evidence_validity",
    "review_state",
  ];
  return names.map((name) => {
    let conforms = 0;
    let total = 0;
    for (const r of records) {
      if (r.status !== "completed") continue;
      for (const check of r.checks) {
        if (check.name !== name) continue;
        total++;
        if (check.verdict === "conforms") conforms++;
      }
    }
    return { name, conforms, total };
  });
}
