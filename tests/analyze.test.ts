import { describe, expect, it } from "vitest";
import { normalizeForMatch, verifyEvidence } from "../lib/analyze";
import type { Evidence } from "../lib/schema";

const request =
  "The client portal has been unavailable since this morning and our staff cannot access active customer records. Please help as soon as possible.";

const ev = (quote: string, target: Evidence["for"] = "priority"): Evidence => ({ for: target, quote });
const quotes = (list: readonly { quote: string }[]) => list.map((e) => e.quote);

describe("verifyEvidence: verification", () => {
  it("keeps a verbatim quote", () => {
    const item = ev("portal has been unavailable", "criticalOutage");
    expect(verifyEvidence(request, [item])).toEqual([item]);
  });

  it("keeps the model's original quote text, not the normalised form", () => {
    const [kept] = verifyEvidence(request, [ev("  As Soon As Possible. ")]);
    expect(kept?.quote).toBe("  As Soon As Possible. ");
  });

  it("drops a quote that is not in the request", () => {
    expect(verifyEvidence(request, [ev("the database was deleted")])).toEqual([]);
  });

  it("drops paraphrases, reordered words and near-misses (no fuzzy matching)", () => {
    const items = [
      ev("portal was unavailable"),
      ev("unavailable portal has been the"),
      ev("staff can not access"),
      ev("portal has been unavailable since this evening"),
    ];
    expect(verifyEvidence(request, items)).toEqual([]);
  });

  it("drops a quote that only matches with ellipsis or extra words", () => {
    expect(verifyEvidence(request, [ev("portal ... unavailable")])).toEqual([]);
  });

  it("drops a quote that normalises to nothing", () => {
    expect(verifyEvidence(request, [ev("...")])).toEqual([]);
    expect(verifyEvidence(request, [ev("   ")])).toEqual([]);
  });

  it("handles multiple items, keeping only the verifiable ones in order", () => {
    const items = [
      ev("cannot access active customer records", "criticalOutage"),
      ev("this was invented"),
      ev("as soon as possible"),
    ];
    expect(quotes(verifyEvidence(request, items))).toEqual([
      "cannot access active customer records",
      "as soon as possible",
    ]);
  });

  it("returns an empty list for empty evidence", () => {
    expect(verifyEvidence(request, [])).toEqual([]);
  });

  it("preserves each of the three allowed 'for' values", () => {
    const text = "Customer emails were sent to the wrong workspace and the portal is down. Fix it today.";
    const items = [
      ev("wrong workspace", "dataExposure"),
      ev("the portal is down", "criticalOutage"),
      ev("fix it today", "priority"),
    ];
    expect(verifyEvidence(text, items).map((e) => e.for)).toEqual(["dataExposure", "criticalOutage", "priority"]);
  });

  it("does not mutate its inputs", () => {
    const items = [ev("As Soon As Possible."), ev("invented")];
    const before = structuredClone(items);
    verifyEvidence(request, items);
    expect(items).toEqual(before);
  });
});

describe("verifyEvidence: normalisation", () => {
  it("is case-insensitive in both directions", () => {
    expect(verifyEvidence(request, [ev("PORTAL HAS BEEN UNAVAILABLE")])).toHaveLength(1);
    expect(verifyEvidence("URGENT: PLEASE HELP", [ev("please help")])).toHaveLength(1);
  });

  it("normalises whitespace, including newlines and tabs, on either side", () => {
    expect(verifyEvidence(request, [ev("portal   has\tbeen\nunavailable")])).toHaveLength(1);
    expect(verifyEvidence("Please\n\n  help   us\tnow", [ev("please help us now")])).toHaveLength(1);
  });

  it("matches curly quotes in the request against straight quotes in the quote", () => {
    const text = "We can’t log in and the “billing” page won’t load.";
    expect(verifyEvidence(text, [ev("we can't log in")])).toHaveLength(1);
    expect(verifyEvidence(text, [ev('the "billing" page')])).toHaveLength(1);
  });

  it("matches straight quotes in the request against curly quotes in the quote", () => {
    const text = `We can't log in and the "billing" page won't load.`;
    expect(verifyEvidence(text, [ev("we can’t log in")])).toHaveLength(1);
    expect(verifyEvidence(text, [ev("the “billing” page")])).toHaveLength(1);
  });

  it("trims surrounding punctuation and quote marks from the quote", () => {
    for (const q of ["unavailable.", "...unavailable", "“unavailable”", "(unavailable)", "  , unavailable ! "]) {
      expect(verifyEvidence(request, [ev(q)]), q).toHaveLength(1);
    }
  });

  it("trims trailing punctuation that the request has but the quote lacks", () => {
    expect(verifyEvidence(request, [ev("as soon as possible")])).toHaveLength(1);
    expect(verifyEvidence("Help now!!!", [ev("help now")])).toHaveLength(1);
  });

  it("does not remove punctuation inside a quote", () => {
    expect(verifyEvidence("Invoice NS-1048 is wrong", [ev("invoice ns-1048")])).toHaveLength(1);
    expect(verifyEvidence("Invoice NS-1048 is wrong", [ev("invoice ns 1048")])).toEqual([]);
  });
});

describe("normalizeForMatch", () => {
  it("applies casefold, quote, whitespace and edge-punctuation rules", () => {
    expect(normalizeForMatch("  “Don’t   PANIC!” ")).toBe("don't panic");
  });
});
