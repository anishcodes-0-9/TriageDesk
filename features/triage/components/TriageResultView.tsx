import { useId } from "react";
import type { TriageResult } from "@/lib/schema";
import { DraftResponsePanel } from "./DraftResponsePanel";
import { EscalationBanner } from "./EscalationBanner";
import { EvidenceList } from "./EvidenceList";
import { PriorityIndicator } from "./PriorityIndicator";
import { RequestMeta } from "./RequestMeta";
import { ReviewStatus } from "./ReviewStatus";

/**
 * Organism: composes a Summary section plus the six Step 7 molecules into
 * one result presentation, in a fixed order. It receives the whole trusted
 * TriageResult because its only job is composition/wiring — it makes no
 * decision of its own. Each field is passed straight through to whatever
 * owns displaying it; this file never recomputes, verifies, or reinterprets
 * any of them, and never imports a display mapping or a shared-UI internal
 * itself (those already live inside the molecules). `result.summary` is
 * rendered directly here rather than through a new molecule, since it is a
 * single trusted string with no presentation logic of its own to warrant one.
 */
export type TriageResultViewProps = {
  result: TriageResult;
};

export function TriageResultView({ result }: TriageResultViewProps) {
  const headingId = useId();
  const summaryHeadingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-6">
      <h2 id={headingId} className="text-lg font-semibold text-text">
        Analysis result
      </h2>
      <section aria-labelledby={summaryHeadingId} className="flex flex-col gap-1">
        <h3 id={summaryHeadingId} className="text-sm font-medium text-text">
          Summary
        </h3>
        <p className="text-sm text-text-muted">{result.summary}</p>
      </section>
      <RequestMeta category={result.category} owner={result.owner} />
      <PriorityIndicator priority={result.priority} priorityReason={result.priorityReason} />
      <ReviewStatus needsReview={result.needsReview} reviewReason={result.reviewReason} />
      <EvidenceList evidence={result.evidence} />
      <EscalationBanner escalation={result.escalation} />
      <DraftResponsePanel draftResponse={result.draftResponse} />
    </section>
  );
}
