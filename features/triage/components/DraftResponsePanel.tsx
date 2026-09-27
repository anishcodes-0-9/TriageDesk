/**
 * Molecule: displays the trusted draft response exactly as returned, for a
 * human to review. This is not a sender: it never submits, edits, or adds
 * to the text — it only renders the string it is given.
 */
export type DraftResponsePanelProps = {
  draftResponse: string;
};

export function DraftResponsePanel({ draftResponse }: DraftResponsePanelProps) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <h3 className="font-medium text-text">Draft response (for review)</h3>
      <p className="text-text-muted">This draft has not been sent. Review and send it yourself if appropriate.</p>
      <p className="whitespace-pre-wrap break-words text-text">{draftResponse}</p>
    </div>
  );
}
