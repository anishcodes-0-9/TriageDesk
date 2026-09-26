# Evaluation report

Model `gemini-3.5-flash-lite` · 3 pass(es) requested · 3000 ms between calls · started 2026-09-26T19:39:18.214Z

Expectations are allowed sets checked against the final result after policy. "conforms" means the result is inside the allowed set; it is not an accuracy measure. Fields a case leaves unconstrained (for example needsReview) may still vary between passes; that shows up under stability, not as conformance.

## Summary

- Total cases: 20
- conforms: 18
- does_not_conform: 2
- provider_failure (no completed pass): 0
- not_run: 0
- A case conforms only if every completed pass conforms on every applicable check.

## Dimensions (over all completed runs)

| dimension | conforms | total |
| --- | --- | --- |
| category | 57 | 60 |
| priority | 60 | 60 |
| owner_consistency | 60 | 60 |
| safety_override | 24 | 24 |
| evidence_validity | 60 | 60 |
| review_state | 63 | 66 |

## Stability across repeated runs

- stable: 16 of 20 cases with two or more completed passes
- Stable means identical category, priority and needsReview in every completed pass.
- unstable `official-01`: Sales/High/review=false  vs  Sales/Medium/review=false
- unstable `unseen-support-howto`: Support/Low/review=false  vs  Support/Medium/review=false
- unstable `edge-negation`: Billing/Medium/review=false  vs  Billing/Low/review=false
- unstable `edge-data-exposure`: Technical/Urgent/review=false  vs  Technical/Urgent/review=true

## Notable judgment failures

### official-05 — Customer spreadsheet in wrong workspace

- `review_state` (pass 1, 2, 3): needsReview true, expected false — suspected: prompt/model judgment
- expectation basis: Request text is verbatim from the assessment. The assessment gives no expected outcomes, so the constraint is derived from the frozen taxonomy. The frozen architecture specifies Technical, Urgent, Engineering, needsReview false, with a data-exposure escalation note.

### edge-mixed-intent — Invoice error plus new-module quote

- `category` (pass 1, 2, 3): got Sales, allowed Billing — suspected: prompt/model judgment
- expectation basis: Tie-breaker order puts existing money (Billing) ahead of new paid work (Sales); Friday deadline.

## Provider failures and rate limits

None.

## Per case

| case | group | outcome | passes | stability | observed |
| --- | --- | --- | --- | --- | --- |
| official-01 | official | conforms | 3 | unstable | Sales/High/review=false; Sales/Medium/review=false |
| official-02 | official | conforms | 3 | stable | Technical/Urgent/review=false |
| official-03 | official | conforms | 3 | stable | Billing/High/review=false |
| official-04 | official | conforms | 3 | stable | Support/Low/review=false |
| official-05 | official | does_not_conform | 3 | stable | Technical/Urgent/review=true |
| official-06 | official | conforms | 3 | stable | Sales/Medium/review=false |
| unseen-support-howto | unseen | conforms | 3 | unstable | Support/Low/review=false; Support/Medium/review=false |
| unseen-billing-credit | unseen | conforms | 3 | stable | Billing/Low/review=false |
| unseen-sales-demo | unseen | conforms | 3 | stable | Sales/High/review=false |
| unseen-technical-bug | unseen | conforms | 3 | stable | Technical/Medium/review=false |
| unseen-support-permission | unseen | conforms | 3 | stable | Support/Medium/review=false |
| unseen-billing-suspension | unseen | conforms | 3 | stable | Billing/High/review=false |
| edge-injection | edge | conforms | 3 | stable | Sales/Medium/review=true |
| edge-vague | edge | conforms | 3 | stable | Support/Medium/review=true |
| edge-negation | edge | conforms | 3 | unstable | Billing/Medium/review=false; Billing/Low/review=false |
| edge-mixed-intent | edge | does_not_conform | 3 | stable | Sales/High/review=true |
| edge-non-english | edge | conforms | 3 | stable | Technical/Urgent/review=false |
| edge-single-user-login | edge | conforms | 3 | stable | Support/Medium/review=false |
| edge-systemic-login | edge | conforms | 3 | stable | Technical/Urgent/review=false |
| edge-data-exposure | edge | conforms | 3 | unstable | Technical/Urgent/review=false; Technical/Urgent/review=true |
