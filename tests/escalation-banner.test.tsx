// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EscalationBanner } from "../features/triage/components/EscalationBanner";

describe("EscalationBanner", () => {
  it("renders nothing when there is no escalation", () => {
    const { container } = render(<EscalationBanner escalation={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the banner when an escalation is present", () => {
    render(
      <EscalationBanner escalation="Security/privacy escalation required: possible exposure of customer data." />,
    );
    expect(
      screen.getByText("Security/privacy escalation required: possible exposure of customer data."),
    ).toBeInTheDocument();
  });

  it("preserves the exact trusted escalation text", () => {
    const escalation = "Business-critical outage escalation: engineering has been paged.";
    render(<EscalationBanner escalation={escalation} />);
    expect(screen.getByText(escalation)).toBeInTheDocument();
  });

  it("cannot infer escalation from category/priority, since it accepts no such props", () => {
    // EscalationBannerProps is exactly `{ escalation: string | null }` — there
    // is no category/priority/evidence input to derive anything from. The
    // rendered output is therefore fully determined by `escalation` alone,
    // which the null/non-null cases above already exercise.
    render(<EscalationBanner escalation={null} />);
    expect(screen.queryByText(/technical|urgent|priority|category/i)).not.toBeInTheDocument();
  });

  it("does not create its own status or alert live region", () => {
    render(<EscalationBanner escalation="An escalation note." />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
