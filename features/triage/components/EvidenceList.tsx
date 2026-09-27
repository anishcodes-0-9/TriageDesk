import type { VerifiedEvidence } from "@/lib/schema";

/**
 * Molecule: displays the already-verified evidence quotes exactly as
 * supplied. This is not raw model output and is never re-verified, searched
 * for, or modified here — that already happened server-side.
 */
export type EvidenceListProps = {
  evidence: VerifiedEvidence[];
};

export function EvidenceList({ evidence }: EvidenceListProps) {
  if (evidence.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2 text-sm">
      {evidence.map((item, index) => (
        <li
          key={`${item.for}-${index}`}
          className="rounded-md border border-border-subtle bg-surface-muted px-3 py-2"
        >
          <span className="text-text-muted">{item.for}: </span>
          <span className="break-words text-text">{item.quote}</span>
        </li>
      ))}
    </ul>
  );
}
