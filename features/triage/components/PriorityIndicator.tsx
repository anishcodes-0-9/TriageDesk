import { Badge } from "@/components/ui/Badge";
import type { Priority } from "@/lib/taxonomy";
import { priorityDisplay } from "../display/triageDisplay";

/**
 * Molecule: displays the already-decided priority and its stated reason.
 * The schema guarantees priorityReason is always a non-empty string, so
 * there is no missing/null case to invent text for.
 */
export type PriorityIndicatorProps = {
  priority: Priority;
  priorityReason: string;
};

export function PriorityIndicator({ priority, priorityReason }: PriorityIndicatorProps) {
  const meta = priorityDisplay(priority);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-text-muted">Priority</span>
        <Badge label={meta.label} tone={meta.tone} />
      </div>
      <p className="break-words text-text-muted">
        <span className="font-medium text-text">Reason: </span>
        {priorityReason}
      </p>
    </div>
  );
}
