import type { BadgeTone } from "@/components/ui/Badge";
import type { Category, Owner, Priority } from "@/lib/taxonomy";

/**
 * Presentation adapter for already-decided TriageResult values.
 *
 * This module answers only "how should an already-decided value be shown"
 * (a label and a generic Badge tone) — never "what should the value be."
 * Each function takes one already-trusted domain value (Category, Priority,
 * Owner, needsReview), never raw request text or the full TriageResult, so
 * it has no way to recompute or second-guess a decision the backend's
 * deterministic policy already made.
 */
export type DisplayMeta = {
  label: string;
  tone: BadgeTone;
};

/**
 * Category is a classification/routing axis, not a severity signal, so every
 * category gets the same, lowest-emphasis tone — only the label varies, and
 * the label is the category name itself.
 */
const CATEGORY_DISPLAY: Record<Category, DisplayMeta> = {
  Sales: { label: "Sales", tone: "neutral" },
  Support: { label: "Support", tone: "neutral" },
  Billing: { label: "Billing", tone: "neutral" },
  Technical: { label: "Technical", tone: "neutral" },
  Other: { label: "Other", tone: "neutral" },
};

export function categoryDisplay(category: Category): DisplayMeta {
  return CATEGORY_DISPLAY[category];
}

/**
 * Priority is the one axis meant to carry visual urgency, so its tone scales
 * with severity: Urgent is the most attention-grabbing tone, Low the least.
 */
const PRIORITY_DISPLAY: Record<Priority, DisplayMeta> = {
  Urgent: { label: "Urgent", tone: "danger" },
  High: { label: "High", tone: "warning" },
  Medium: { label: "Medium", tone: "info" },
  Low: { label: "Low", tone: "neutral" },
};

export function priorityDisplay(priority: Priority): DisplayMeta {
  return PRIORITY_DISPLAY[priority];
}

/**
 * Owner is an assignment/routing concept, not a severity signal, so every
 * owner gets the same, lowest-emphasis tone — only the label varies, and the
 * label is the canonical owner name itself.
 */
const OWNER_DISPLAY: Record<Owner, DisplayMeta> = {
  "Sales Team": { label: "Sales Team", tone: "neutral" },
  "Client Success": { label: "Client Success", tone: "neutral" },
  Finance: { label: "Finance", tone: "neutral" },
  Engineering: { label: "Engineering", tone: "neutral" },
};

export function ownerDisplay(owner: Owner): DisplayMeta {
  return OWNER_DISPLAY[owner];
}

/**
 * needsReview is a workflow gate, not a severity signal. It gets its own
 * tone, deliberately distinct from how priority is styled, so a reviewer
 * never mistakes "this needs a human look" for "this is urgent."
 */
export function reviewDisplay(needsReview: boolean): DisplayMeta {
  return needsReview
    ? { label: "Needs review", tone: "warning" }
    : { label: "No review needed", tone: "neutral" };
}
