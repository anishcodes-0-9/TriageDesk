// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceList } from "../features/triage/components/EvidenceList";
import { EvidenceSchema, type VerifiedEvidence } from "../lib/schema";

// The finite "for" union is read from the actual schema rather than
// hardcoded, so this test can't silently drift from the real contract.
const EVIDENCE_FOR_VALUES = EvidenceSchema.shape.for.options;

describe("EvidenceList", () => {
  it("renders one evidence item", () => {
    const evidence: VerifiedEvidence[] = [{ for: "priority", quote: "as soon as possible" }];
    render(<EvidenceList evidence={evidence} />);
    expect(screen.getByText("as soon as possible")).toBeInTheDocument();
  });

  it("renders multiple evidence items", () => {
    const evidence: VerifiedEvidence[] = [
      { for: "priority", quote: "as soon as possible" },
      { for: "dataExposure", quote: "uploaded to the wrong workspace" },
    ];
    render(<EvidenceList evidence={evidence} />);
    expect(screen.getByRole("list").querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText("as soon as possible")).toBeInTheDocument();
    expect(screen.getByText("uploaded to the wrong workspace")).toBeInTheDocument();
  });

  it("preserves the exact quote text", () => {
    const quote = "We need immediate help removing access.";
    render(<EvidenceList evidence={[{ for: "dataExposure", quote }]} />);
    expect(screen.getByText(quote)).toBeInTheDocument();
  });

  it("displays the correct 'for' label for every supported value", () => {
    for (const forValue of EVIDENCE_FOR_VALUES) {
      const { unmount } = render(<EvidenceList evidence={[{ for: forValue, quote: "a quote" }]} />);
      expect(screen.getByText(`${forValue}:`)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders nothing for empty evidence", () => {
    const { container } = render(<EvidenceList evidence={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not mutate or reinterpret the supplied evidence array", () => {
    const evidence: VerifiedEvidence[] = [{ for: "criticalOutage", quote: "unavailable since this morning" }];
    const original = JSON.parse(JSON.stringify(evidence));

    render(<EvidenceList evidence={evidence} />);

    expect(evidence).toEqual(original);
  });
});
