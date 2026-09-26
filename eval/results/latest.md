# Evaluation report

Model `gemini-3.5-flash-lite` · 3 pass(es) requested · 6000 ms between calls · started 2026-09-26T20:19:18.802Z

Expectations are allowed sets checked against the final result after policy. "conforms" means the result is inside the allowed set; it is not an accuracy measure. Fields a case leaves unconstrained (for example needsReview) may still vary between passes; that shows up under stability, not as conformance.

## Summary

- Total cases: 20
- conforms: 20
- does_not_conform: 0
- provider_failure (no completed pass): 0
- not_run: 0
- A case conforms only if every completed pass conforms on every applicable check.

## Dimensions (over all completed runs)

| dimension | conforms | total |
| --- | --- | --- |
| category | 58 | 58 |
| priority | 58 | 58 |
| owner_consistency | 58 | 58 |
| safety_override | 24 | 24 |
| evidence_validity | 58 | 58 |
| review_state | 64 | 64 |

## Stability across repeated runs

- stable: 18 of 20 cases with two or more completed passes
- Stable means identical category, priority and needsReview in every completed pass.
- unstable `unseen-billing-suspension`: Billing/High/review=false  vs  Billing/Urgent/review=true
- unstable `edge-negation`: Billing/Low/review=false  vs  Billing/Medium/review=false

## Notable judgment failures

None.

## Provider failures and rate limits

- official-04 pass 1: PROVIDER_TIMEOUT
- edge-mixed-intent pass 2: PROVIDER_TIMEOUT

## Per case

| case | group | outcome | passes | stability | observed |
| --- | --- | --- | --- | --- | --- |
| official-01 | official | conforms | 3 | stable | Sales/High/review=false |
| official-02 | official | conforms | 3 | stable | Technical/Urgent/review=false |
| official-03 | official | conforms | 3 | stable | Billing/High/review=false |
| official-04 | official | conforms | 2 | stable | Support/Low/review=false |
| official-05 | official | conforms | 3 | stable | Technical/Urgent/review=false |
| official-06 | official | conforms | 3 | stable | Sales/Medium/review=false |
| unseen-support-howto | unseen | conforms | 3 | stable | Support/Medium/review=false |
| unseen-billing-credit | unseen | conforms | 3 | stable | Billing/Low/review=false |
| unseen-sales-demo | unseen | conforms | 3 | stable | Sales/High/review=false |
| unseen-technical-bug | unseen | conforms | 3 | stable | Technical/Medium/review=false |
| unseen-support-permission | unseen | conforms | 3 | stable | Support/Medium/review=false |
| unseen-billing-suspension | unseen | conforms | 3 | unstable | Billing/High/review=false; Billing/Urgent/review=true |
| edge-injection | edge | conforms | 3 | stable | Sales/Medium/review=true |
| edge-vague | edge | conforms | 3 | stable | Support/Medium/review=true |
| edge-negation | edge | conforms | 3 | unstable | Billing/Low/review=false; Billing/Medium/review=false |
| edge-mixed-intent | edge | conforms | 2 | stable | Billing/High/review=true |
| edge-non-english | edge | conforms | 3 | stable | Technical/Urgent/review=false |
| edge-single-user-login | edge | conforms | 3 | stable | Support/Medium/review=false |
| edge-systemic-login | edge | conforms | 3 | stable | Technical/Urgent/review=false |
| edge-data-exposure | edge | conforms | 3 | stable | Technical/Urgent/review=false |
