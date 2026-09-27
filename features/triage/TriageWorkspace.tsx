"use client";

import { useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { RequestForm } from "./components/RequestForm";
import { TriageResultView } from "./components/TriageResultView";
import { useTriageSubmission } from "./state/useTriageSubmission";

/**
 * Page-level organism: the orchestration boundary between RequestForm,
 * useTriageSubmission and TriageResultView. It owns presentation of the
 * submission lifecycle (loading/success/error, previous-result retention,
 * the two live regions, focus management) — it owns no async state of its
 * own, no request text, and makes no category/priority/owner/escalation
 * decision. `useTriageSubmission` remains the single source of truth for
 * submission state; this file only renders it.
 */
export function TriageWorkspace() {
  const { state, submit } = useTriageSubmission();
  const errorRef = useRef<HTMLDivElement>(null);

  const isSubmitting = state.status === "submitting";
  const isError = state.status === "error";
  const isSuccess = state.status === "success";

  // Present while submitting or after an error; a success always replaces it.
  const previousResult = isSubmitting || isError ? state.previousResult : null;
  const visibleResult = isSuccess ? state.result : previousResult;
  const isDeEmphasized = isSubmitting && previousResult !== null;

  const statusMessage = isSubmitting ? "Analyzing request…" : isSuccess ? "Analysis complete." : "";
  const errorMessage = isError ? state.error.message : "";

  // Move focus to the visible error presentation only when a submission has
  // just entered the error state. A resubmission always passes back through
  // "submitting" first, so this also re-fires correctly on a later failure.
  useEffect(() => {
    if (isError) errorRef.current?.focus();
  }, [isError]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-text">TriageDesk</h1>

      <RequestForm onSubmit={submit} disabled={isSubmitting} />

      {/*
        The two permanently mounted live regions. They are never conditionally
        mounted/unmounted — only their text content changes — and they carry
        the only role="status"/role="alert" in this component. They are
        visually hidden because the visible loading indicator and visible
        error box below are separate, non-live-region elements serving
        sighted users and, for the error box, keyboard focus.
      */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {statusMessage}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {errorMessage}
      </div>

      {isSubmitting && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Spinner />
          <span>Analyzing request…</span>
        </div>
      )}

      {isError && (
        // Not a live region: the alert region above already announces this.
        // tabIndex={-1} makes it a script-focus target without adding it to
        // the normal Tab order. Styled directly from the Step 1 danger
        // tokens rather than InlineMessage, whose `role` prop is always
        // "status" or "alert" and would create a second alert region.
        <div
          ref={errorRef}
          tabIndex={-1}
          className="rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-sm text-status-danger-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <p className="font-medium">Something went wrong</p>
          <p>{errorMessage}</p>
        </div>
      )}

      {visibleResult && (
        <div data-deemphasized={isDeEmphasized} className={isDeEmphasized ? "opacity-60" : undefined}>
          <TriageResultView result={visibleResult} />
        </div>
      )}
    </main>
  );
}
