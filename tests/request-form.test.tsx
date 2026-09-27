// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RequestForm } from "../features/triage/components/RequestForm";

describe("RequestForm", () => {
  it("renders an accessible label and textarea", () => {
    render(<RequestForm onSubmit={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Customer request" })).toBeInTheDocument();
  });

  it("renders a submit button", () => {
    render(<RequestForm onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Analyze request" })).toBeInTheDocument();
  });

  it("lets the user type and edit the request", async () => {
    const user = userEvent.setup();
    render(<RequestForm onSubmit={vi.fn()} />);

    const textarea = screen.getByRole("textbox", { name: "Customer request" });
    await user.type(textarea, "My request is broken");

    expect(textarea).toHaveValue("My request is broken");
  });

  it("calls onSubmit exactly once with the trimmed text on a valid submission", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RequestForm onSubmit={onSubmit} />);

    await user.type(screen.getByRole("textbox", { name: "Customer request" }), "   My request is broken   ");
    await user.click(screen.getByRole("button", { name: "Analyze request" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("My request is broken");
  });

  it("does not call onSubmit for whitespace-only input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RequestForm onSubmit={onSubmit} />);

    await user.type(screen.getByRole("textbox", { name: "Customer request" }), "   ");
    await user.click(screen.getByRole("button", { name: "Analyze request" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("gives an accessible validation indication for an empty/whitespace submission", async () => {
    const user = userEvent.setup();
    render(<RequestForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Analyze request" }));

    const textarea = screen.getByRole("textbox", { name: "Customer request" });
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter a request before submitting.")).toBeInTheDocument();
  });

  it("allows submission after entering a valid request following an invalid submission", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RequestForm onSubmit={onSubmit} />);

    const textarea = screen.getByRole("textbox", { name: "Customer request" });
    const submit = screen.getByRole("button", { name: "Analyze request" });

    await user.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(textarea, "Now this has real content");
    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledWith("Now this has real content");
  });

  it("disables the textarea and submit button when disabled is true", () => {
    render(<RequestForm onSubmit={vi.fn()} disabled />);

    expect(screen.getByRole("textbox", { name: "Customer request" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Analyze request" })).toBeDisabled();
  });

  it("prevents submission when disabled is true", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RequestForm onSubmit={onSubmit} disabled />);

    await user.click(screen.getByRole("button", { name: "Analyze request" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the draft in the textarea after a successful submit", async () => {
    const user = userEvent.setup();
    render(<RequestForm onSubmit={vi.fn()} />);

    const textarea = screen.getByRole("textbox", { name: "Customer request" });
    await user.type(textarea, "Please help");
    await user.click(screen.getByRole("button", { name: "Analyze request" }));

    expect(textarea).toHaveValue("Please help");
  });

  it("does not create its own status or alert live region", () => {
    render(<RequestForm onSubmit={vi.fn()} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
