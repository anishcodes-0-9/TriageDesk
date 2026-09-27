# Evaluation report

Model `gemini-3.5-flash-lite` · 3 pass(es) requested · 3000 ms between calls · started 2026-09-27T08:10:43.393Z

Expectations are allowed sets checked against the final result after policy. "conforms" means the result is inside the allowed set; it is not an accuracy measure. Fields a case leaves unconstrained (for example needsReview) may still vary between passes; that shows up under stability, not as conformance.

## Summary

- Total cases: 21
- conforms: 20
- does_not_conform: 1
- provider_failure (no completed pass): 0
- not_run: 0
- A case conforms only if every completed pass conforms on every applicable check.

## Dimensions (over all completed runs)

| dimension | conforms | total |
| --- | --- | --- |
| category | 62 | 62 |
| priority | 61 | 62 |
| owner_consistency | 62 | 62 |
| safety_override | 24 | 24 |
| evidence_validity | 62 | 62 |
| review_state | 71 | 71 |

## Stability across repeated runs

- stable: 19 of 21 cases with two or more completed passes
- Stable means identical category, priority and needsReview in every completed pass.
- unstable `unseen-technical-bug`: Technical/Medium/review=false  vs  Technical/Low/review=false
- unstable `edge-negation`: Billing/Low/review=false  vs  Billing/Medium/review=false

## Notable judgment failures

### unseen-technical-bug — Non-blocking export bug with workaround

- `priority` (pass 3): got Low, allowed Medium | High — suspected: prompt/model judgment
- expectation basis: Defect in our system is Technical; non-blocking bug is Medium, impaired with workaround is High.

## Provider failures and rate limits

- official-03 pass 1: PROVIDER_TIMEOUT

## Per case

| case | group | outcome | passes | stability | observed |
| --- | --- | --- | --- | --- | --- |
| official-01 | official | conforms | 3 | stable | Sales/High/review=false |
| official-02 | official | conforms | 3 | stable | Technical/Urgent/review=false |
| official-03 | official | conforms | 2 | stable | Billing/High/review=false |
| official-04 | official | conforms | 3 | stable | Support/Low/review=false |
| official-05 | official | conforms | 3 | stable | Technical/Urgent/review=false |
| official-06 | official | conforms | 3 | stable | Sales/Medium/review=false |
| unseen-support-howto | unseen | conforms | 3 | stable | Support/Medium/review=false |
| unseen-billing-credit | unseen | conforms | 3 | stable | Billing/Low/review=false |
| unseen-sales-demo | unseen | conforms | 3 | stable | Sales/High/review=false |
| unseen-technical-bug | unseen | does_not_conform | 3 | unstable | Technical/Medium/review=false; Technical/Low/review=false |
| unseen-support-permission | unseen | conforms | 3 | stable | Support/Medium/review=false |
| unseen-billing-suspension | unseen | conforms | 3 | stable | Billing/High/review=false |
| edge-injection | edge | conforms | 3 | stable | Sales/Medium/review=true |
| edge-vague | edge | conforms | 3 | stable | Support/Medium/review=true |
| edge-negation | edge | conforms | 3 | unstable | Billing/Low/review=false; Billing/Medium/review=false |
| edge-mixed-intent | edge | conforms | 3 | stable | Billing/High/review=true |
| edge-non-english | edge | conforms | 3 | stable | Technical/Urgent/review=false |
| edge-single-user-login | edge | conforms | 3 | stable | Support/Medium/review=false |
| edge-systemic-login | edge | conforms | 3 | stable | Technical/Urgent/review=false |
| edge-data-exposure | edge | conforms | 3 | stable | Technical/Urgent/review=false |
| edge-recruiting | edge | conforms | 3 | stable | Other/Low/review=true |
