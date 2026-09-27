// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriorityIndicator } from "../features/triage/components/PriorityIndicator";
import { priorityDisplay } from "../features/triage/display/triageDisplay";
import { PRIORITIES } from "../lib/taxonomy";

describe("PriorityIndicator", () => {
  it("renders every priority value using the existing display mapping", () => {
    for (const priority of PRIORITIES) {
      const { unmount } = render(<PriorityIndicator priority={priority} priorityReason="Because reasons." />);
      expect(screen.getByText(priorityDisplay(priority).label)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders the supplied priorityReason exactly", () => {
    const reason = "Security/privacy exposure requires immediate attention.";
    render(<PriorityIndicator priority="Urgent" priorityReason={reason} />);
    expect(screen.getByText(reason)).toBeInTheDocument();
  });

  it("does not infer priority from the reason text", () => {
    // A reason that sounds urgent must not change which priority is shown.
    render(<PriorityIndicator priority="Low" priorityReason="This is extremely urgent and critical!" />);
    expect(screen.getByText(priorityDisplay("Low").label)).toBeInTheDocument();
    expect(screen.queryByText(priorityDisplay("Urgent").label)).not.toBeInTheDocument();
  });

  it("does not alter the supplied reason", () => {
    const reason = "  Exact wording, including odd spacing, must survive.  ".trim();
    render(<PriorityIndicator priority="Medium" priorityReason={reason} />);
    expect(screen.getByText(reason)).toBeInTheDocument();
  });
});
