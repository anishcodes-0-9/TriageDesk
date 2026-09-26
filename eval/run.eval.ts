import { mkdirSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { getConfig } from "../lib/config";
import { TriageError } from "../lib/errors";
import { triage } from "../lib/triage";
import { CASES } from "./cases";
import { renderReport } from "./report";
import { scoreResult, verdictOf, type RunRecord } from "./score";

/**
 * Live evaluation through the real triage() pipeline. Sequential only.
 *
 *   npm run eval                          one pass, all cases
 *   EVAL_PASSES=3 npm run eval            three sequential passes
 *   EVAL_CASES=official-05,edge-vague npm run eval
 *   EVAL_DELAY_MS=6000 npm run eval       pause between calls (default 3000)
 *
 * Not part of `npm test`. Prints case ids and outcomes only, never request
 * text, prompts, model output or the API key.
 */

const RESULTS_DIR = "eval/results";

const intFromEnv = (name: string, fallback: number, min: number, max: number): number => {
  const raw = process.env[name];
  const n = raw === undefined ? fallback : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

it("runs the evaluation cases against the live pipeline", async () => {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local: rely on the ambient environment.
  }

  const passes = intFromEnv("EVAL_PASSES", 1, 1, 5);
  const delayMs = intFromEnv("EVAL_DELAY_MS", 3000, 0, 60_000);
  const only = process.env.EVAL_CASES?.split(",").map((s) => s.trim()).filter(Boolean);
  const cases = only ? CASES.filter((c) => only.includes(c.id)) : CASES;
  if (cases.length === 0) throw new Error("EVAL_CASES matched no cases.");

  const startedAt = new Date().toISOString();
  const records: RunRecord[] = [];
  let stoppedEarly: string | null = null;

  let config;
  try {
    config = getConfig();
  } catch (error) {
    const code = error instanceof TriageError ? error.code : "unknown";
    stoppedEarly = `Configuration error (${code}); no requests were made.`;
  }

  let calls = 0;
  outer: for (let pass = 1; pass <= passes; pass++) {
    for (const testCase of cases) {
      if (!config || stoppedEarly) {
        records.push({ caseId: testCase.id, pass, status: "not_run", reason: stoppedEarly ?? "not started" });
        continue;
      }

      if (calls++ > 0) await sleep(delayMs);
      const started = Date.now();
      try {
        const result = await triage(testCase.text, { config });
        const checks = scoreResult(testCase, result);
        const verdict = verdictOf(checks);
        records.push({
          caseId: testCase.id,
          pass,
          status: "completed",
          category: result.category,
          priority: result.priority,
          owner: result.owner,
          needsReview: result.needsReview,
          escalated: result.escalation !== null,
          adjustmentFields: result.adjustments.map((a) => a.field),
          evidenceCount: result.evidence.length,
          checks,
          verdict,
          durationMs: Date.now() - started,
        });
        console.log(
          `[pass ${pass}/${passes}] ${testCase.id.padEnd(24)} ${verdict.padEnd(16)} ${result.category}/${result.priority}/${result.owner}`,
        );
      } catch (error) {
        const errorCode = error instanceof TriageError ? error.code : "INTERNAL";
        records.push({ caseId: testCase.id, pass, status: "provider_failure", errorCode, durationMs: Date.now() - started });
        console.log(`[pass ${pass}/${passes}] ${testCase.id.padEnd(24)} provider_failure ${errorCode}`);
        if (errorCode === "RATE_LIMITED") {
          stoppedEarly = `Provider rate limit (RATE_LIMITED) at ${testCase.id}, pass ${pass}. Remaining runs were not attempted. Retry with a larger EVAL_DELAY_MS.`;
        } else if (errorCode === "CONFIGURATION_ERROR") {
          stoppedEarly = `Provider rejected the configured credentials or model at ${testCase.id}, pass ${pass}. Remaining runs were not attempted.`;
        }
        if (stoppedEarly) {
          // Record what did not run, then leave both loops.
          const remaining = cases.flatMap((c) => Array.from({ length: passes }, (_, i) => ({ c, p: i + 1 })));
          const done = new Set(records.map((r) => `${r.caseId}#${r.pass}`));
          for (const { c, p } of remaining) {
            if (!done.has(`${c.id}#${p}`)) records.push({ caseId: c.id, pass: p, status: "not_run", reason: stoppedEarly });
          }
          break outer;
        }
      }
    }
  }

  const report = renderReport(cases, records, {
    model: config?.model ?? "unknown",
    passesRequested: passes,
    delayMs,
    startedAt,
    stoppedEarly,
  });
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(`${RESULTS_DIR}/latest.json`, JSON.stringify({ startedAt, passes, records }, null, 2) + "\n");
  writeFileSync(`${RESULTS_DIR}/latest.md`, report);
  console.log(`\n${report}\nWrote ${RESULTS_DIR}/latest.md and latest.json`);
});
