// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TriageClientError } from "../features/triage/api/triageClient";
import { useTriageSubmission } from "../features/triage/state/useTriageSubmission";
import { TriageWorkspace } from "../features/triage/TriageWorkspace";
import type { TriageResult } from "../lib/schema";

// Only the submission hook is mocked, so we can drive every lifecycle state
// deterministically. RequestForm, TriageResultView and every shared UI
// primitive render for real, so this test catches real integration/wiring
// mistakes, not just workspace-internal logic.
vi.mock("../features/triage/state/useTriageSubmission", () => ({
  useTriageSubmission: vi.fn(),
}));

const useTriageSubmissionMock = vi.mocked(useTriageSubmission);

function result(over: Partial<TriageResult> = {}): TriageResult {
  return {
    summary: "A customer reports a billing discrepancy.",
    category: "Billing",
    priority: "Medium",
    priorityReason: "No urgent impact stated.",
    owner: "Finance",
    needsReview: false,
    reviewReason: null,
    evidence: [],
    draftResponse: "Thanks for reaching out. [Your name]",
    adjustments: [],
    escalation: null,
    ...over,
  };
}

beforeEach(() => {
  useTriageSubmissionMock.mockReset();
});

describe("TriageWorkspace", () => {
  it("renders the initial idle state: form visible, no result, both live regions mounted and empty", () => {
    const submit = vi.fn();
    useTriageSubmissionMock.mockReturnValue({ state: { status: "idle" }, submit });
    render(<TriageWorkspace />);

    expect(screen.getByRole("textbox", { name: "Customer request" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Analysis result" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");
    expect(screen.getByRole("alert")).toHaveTextContent("");
  });

  it("disables the form and announces loading while submitting, with a visible spinner", () => {
    const submit = vi.fn();
    useTriageSubmissionMock.mockReturnValue({ state: { status: "submitting", previousResult: null }, submit });
    const { container } = render(<TriageWorkspace />);

    expect(screen.getByRole("textbox", { name: "Customer request" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Analyze request" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Analyzing request…");
    // The status region text is duplicated by a separate, non-live visible
    // indicator next to the (decorative, aria-hidden) spinner.
    expect(screen.getAllByText("Analyzing request…")).toHaveLength(2);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("shows the result and 'Analysis complete.' after a first successful submission", () => {
    const submit = vi.fn();
    const resultA = result({ summary: "Result A" });
    useTriageSubmissionMock.mockReturnValue({ state: { status: "success", result: resultA }, submit });
    render(<TriageWorkspace />);

    expect(screen.getByRole("heading", { name: "Analysis result" })).toBeInTheDocument();
    expect(screen.getByText("Result A")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Analysis complete.");
    expect(screen.getByRole("alert")).toHaveTextContent("");
  });

  it("de-emphasizes the previous result while resubmitting, then replaces it on success", () => {
    const submit = vi.fn();
    const resultA = result({ summary: "Result A" });
    const resultB = result({ summary: "Result B" });

    useTriageSubmissionMock.mockReturnValue({ state: { status: "success", result: resultA }, submit });
    const { rerender } = render(<TriageWorkspace />);
    expect(screen.getByText("Result A")).toBeInTheDocument();

    useTriageSubmissionMock.mockReturnValue({ state: { status: "submitting", previousResult: resultA }, submit });
    rerender(<TriageWorkspace />);

    expect(screen.getByRole("textbox", { name: "Customer request" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Analyzing request…");
    const wrapperWhileSubmitting = screen.getByText("Result A").closest("[data-deemphasized]");
    expect(wrapperWhileSubmitting).toHaveAttribute("data-deemphasized", "true");

    useTriageSubmissionMock.mockReturnValue({ state: { status: "success", result: resultB }, submit });
    rerender(<TriageWorkspace />);

    expect(screen.getByText("Result B")).toBeInTheDocument();
    expect(screen.queryByText("Result A")).not.toBeInTheDocument();
    expect(screen.getByText("Result B").closest("[data-deemphasized]")).toHaveAttribute(
      "data-deemphasized",
      "false",
    );
  });

  it("shows a focused visible error and no result after a first failed submission, and re-enables the form", () => {
    const submit = vi.fn();
    const error = new TriageClientError("The service is busy. Please try again shortly.", "RATE_LIMITED");
    useTriageSubmissionMock.mockReturnValue({ state: { status: "error", error, previousResult: null }, submit });
    render(<TriageWorkspace />);

    expect(screen.queryByRole("heading", { name: "Analysis result" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(error.message);

    const errorHeading = screen.getByText("Something went wrong");
    const errorContainer = errorHeading.parentElement as HTMLElement;
    expect(errorContainer).toHaveFocus();
    expect(errorContainer).toHaveAttribute("tabindex", "-1");

    expect(screen.getByRole("textbox", { name: "Customer request" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Analyze request" })).not.toBeDisabled();
  });

  it("keeps the previous result normally emphasized and shows a new error on a failed resubmission", () => {
    const submit = vi.fn();
    const resultA = result({ summary: "Result A" });
    useTriageSubmissionMock.mockReturnValue({ state: { status: "success", result: resultA }, submit });
    const { rerender } = render(<TriageWorkspace />);

    const errorB = new TriageClientError("Something went wrong. Please try again.");
    useTriageSubmissionMock.mockReturnValue({
      state: { status: "error", error: errorB, previousResult: resultA },
      submit,
    });
    rerender(<TriageWorkspace />);

    expect(screen.getByText("Result A")).toBeInTheDocument();
    expect(screen.getByText("Result A").closest("[data-deemphasized]")).toHaveAttribute(
      "data-deemphasized",
      "false",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(errorB.message);
    const errorContainer = screen.getByText("Something went wrong").parentElement as HTMLElement;
    expect(errorContainer).toHaveFocus();
  });

  it("clears the visible error and status once a new submission starts", () => {
    const submit = vi.fn();
    const error = new TriageClientError("fail");
    useTriageSubmissionMock.mockReturnValue({ state: { status: "error", error, previousResult: null }, submit });
    const { rerender } = render(<TriageWorkspace />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    useTriageSubmissionMock.mockReturnValue({ state: { status: "submitting", previousResult: null }, submit });
    rerender(<TriageWorkspace />);

    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Analyzing request…");
    expect(screen.getByRole("alert")).toHaveTextContent("");
  });

  it("has exactly one status region and one alert region, and no others", () => {
    const submit = vi.fn();
    useTriageSubmissionMock.mockReturnValue({ state: { status: "idle" }, submit });
    render(<TriageWorkspace />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("does not move focus away from the submit button on a successful submission", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    useTriageSubmissionMock.mockReturnValue({ state: { status: "idle" }, submit });
    const { rerender } = render(<TriageWorkspace />);

    await user.type(screen.getByRole("textbox", { name: "Customer request" }), "Help me");
    const submitButton = screen.getByRole("button", { name: "Analyze request" });
    await user.click(submitButton);

    expect(submit).toHaveBeenCalledWith("Help me");

    useTriageSubmissionMock.mockReturnValue({ state: { status: "success", result: result() }, submit });
    rerender(<TriageWorkspace />);

    expect(submitButton).toHaveFocus();
  });

  it("never calls submit itself in response to a state change", () => {
    const submit = vi.fn();
    useTriageSubmissionMock.mockReturnValue({ state: { status: "idle" }, submit });
    const { rerender } = render(<TriageWorkspace />);

    useTriageSubmissionMock.mockReturnValue({ state: { status: "submitting", previousResult: null }, submit });
    rerender(<TriageWorkspace />);
    useTriageSubmissionMock.mockReturnValue({
      state: { status: "error", error: new TriageClientError("x"), previousResult: null },
      submit,
    });
    rerender(<TriageWorkspace />);
    useTriageSubmissionMock.mockReturnValue({ state: { status: "success", result: result() }, submit });
    rerender(<TriageWorkspace />);

    expect(submit).not.toHaveBeenCalled();
  });

  it("disables RequestForm only while submitting", () => {
    const submit = vi.fn();

    useTriageSubmissionMock.mockReturnValue({ state: { status: "idle" }, submit });
    const { rerender } = render(<TriageWorkspace />);
    expect(screen.getByRole("textbox", { name: "Customer request" })).not.toBeDisabled();

    useTriageSubmissionMock.mockReturnValue({ state: { status: "submitting", previousResult: null }, submit });
    rerender(<TriageWorkspace />);
    expect(screen.getByRole("textbox", { name: "Customer request" })).toBeDisabled();

    useTriageSubmissionMock.mockReturnValue({ state: { status: "success", result: result() }, submit });
    rerender(<TriageWorkspace />);
    expect(screen.getByRole("textbox", { name: "Customer request" })).not.toBeDisabled();

    useTriageSubmissionMock.mockReturnValue({
      state: { status: "error", error: new TriageClientError("x"), previousResult: null },
      submit,
    });
    rerender(<TriageWorkspace />);
    expect(screen.getByRole("textbox", { name: "Customer request" })).not.toBeDisabled();
  });

  it("passes the exact trusted result to TriageResultView", () => {
    const submit = vi.fn();
    const r = result({ summary: "Very specific summary text" });
    useTriageSubmissionMock.mockReturnValue({ state: { status: "success", result: r }, submit });
    render(<TriageWorkspace />);

    expect(screen.getByText("Very specific summary text")).toBeInTheDocument();
    expect(screen.getByText(r.draftResponse)).toBeInTheDocument();
  });

  it("preserves the previous result's exact content while a resubmission is in flight", () => {
    const submit = vi.fn();
    const resultA = result({ summary: "Distinctive Result A summary", draftResponse: "Distinctive draft A" });
    useTriageSubmissionMock.mockReturnValue({ state: { status: "submitting", previousResult: resultA }, submit });
    render(<TriageWorkspace />);

    expect(screen.getByText("Distinctive Result A summary")).toBeInTheDocument();
    expect(screen.getByText("Distinctive draft A")).toBeInTheDocument();
  });
});
