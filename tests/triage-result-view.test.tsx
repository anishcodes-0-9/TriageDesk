// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TriageResultView } from "../features/triage/components/TriageResultView";
import { categoryDisplay, ownerDisplay, priorityDisplay, reviewDisplay } from "../features/triage/display/triageDisplay";
import type { TriageResult } from "../lib/schema";

// A small, local, schema-valid fixture. Every section has content so the
// fixed-order test can find a marker for each of the six molecules.
const FULL_RESULT: TriageResult = {
  summary: "A customer reports a billing discrepancy.",
  category: "Technical",
  priority: "Urgent",
  priorityReason: "Immediate impact on operations.",
  owner: "Engineering",
  needsReview: true,
  reviewReason: "The request mixes several intents.",
  evidence: [{ for: "dataExposure", quote: "customer data was exposed" }],
  draftResponse: "Thank you for reaching out. [Your name]",
  adjustments: [],
  escalation: "Security/privacy escalation required.",
};

describe("TriageResultView", () => {
  it("renders the top-level heading", () => {
    render(<TriageResultView result={FULL_RESULT} />);
    expect(screen.getByRole("heading", { name: "Analysis result" })).toBeInTheDocument();
  });

  it("renders RequestMeta with the result's category and owner", () => {
    render(<TriageResultView result={FULL_RESULT} />);
    expect(screen.getByText(categoryDisplay(FULL_RESULT.category).label)).toBeInTheDocument();
    expect(screen.getByText(ownerDisplay(FULL_RESULT.owner).label)).toBeInTheDocument();
  });

  it("renders PriorityIndicator with the result's priority and priorityReason", () => {
    render(<TriageResultView result={FULL_RESULT} />);
    expect(screen.getByText(priorityDisplay(FULL_RESULT.priority).label)).toBeInTheDocument();
    expect(screen.getByText(FULL_RESULT.priorityReason)).toBeInTheDocument();
  });

  it("renders ReviewStatus with needsReview and reviewReason", () => {
    render(<TriageResultView result={FULL_RESULT} />);
    expect(screen.getByText(reviewDisplay(FULL_RESULT.needsReview).label)).toBeInTheDocument();
    expect(screen.getByText(FULL_RESULT.reviewReason as string)).toBeInTheDocument();
  });

  it("renders EvidenceList with the result's evidence", () => {
    render(<TriageResultView result={FULL_RESULT} />);
    expect(screen.getByText(FULL_RESULT.evidence[0]!.quote)).toBeInTheDocument();
  });

  it("renders EscalationBanner with the result's escalation", () => {
    render(<TriageResultView result={FULL_RESULT} />);
    expect(screen.getByText(FULL_RESULT.escalation as string)).toBeInTheDocument();
  });

  it("renders DraftResponsePanel with the result's draftResponse", () => {
    render(<TriageResultView result={FULL_RESULT} />);
    expect(screen.getByText(FULL_RESULT.draftResponse)).toBeInTheDocument();
  });

  it("presents sections in the fixed order: metadata, priority, review, evidence, escalation, draft", () => {
    const { container } = render(<TriageResultView result={FULL_RESULT} />);
    const text = container.textContent ?? "";

    const categoryIndex = text.indexOf(categoryDisplay(FULL_RESULT.category).label);
    const priorityIndex = text.indexOf(priorityDisplay(FULL_RESULT.priority).label);
    const reviewIndex = text.indexOf(reviewDisplay(FULL_RESULT.needsReview).label);
    const evidenceIndex = text.indexOf(FULL_RESULT.evidence[0]!.quote);
    const escalationIndex = text.indexOf("Escalation");
    const draftIndex = text.indexOf("Draft response");

    expect([categoryIndex, priorityIndex, reviewIndex, evidenceIndex, escalationIndex, draftIndex]).not.toContain(-1);
    expect(categoryIndex).toBeLessThan(priorityIndex);
    expect(priorityIndex).toBeLessThan(reviewIndex);
    expect(reviewIndex).toBeLessThan(evidenceIndex);
    expect(evidenceIndex).toBeLessThan(escalationIndex);
    expect(escalationIndex).toBeLessThan(draftIndex);
  });

  it("does not invent an escalation for an Urgent/Technical result when escalation is null", () => {
    const result: TriageResult = {
      ...FULL_RESULT,
      priority: "Urgent",
      category: "Technical",
      owner: "Engineering",
      escalation: null,
    };
    render(<TriageResultView result={result} />);

    expect(screen.queryByText(/escalation/i)).not.toBeInTheDocument();
  });

  it("does not derive or alter owner/category/priority for a Technical result", () => {
    const result: TriageResult = {
      ...FULL_RESULT,
      category: "Technical",
      priority: "Urgent",
      owner: "Engineering",
    };
    render(<TriageResultView result={result} />);

    expect(screen.getByText(categoryDisplay("Technical").label)).toBeInTheDocument();
    expect(screen.getByText(priorityDisplay("Urgent").label)).toBeInTheDocument();
    expect(screen.getByText(ownerDisplay("Engineering").label)).toBeInTheDocument();
  });

  it("does not create its own status or alert live region", () => {
    render(<TriageResultView result={FULL_RESULT} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the result's summary", () => {
    render(<TriageResultView result={FULL_RESULT} />);
    expect(screen.getByText(FULL_RESULT.summary)).toBeInTheDocument();
  });

  it("preserves the exact summary text", () => {
    const result: TriageResult = { ...FULL_RESULT, summary: "  Exact wording must survive.  ".trim() };
    render(<TriageResultView result={result} />);
    expect(screen.getByText(result.summary)).toBeInTheDocument();
  });

  it("presents the summary before RequestMeta", () => {
    const { container } = render(<TriageResultView result={FULL_RESULT} />);
    const text = container.textContent ?? "";

    const summaryIndex = text.indexOf(FULL_RESULT.summary);
    const categoryIndex = text.indexOf(categoryDisplay(FULL_RESULT.category).label);

    expect(summaryIndex).not.toBe(-1);
    expect(categoryIndex).not.toBe(-1);
    expect(summaryIndex).toBeLessThan(categoryIndex);
  });

  it("changing the summary does not change any other rendered field", () => {
    const result: TriageResult = { ...FULL_RESULT, summary: "A completely different summary." };
    render(<TriageResultView result={result} />);

    expect(screen.getByText("A completely different summary.")).toBeInTheDocument();
    expect(screen.getByText(categoryDisplay(FULL_RESULT.category).label)).toBeInTheDocument();
    expect(screen.getByText(ownerDisplay(FULL_RESULT.owner).label)).toBeInTheDocument();
    expect(screen.getByText(priorityDisplay(FULL_RESULT.priority).label)).toBeInTheDocument();
    expect(screen.getByText(FULL_RESULT.priorityReason)).toBeInTheDocument();
    expect(screen.getByText(reviewDisplay(FULL_RESULT.needsReview).label)).toBeInTheDocument();
    expect(screen.getByText(FULL_RESULT.evidence[0]!.quote)).toBeInTheDocument();
    expect(screen.getByText(FULL_RESULT.escalation as string)).toBeInTheDocument();
    expect(screen.getByText(FULL_RESULT.draftResponse)).toBeInTheDocument();
  });

  it("wraps a long, unbroken summary string instead of overflowing", () => {
    const result: TriageResult = { ...FULL_RESULT, summary: "a".repeat(200) };
    render(<TriageResultView result={result} />);
    expect(screen.getByText(result.summary)).toHaveClass("break-words");
  });
});
