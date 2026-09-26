import type { EvalCase } from "./cases";
import { summariseCase, tallyDimensions, type RunRecord } from "./score";

export type RunMeta = {
  model: string;
  passesRequested: number;
  delayMs: number;
  startedAt: string;
  stoppedEarly: string | null;
};

const CAUSE_LABEL = {
  prompt_model_judgment: "prompt/model judgment",
  evidence_handling: "evidence handling",
  deterministic_policy: "deterministic policy",
  test_expectation: "test expectation problem",
} as const;

/**
 * Concise report. No overall score. Contains case ids and labels only, never
 * request text, summaries, drafts or evidence quotes.
 */
export function renderReport(cases: readonly EvalCase[], records: readonly RunRecord[], meta: RunMeta): string {
  const summaries = cases.map((c) => ({ testCase: c, summary: summariseCase(c.id, records) }));
  const count = (o: string) => summaries.filter((s) => s.summary.outcome === o).length;

  const lines: string[] = [];
  lines.push("# Evaluation report", "");
  lines.push(
    `Model \`${meta.model}\` · ${meta.passesRequested} pass(es) requested · ${meta.delayMs} ms between calls · started ${meta.startedAt}`,
    "",
  );
  lines.push(
    "Expectations are allowed sets checked against the final result after policy. \"conforms\" means the result is inside the allowed set; it is not an accuracy measure. Fields a case leaves unconstrained (for example needsReview) may still vary between passes; that shows up under stability, not as conformance.",
    "",
  );
  if (meta.stoppedEarly) lines.push(`> **Run stopped early:** ${meta.stoppedEarly}`, "");

  lines.push("## Summary", "");
  lines.push(`- Total cases: ${cases.length}`);
  lines.push(`- conforms: ${count("conforms")}`);
  lines.push(`- does_not_conform: ${count("does_not_conform")}`);
  lines.push(`- provider_failure (no completed pass): ${count("provider_failure")}`);
  lines.push(`- not_run: ${count("not_run")}`);
  lines.push(
    "- A case conforms only if every completed pass conforms on every applicable check.",
    "",
  );

  lines.push("## Dimensions (over all completed runs)", "", "| dimension | conforms | total |", "| --- | --- | --- |");
  for (const d of tallyDimensions(records)) lines.push(`| ${d.name} | ${d.conforms} | ${d.total} |`);
  lines.push("");

  const multi = summaries.filter((s) => s.summary.stability !== "not_applicable");
  lines.push("## Stability across repeated runs", "");
  if (multi.length === 0) {
    lines.push("Not measured: fewer than two completed passes.", "");
  } else {
    const stable = multi.filter((s) => s.summary.stability === "stable").length;
    lines.push(`- stable: ${stable} of ${multi.length} cases with two or more completed passes`);
    lines.push("- Stable means identical category, priority and needsReview in every completed pass.");
    for (const s of multi.filter((x) => x.summary.stability === "unstable")) {
      lines.push(`- unstable \`${s.testCase.id}\`: ${s.summary.observed.join("  vs  ")}`);
    }
    lines.push("");
  }

  lines.push("## Notable judgment failures", "");
  const failing = summaries.filter((s) => s.summary.outcome === "does_not_conform");
  if (failing.length === 0) lines.push("None.", "");
  for (const { testCase, summary } of failing) {
    lines.push(`### ${testCase.id} — ${testCase.label}`, "");
    const seen = new Set<string>();
    for (const f of summary.failedChecks) {
      const key = `${f.name}:${f.detail}`;
      const passes = summary.failedChecks.filter((x) => `${x.name}:${x.detail}` === key).map((x) => x.pass);
      if (seen.has(key)) continue;
      seen.add(key);
      const cause = f.cause ? CAUSE_LABEL[f.cause] : "unclassified";
      lines.push(`- \`${f.name}\` (pass ${passes.join(", ")}): ${f.detail} — suspected: ${cause}`);
    }
    lines.push(`- expectation basis: ${testCase.basis}`, "");
  }

  lines.push("## Provider failures and rate limits", "");
  const provider = records.filter((r) => r.status === "provider_failure");
  if (provider.length === 0 && !meta.stoppedEarly) lines.push("None.", "");
  for (const r of provider) if (r.status === "provider_failure") lines.push(`- ${r.caseId} pass ${r.pass}: ${r.errorCode}`);
  if (provider.length > 0) lines.push("");

  lines.push("## Per case", "", "| case | group | outcome | passes | stability | observed |", "| --- | --- | --- | --- | --- | --- |");
  for (const { testCase, summary } of summaries) {
    lines.push(
      `| ${testCase.id} | ${testCase.group} | ${summary.outcome} | ${summary.completedPasses} | ${summary.stability} | ${summary.observed.join("; ") || "-"} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
