/**
 * Molecule: displays an already-computed escalation note, or nothing. This
 * component never infers escalation from category, priority, evidence, or
 * flags — the backend's deterministic policy already decided it, and
 * `escalation` is the only thing this component reads.
 *
 * It deliberately does not use the shared InlineMessage primitive: that
 * component's `role` prop is always "status" or "alert", and those two live
 * regions belong exclusively to TriageWorkspace. Reusing it here would
 * create a third one. It also does not import Badge's internal tone class
 * table — that was exported for reuse within the shared-UI layer (by
 * InlineMessage), not for a feature component to depend on. Instead this
 * styles itself directly from the same Step 1 semantic danger tokens
 * (app/tokens.css) that Badge's own tone classes resolve to.
 */
export type EscalationBannerProps = {
  escalation: string | null;
};

export function EscalationBanner({ escalation }: EscalationBannerProps) {
  if (escalation === null) return null;

  return (
    <div className="rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-sm text-status-danger-foreground">
      <h3 className="font-medium">Escalation</h3>
      <p className="break-words">{escalation}</p>
    </div>
  );
}
