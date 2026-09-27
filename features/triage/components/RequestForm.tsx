"use client";

import { useId, useRef, useState, type FormEvent } from "react";

/**
 * Organism: owns only the editable request text and the submit interaction.
 * It knows nothing about category, priority, owner, evidence, escalation,
 * the API, triageClient, or submission state — that all belongs to the
 * parent TriageWorkspace, which is why the only way out of this component is
 * `onSubmit(text)`.
 */
export type RequestFormProps = {
  onSubmit: (text: string) => void;
  disabled?: boolean;
};

export function RequestForm({ onSubmit, disabled = false }: RequestFormProps) {
  const [text, setText] = useState("");
  const [hasError, setHasError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const textareaId = useId();
  const helpId = useId();
  const errorId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Client-side validation is limited to "is there any non-whitespace
    // text" — everything else (length limits, business rules) stays the
    // backend's job and is never duplicated here.
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setHasError(true);
      textareaRef.current?.focus();
      return;
    }

    setHasError(false);
    onSubmit(trimmed);
    // The draft is deliberately not cleared: the user may still want to
    // review or edit it, and the result belongs to the parent, not here.
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-2">
      <label htmlFor={textareaId} className="text-sm font-medium text-text">
        Customer request
      </label>
      <p id={helpId} className="text-sm text-text-muted">
        Paste the customer&rsquo;s request or issue here. The assistant will classify it and draft a response for
        review.
      </p>
      <textarea
        id={textareaId}
        ref={textareaRef}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          if (hasError) setHasError(false);
        }}
        disabled={disabled}
        rows={6}
        aria-describedby={hasError ? `${helpId} ${errorId}` : helpId}
        aria-invalid={hasError}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
      />
      {hasError && (
        <p id={errorId} className="text-sm text-status-danger-foreground">
          Enter a request before submitting.
        </p>
      )}
      <button
        type="submit"
        disabled={disabled}
        className="self-start rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        Analyze request
      </button>
    </form>
  );
}
