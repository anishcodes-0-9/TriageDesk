import type { ReactNode } from "react";
import { TONE_CLASSES, type BadgeTone } from "./Badge";

/**
 * Shared UI molecule. A tone-styled message row, used for both the workflow's
 * single polite status announcement ("status") and its single assertive
 * error announcement ("alert") — see the locked accessibility architecture.
 * `role="status"`/`role="alert"` already imply the correct aria-live
 * behavior, so no separate aria-live prop is needed.
 */
export type InlineMessageRole = "status" | "alert";

export type InlineMessageProps = {
  role: InlineMessageRole;
  tone?: BadgeTone;
  children: ReactNode;
};

export function InlineMessage({ role, tone = "neutral", children }: InlineMessageProps) {
  return (
    <div role={role} className={`rounded-md border px-3 py-2 text-sm ${TONE_CLASSES[tone]}`}>
      {children}
    </div>
  );
}
