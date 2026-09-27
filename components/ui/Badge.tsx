/**
 * Shared UI atom. Purely presentational: it renders a tone, never decides
 * one. Domain values (Category, Priority, needsReview, ...) are translated
 * into a BadgeTone by the triage feature's display mapping — this file has
 * no knowledge that "Urgent" or "Technical" exist.
 */
export type BadgeTone = "neutral" | "info" | "positive" | "warning" | "danger";

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-status-neutral text-status-neutral-foreground border-status-neutral-border",
  info: "bg-status-info text-status-info-foreground border-status-info-border",
  positive: "bg-status-positive text-status-positive-foreground border-status-positive-border",
  warning: "bg-status-warning text-status-warning-foreground border-status-warning-border",
  danger: "bg-status-danger text-status-danger-foreground border-status-danger-border",
};

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
