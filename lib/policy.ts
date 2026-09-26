import type { Adjustment, ModelAnalysis, TriageResult, VerifiedEvidence } from "./schema";
import { OWNER_BY_CATEGORY, PRIORITIES, type Category, type Priority } from "./taxonomy";

// Explicit ordering: never compare priority strings lexicographically.
const PRIORITY_RANK: Record<Priority, number> = Object.fromEntries(
  PRIORITIES.map((p, i) => [p, i]),
) as Record<Priority, number>;

export function maxPriority(a: Priority, b: Priority): Priority {
  return PRIORITY_RANK[b] > PRIORITY_RANK[a] ? b : a;
}

const OTHER_REVIEW_REASON = "Request does not fit a business category.";

function escalationFor(flags: ModelAnalysis["flags"]): string | null {
  if (!flags.dataExposure) return null;
  const base =
    "Security/privacy escalation required: possible exposure of customer or confidential data. Engineering owns the ticket; involve the security/privacy contact immediately.";
  return flags.criticalOutage ? `${base} A critical outage is also indicated.` : base;
}

/**
 * LLM proposes, policy enforces. Pure and deterministic: no I/O, and the
 * inputs are never mutated.
 *
 * `analysis` is the schema-valid but untrusted model proposal. `evidence` must
 * already have passed verification; this function does not verify it.
 * The model's flags are consumed here and are not carried into the result.
 */
export function applyPolicy(analysis: ModelAnalysis, evidence: readonly VerifiedEvidence[]): TriageResult {
  const { flags } = analysis;
  const adjustments: Adjustment[] = [];

  // Hard overrides: data exposure and critical outage are Technical + at least Urgent.
  const hardOverride = flags.dataExposure || flags.criticalOutage;
  const overrideCause = flags.dataExposure ? "Data exposure" : "Critical outage";

  let category: Category = analysis.category;
  if (hardOverride && category !== "Technical") {
    adjustments.push({
      field: "category",
      from: category,
      to: "Technical",
      reason: `${overrideCause} is always handled as Technical.`,
    });
    category = "Technical";
  }

  // Priority is escalate-only.
  let priority: Priority = analysis.priority;
  if (hardOverride) {
    const raised = maxPriority(priority, "Urgent");
    if (raised !== priority) {
      adjustments.push({
        field: "priority",
        from: priority,
        to: raised,
        reason: `${overrideCause} requires at least Urgent priority.`,
      });
      priority = raised;
    }
  }

  // Other always needs a human look. Otherwise the model's value stands.
  let needsReview = analysis.needsReview;
  let reviewReason = analysis.reviewReason;
  if (category === "Other" && !needsReview) {
    adjustments.push({
      field: "needsReview",
      from: false,
      to: true,
      reason: "Requests categorised as Other always need review.",
    });
    needsReview = true;
    reviewReason ??= OTHER_REVIEW_REASON;
  }

  return {
    summary: analysis.summary,
    category,
    priority,
    priorityReason: analysis.priorityReason,
    owner: OWNER_BY_CATEGORY[category],
    needsReview,
    reviewReason,
    evidence: evidence.map((e) => ({ ...e })),
    draftResponse: analysis.draftResponse,
    adjustments,
    escalation: escalationFor(flags),
  };
}
