import { describe, expect, it } from "vitest";
import {
  categoryDisplay,
  ownerDisplay,
  priorityDisplay,
  reviewDisplay,
} from "../features/triage/display/triageDisplay";
import { CATEGORIES, OWNERS, PRIORITIES } from "../lib/taxonomy";

// Pure presentation-adapter tests only. No React, no DOM, no fetch — matching
// the plain-logic test style already used for lib/*.

describe("categoryDisplay", () => {
  it("labels every category with its own name", () => {
    for (const category of CATEGORIES) {
      expect(categoryDisplay(category).label).toBe(category);
    }
  });

  it("gives every category the same, lowest-emphasis tone", () => {
    for (const category of CATEGORIES) {
      expect(categoryDisplay(category).tone).toBe("neutral");
    }
  });
});

describe("priorityDisplay", () => {
  it("labels every priority with its own name", () => {
    for (const priority of PRIORITIES) {
      expect(priorityDisplay(priority).label).toBe(priority);
    }
  });

  it("scales tone with severity", () => {
    expect(priorityDisplay("Urgent").tone).toBe("danger");
    expect(priorityDisplay("High").tone).toBe("warning");
    expect(priorityDisplay("Medium").tone).toBe("info");
    expect(priorityDisplay("Low").tone).toBe("neutral");
  });

  it("gives every priority a distinct tone", () => {
    const tones = PRIORITIES.map((priority) => priorityDisplay(priority).tone);
    expect(new Set(tones).size).toBe(PRIORITIES.length);
  });
});

describe("ownerDisplay", () => {
  it("has a mapping for every supported owner", () => {
    for (const owner of OWNERS) {
      expect(ownerDisplay(owner)).toBeDefined();
    }
  });

  it("preserves the canonical owner label", () => {
    for (const owner of OWNERS) {
      expect(ownerDisplay(owner).label).toBe(owner);
    }
  });

  it("gives every owner the same, lowest-emphasis tone", () => {
    for (const owner of OWNERS) {
      expect(ownerDisplay(owner).tone).toBe("neutral");
    }
  });
});

describe("reviewDisplay", () => {
  it("marks needsReview true as requiring attention", () => {
    expect(reviewDisplay(true)).toEqual({ label: "Needs review", tone: "warning" });
  });

  it("marks needsReview false as the default, low-emphasis state", () => {
    expect(reviewDisplay(false)).toEqual({ label: "No review needed", tone: "neutral" });
  });

  it("never gives both states the same tone", () => {
    expect(reviewDisplay(true).tone).not.toBe(reviewDisplay(false).tone);
  });
});
