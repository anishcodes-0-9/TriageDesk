// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DraftResponsePanel } from "../features/triage/components/DraftResponsePanel";

describe("DraftResponsePanel", () => {
  it("renders the draft response", () => {
    render(<DraftResponsePanel draftResponse="Thanks for reaching out. [Your name]" />);
    expect(screen.getByText("Thanks for reaching out. [Your name]")).toBeInTheDocument();
  });

  it("preserves the exact draft text", () => {
    const draft = "We are looking into this right away. [Your name]";
    render(<DraftResponsePanel draftResponse={draft} />);
    expect(screen.getByText(draft)).toBeInTheDocument();
  });

  it("does not perform any network/API interaction", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    render(<DraftResponsePanel draftResponse="A draft." />);

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("does not modify the supplied draft", () => {
    const draft = "  Exact wording and spacing.  ".trim();
    render(<DraftResponsePanel draftResponse={draft} />);
    expect(screen.getByText(draft)).toBeInTheDocument();
  });

  it("does not render as an interactive control that could send or edit the draft", () => {
    render(<DraftResponsePanel draftResponse="A draft." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
