// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge, type BadgeTone } from "../components/ui/Badge";

const TONES: BadgeTone[] = ["neutral", "info", "positive", "warning", "danger"];

describe("Badge", () => {
  it("renders the label", () => {
    render(<Badge label="Engineering" />);
    expect(screen.getByText("Engineering")).toBeInTheDocument();
  });

  it("defaults to the same presentation as an explicit neutral tone", () => {
    const { unmount } = render(<Badge label="Default" />);
    const defaultClassName = screen.getByText("Default").className;
    unmount();

    render(<Badge label="Explicit" tone="neutral" />);
    expect(screen.getByText("Explicit").className).toBe(defaultClassName);
  });

  it("gives every tone a visually distinct presentation", () => {
    const classNames = TONES.map((tone) => {
      const { unmount } = render(<Badge label={tone} tone={tone} />);
      const className = screen.getByText(tone).className;
      unmount();
      return className;
    });
    expect(new Set(classNames).size).toBe(TONES.length);
  });
});
