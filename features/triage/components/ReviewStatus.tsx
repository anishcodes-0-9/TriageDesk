import { Badge } from "@/components/ui/Badge";
import { reviewDisplay } from "../display/triageDisplay";

/**
 * Molecule: displays the already-decided review state. needsReview and
 * reviewReason are both trusted, independent input — this component never
 * derives review state from category, priority, or evidence.
 */
export type ReviewStatusProps = {
  needsReview: boolean;
  reviewReason: string | null;
};

export function ReviewStatus({ needsReview, reviewReason }: ReviewStatusProps) {
  const meta = reviewDisplay(needsReview);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <Badge label={meta.label} tone={meta.tone} />
      {reviewReason !== null && <p className="text-text-muted">{reviewReason}</p>}
    </div>
  );
}
