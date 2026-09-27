/**
 * Shared UI atom. A purely decorative loading indicator: it carries no
 * accessible name of its own (`aria-hidden`), because the announcement of
 * "in progress" is the caller's job via a live region (see InlineMessage),
 * not this element's. Respects prefers-reduced-motion.
 */
export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border-subtle border-t-text-muted motion-reduce:animate-none"
    />
  );
}
