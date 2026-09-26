import type { Evidence, VerifiedEvidence } from "./schema";

const CURLY_SINGLE = /[‘’‚‛′]/g;
const CURLY_DOUBLE = /[“”„‟″]/g;
const EDGE_PUNCTUATION = /^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu;

/**
 * Normalisation for comparing a quote with the request: casefold, straight
 * quotes, collapsed whitespace, no surrounding punctuation. Nothing fuzzy.
 */
export function normalizeForMatch(text: string): string {
  return text
    .replace(CURLY_SINGLE, "'")
    .replace(CURLY_DOUBLE, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(EDGE_PUNCTUATION, "");
}

/**
 * Model evidence is untrusted. Keep an item only if its normalised quote is
 * a verbatim substring of the normalised request. Unverifiable items are
 * dropped, never repaired. Kept items retain the model's original quote text.
 * The flags and reasoning they supported are unaffected by a drop.
 */
export function verifyEvidence(requestText: string, evidence: readonly Evidence[]): VerifiedEvidence[] {
  const haystack = normalizeForMatch(requestText);
  const verified: VerifiedEvidence[] = [];
  for (const item of evidence) {
    const needle = normalizeForMatch(item.quote);
    if (needle.length > 0 && haystack.includes(needle)) {
      verified.push({ for: item.for, quote: item.quote });
    }
  }
  return verified;
}
