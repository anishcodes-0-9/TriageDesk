// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineMessage } from "../components/ui/InlineMessage";

describe("InlineMessage", () => {
  it("renders its children with the status role", () => {
    render(<InlineMessage role="status">Analyzing request…</InlineMessage>);
    expect(screen.getByRole("status")).toHaveTextContent("Analyzing request…");
  });

  it("renders its children with the alert role", () => {
    render(<InlineMessage role="alert">Something went wrong.</InlineMessage>);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong.");
  });

  it("defaults to the same presentation as an explicit neutral tone", () => {
    const { unmount } = render(<InlineMessage role="status">Default</InlineMessage>);
    const defaultClassName = screen.getByRole("status").className;
    unmount();

    render(
      <InlineMessage role="status" tone="neutral">
        Explicit
      </InlineMessage>,
    );
    expect(screen.getByRole("status").className).toBe(defaultClassName);
  });

  it("gives tone a presentation independent of role, distinct from the default", () => {
    const { unmount } = render(<InlineMessage role="status">Neutral</InlineMessage>);
    const neutralClassName = screen.getByRole("status").className;
    unmount();

    render(
      <InlineMessage role="alert" tone="danger">
        Failed
      </InlineMessage>,
    );
    expect(screen.getByRole("alert").className).not.toBe(neutralClassName);
  });
});
