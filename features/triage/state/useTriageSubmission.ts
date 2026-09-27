import { useCallback, useEffect, useReducer, useRef } from "react";
import type { TriageResult } from "@/lib/schema";
import { triage, TriageClientError } from "../api/triageClient";

/**
 * The submission lifecycle for one triage workflow: idle -> submitting ->
 * success | error, with resubmission always re-entering submitting. A plain
 * useReducer state machine — no external state library. This hook owns only
 * "is a request in flight, did it succeed or fail" — it never renders
 * anything and never interprets what a TriageResult means.
 *
 * A resubmission (from success or error) keeps the previous result on the
 * submitting/error states so a caller can show it de-emphasized while a new
 * one loads, and restore it in full if the new submission fails; a
 * successful resolution always replaces it outright.
 */
export type TriageSubmissionState =
  | { status: "idle" }
  | { status: "submitting"; previousResult: TriageResult | null }
  | { status: "success"; result: TriageResult }
  | { status: "error"; error: TriageClientError; previousResult: TriageResult | null };

type Action =
  | { type: "submit" }
  | { type: "resolve"; result: TriageResult }
  | { type: "reject"; error: TriageClientError };

const INITIAL_STATE: TriageSubmissionState = { status: "idle" };

function previousResultOf(state: TriageSubmissionState): TriageResult | null {
  if (state.status === "success") return state.result;
  if (state.status === "submitting" || state.status === "error") return state.previousResult;
  return null;
}

function reducer(state: TriageSubmissionState, action: Action): TriageSubmissionState {
  switch (action.type) {
    case "submit":
      return { status: "submitting", previousResult: previousResultOf(state) };
    case "resolve":
      return { status: "success", result: action.result };
    case "reject":
      return { status: "error", error: action.error, previousResult: previousResultOf(state) };
    default:
      return state;
  }
}

function isAbortError(err: unknown): err is DOMException {
  return err instanceof DOMException && err.name === "AbortError";
}

export function useTriageSubmission() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);

  // Cancel any in-flight request if the hook unmounts.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const submit = useCallback((text: string) => {
    // A new submission supersedes whatever is in flight. Aborting the
    // previous request (rather than letting it run to completion) is not a
    // retry — it only prevents an older, slower response from resolving
    // after and overwriting a newer submission's result.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    dispatch({ type: "submit" });

    triage({ text, signal: controller.signal }).then(
      (result) => {
        if (controllerRef.current !== controller) return; // superseded
        dispatch({ type: "resolve", result });
      },
      (error: unknown) => {
        if (controllerRef.current !== controller) return; // superseded
        if (isAbortError(error)) return; // cancelled, not a real failure
        dispatch({ type: "reject", error: error as TriageClientError });
      },
    );
  }, []);

  return { state, submit };
}
