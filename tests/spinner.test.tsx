// @vitest-environment happy-dom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "../components/ui/Spinner";

describe("Spinner", () => {
  it("is decorative and carries no accessible name", () => {
    const { container } = render(<Spinner />);
    const spinner = container.querySelector("[aria-hidden='true']");
    expect(spinner).not.toBeNull();
  });

  it("respects prefers-reduced-motion", () => {
    const { container } = render(<Spinner />);
    const spinner = container.querySelector("[aria-hidden='true']");
    expect(spinner).toHaveClass("animate-spin", "motion-reduce:animate-none");
  });
});
