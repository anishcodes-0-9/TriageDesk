// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewStatus } from "../features/triage/components/ReviewStatus";
import { reviewDisplay } from "../features/triage/display/triageDisplay";

describe("ReviewStatus", () => {
  it("renders the needsReview=true state using the existing display mapping", () => {
    render(<ReviewStatus needsReview={true} reviewReason="The request mixes several intents." />);
    expect(screen.getByText(reviewDisplay(true).label)).toBeInTheDocument();
  });

  it("renders the needsReview=false state using the existing display mapping", () => {
    render(<ReviewStatus needsReview={false} reviewReason={null} />);
    expect(screen.getByText(reviewDisplay(false).label)).toBeInTheDocument();
  });

  it("renders the supplied reviewReason exactly when present", () => {
    const reason = "The request mixes several intents.";
    render(<ReviewStatus needsReview={true} reviewReason={reason} />);
    expect(screen.getByText(reason)).toBeInTheDocument();
  });

  it("does not invent explanatory text when reviewReason is null", () => {
    const { container } = render(<ReviewStatus needsReview={false} reviewReason={null} />);
    // Only the badge label should be present; no second line of text.
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("reflects the supplied needsReview value directly, independent of any other field", () => {
    // Same reviewReason text, opposite needsReview values: the displayed
    // state must follow needsReview, not the presence of a reason string.
    const { unmount } = render(<ReviewStatus needsReview={true} reviewReason="x" />);
    expect(screen.getByText(reviewDisplay(true).label)).toBeInTheDocument();
    unmount();

    render(<ReviewStatus needsReview={false} reviewReason="x" />);
    expect(screen.getByText(reviewDisplay(false).label)).toBeInTheDocument();
  });

  it("wraps a long, unbroken reviewReason string instead of overflowing", () => {
    const reason = "a".repeat(200);
    render(<ReviewStatus needsReview={true} reviewReason={reason} />);
    expect(screen.getByText(reason)).toHaveClass("break-words");
  });
});
