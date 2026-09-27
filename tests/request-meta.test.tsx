// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequestMeta } from "../features/triage/components/RequestMeta";
import { categoryDisplay, ownerDisplay } from "../features/triage/display/triageDisplay";
import { CATEGORIES, OWNERS } from "../lib/taxonomy";

describe("RequestMeta", () => {
  it("renders the category", () => {
    render(<RequestMeta category="Technical" owner="Engineering" />);
    expect(screen.getByText("Technical")).toBeInTheDocument();
  });

  it("renders the owner", () => {
    render(<RequestMeta category="Technical" owner="Engineering" />);
    expect(screen.getByText("Engineering")).toBeInTheDocument();
  });

  it("uses the canonical display label from triageDisplay for the category and owner", () => {
    render(<RequestMeta category="Billing" owner="Finance" />);
    expect(screen.getByText(categoryDisplay("Billing").label)).toBeInTheDocument();
    expect(screen.getByText(ownerDisplay("Finance").label)).toBeInTheDocument();
  });

  it("handles every category", () => {
    for (const category of CATEGORIES) {
      const { unmount } = render(<RequestMeta category={category} owner="Engineering" />);
      expect(screen.getByText(categoryDisplay(category).label)).toBeInTheDocument();
      unmount();
    }
  });

  it("handles every owner", () => {
    for (const owner of OWNERS) {
      const { unmount } = render(<RequestMeta category="Technical" owner={owner} />);
      expect(screen.getByText(ownerDisplay(owner).label)).toBeInTheDocument();
      unmount();
    }
  });

  it("does not alter the supplied category/owner values", () => {
    render(<RequestMeta category="Sales" owner="Sales Team" />);
    // The category and owner values are canonical labels themselves, so
    // displaying them unaltered means the exact supplied strings appear.
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Sales Team")).toBeInTheDocument();
  });
});
