# Offline repair analysis for the final Foundry evaluation

## Evidence captured before repairs

The frozen evaluation at `3a25db2ca146712939371ca9b7e2cfcacab20ce2` made 18 upstream calls. The evaluation ledger preserves all submitted text/settings, validated responses, API errors, usage telemetry, and the accepted A12 interpretation. It does **not** preserve raw Foundry structured-output payloads for requests rejected by validation. For those attempts the precise submitted claim fields cannot be reconstructed from the available evidence; the validation message identifies the failing contract check, but not which individual field triggered it.

No live calls will be made during this repair. Regressions derived from rejected attempts therefore use the exact captured request and failure class, with an offline constructed interpretation to exercise the identified boundary. They are not represented as recovered raw model output or as new evaluation holdouts.

## Failure table

| Attempt | Exact input | Captured provider output / API result | Failure analysis |
|---|---|---|---|
| A04 | “Amad didn’t complete passes at a higher rate than Saka, did he?” | HTTP 502 `semantic-validation`: `Claim 1 intent does not match its evidence request.` Raw provider claim not retained. | The model response reached the semantic validator, but at least one relationship among comparison intent/operator, player metric, and required evidence was inconsistent. The available log does not identify which field. The intended deterministic result is Amad 2/3 (66.7%) versus Saka 2/4 (50%); the negative-tag proposition is contradicted. |
| A06 | “Did Eastport cover more ground than Northbridge?” | HTTP 502 `semantic-validation`: `Claim 1 time period is invalid or references an unavailable event.` Raw provider claim not retained. | The interpreted period failed event-boundary validation before the unavailable-measurement response could be produced. Running distance is not recorded; no event anchor is needed to explain that limitation. Entity/metric details of the rejected response were not captured and cannot be confirmed. |
| A08 | “Northbridge scored before half-time, but Eastport had more possession overall.” | HTTP 502 `semantic-validation`: `Claim 1 historical circumstance requires an exclusive before-event period or clarification.` Raw provider claims not retained. | The first returned claim was classified as a historical circumstance without the required exclusive event cutoff or clarification, so the complete two-claim response was rejected. The endpoint did not expose the second claim. “Scored before half-time” is a recorded event-time assertion, unlike a claim about circumstances before a goal; the possession comparison is a separate claim. |
| A09-R1 | “Did Saka’s 45+3′ goal come against the run of play?” | HTTP 502 `semantic-validation`: `Claim 1 has invalid required evidence.` Raw repeat claim not retained. | The first attempt’s captured claim passed validation with `requiredEvidence` equal to `shots`, `goals`, `possession`, `build-up-phase`, `player-events`, and `passing`; it used `timePeriod: before-event(event-07)` and anchor `event-07`, a Northbridge goal attributed to Saka. The repeat failed the required-evidence array/type/enum/size check. The raw repeat value is absent, so which exact subcondition failed is unknown. The accepted first attempt retained a strict pre-goal cutoff and rejected an overall-performance inference. |
| A04-R1 | “Amad didn’t complete passes at a higher rate than Saka, did he?” | HTTP 502 `semantic-validation`: `Claim 1 intent does not match its evidence request.` Raw provider claim not retained. | Same observable validator boundary as A04; the repeated output was also rejected. No further field-level diagnosis is possible from the saved logs. |
| A12 (accepted but wrong) | “Where are Northbridge losing possession during build-up?” | HTTP 200. The exact validated claim is in the ledger: `statistical-request`, `meaning.category: other`, `requiredEvidence: [build-up-phase, possession-losses, passing, player-events]`. The API returned Northbridge passing totals (30/38, 78.9%) and all general turnover records. | The interpretation carried an explicit build-up and possession-loss signal, but the calculation path selected general passing statistics and every turnover rather than the annotated build-up subset. The response did not answer the requested scope. The correct eligible count must be calculated from selected-window versioned annotations, their turnover IDs, linked passes, and partial coverage. |

## Repair constraints

- Preserve this table, the frozen plan, and all 18 ledger records as evaluation history.
- Use only deterministic fixture calculations and mocked/local providers for new regressions.
- Keep identity validation and historical goal/scorer checks strict. Derive unavailable-metric handling and evidence requirements only where the metric/claim structure makes the required evidence unambiguous.
- Do not hardcode the five observed build-up losses; derive all eligible turnover IDs and area counts from the selected-window annotations.
- Treat every repaired case above as a known development regression, not a fresh holdout. A future live evaluation needs a separately agreed call budget.

## Verified offline repair outcomes

| Failure | Repair and regression coverage |
|---|---|
| A04 / A04-R1 | Normalize only structurally valid factual comparisons whose intent is a statistical request, factual claim, or known unavailable metric. Derive the required evidence kind and comparison intent from the declared metric/operator; leave incompatible categories and unrelated intents for strict validation. Tests preserve the negated pass-completion comparison. |
| A06 | A recognized unavailable metric no longer depends on an irrelevant event-time anchor. The response is explicitly unavailable and includes no substituted statistics. Regression asserts the selected period, no event evidence and no unrelated figures. |
| A08 | Recognize “scored before half-time” as an event-time assertion and keep it separate from the possession comparison. Goals are limited to the selected time and first half; no future goal is claimed before it occurs. Regression covers both the full-time result and a selection at 45+2′. |
| A09-R1 | Derive the required evidence for “against the run of play” from the historical claim while retaining exclusive before-event validation, goal identity and scorer checks. Offline regressions cover an accepted anchor and wrong-scorer rejection. The raw failed repeat payload remains unavailable, so its exact malformed field is unknown. |
| A12 | Route the captured build-up interpretation to versioned annotations. Eligible turnovers, linked passes and area counts are derived from the fixture and selected window, with the partial-coverage limitation; general passing totals are not substituted. Tests compare evidence IDs to fixture annotations and exercise a recent window. |

The repairs were verified offline only. The final API suite passed (111 tests, including the TypeScript build); the web suite passed (24 tests), the production web build and lint passed, and `git diff --check` passed. No browser verification or live provider calls were made. The evaluation cases above are known development cases, not holdouts. The missing rejected Foundry payloads leave uncertainty about the exact fields produced on those attempts; provider behaviour on unseen wording remains unmeasured.

## Independent review follow-up (863b644 snapshot)

The follow-up regressions were added before changing the implementation. Against the reviewed snapshot, the API suite reported 111 passing tests and six failing test cases/subtests covering the two negation phrasings, the run-of-play historical scope, clarification gating, and the historical/selected-window label. A further regression for a no-goal assertion first failed before its verdict-boundary fix.

The follow-up repair recognizes only explicit “scored before half-time” and “did not/never score before half-time” forms. It asks for clarification for nearby but unsupported scoring wording instead of inferring polarity. A run-of-play claim remains a historical circumstance with its exclusive before-goal anchor, scorer validation, and limited-evidence caveats. Clarification now prevents a factual assessment override. Absence of a first-half goal is assessed only after the selected clock has entered the second half; before then the result remains inconclusive. Summary text and claim period labels distinguish first-half goal checks from the selected last-ten-minute window.

After repair, the API suite passed (121 tests, including its TypeScript build). Regressions exercise both the validated provider boundary and the local interpreter. The reviewed evaluation plan and live ledger remain unchanged. This follow-up was entirely offline; no live provider calls or browser checks were made.
