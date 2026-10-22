# Bounded live Foundry evaluation for 5cd4f82

## Frozen source and protocol

- Frozen application source: `5de5fce` (`Add opt-in local Foundry output capture`), built from requested baseline `5cd4f82dc66ce0e6ab5fe660b708effde67ffdd7`.
- The only application change after that baseline is optional local raw-output capture. Request construction, model instructions, metrics, interpretation, calculations, validation, and summaries are unchanged.
- Provider: `foundry`; deployment expected from ignored local settings: `gpt-5-mini`.
- Total upstream-call cap: exactly 12 scheduled attempts maximum. No retries, browser submissions, or extra provider calls.
- Schedule, in fixed order: D01–D03 known development regressions; F01–F06 fresh wording; R01–R03 repeats. Repeats are byte-identical in input, selected clock, and period to D03, F04, and F03 respectively.
- Each call is made sequentially once. A failed call remains a failed attempt; continue only with the next scheduled case if the service remains available. Never resubmit a case.
- Raw response capture is enabled only for this local run with `FOUNDRY_CAPTURE_RAW_OUTPUT=true`. It writes original structured response text and available token usage to ignored `apps/api/.local-captures/foundry-raw-output.jsonl`. It does not record prompts, request headers, credentials, environment values, or unrelated data. The sanitized ledger will include raw structured output, not the local settings or headers.
- Do not edit application code, model instructions, expected values, or case wording after the first call.

## Scoring rules

Score each attempt for:

1. Meaning and number of distinct claims.
2. Team/player identity, player IDs, and comparison role order.
3. Requested metric and polarity/operator.
4. Selected window or exclusive historical cutoff.
5. Deterministic calculations, denominator, and event IDs.
6. Evidence scope, anchor/scorer identity, and future-event exclusion.
7. Appropriate limitations, unavailability, or clarification.
8. Transport/provider outcome.

Classify a successful HTTP response as **fully correct**, **accepted-but-wrong**, or **rejected/failed**. A correct clarification or explicit unavailable response is fully correct for its case. Do not exclude failures from the case denominator. Repeats are compared against their original attempt on interpretation and answer, not just HTTP success.

## Frozen attempt schedule and expected outcomes

Unless otherwise stated, the selected clock is `90+4′` and period is `match-so-far`.

| Attempt | Group | Exact input | Frozen expected interpretation and result |
|---|---|---|---|
| D01 | Known regression | `Northbridge did not score before half-time.` | One explicit negated team scoring assertion; Northbridge is the subject and the proposition is contradicted by goal `event-07` at 45+3′. Cite the goal; do not affirm the negated claim. |
| D02 | Known regression | `Where are Northbridge losing possession during build-up?` | Coaching/build-up request, not general passing totals. Use only versioned annotated losses and linked passes: `turnover-001`/`pass-005`, `turnover-003`/`pass-012`, `turnover-011`/`pass-043`, `turnover-014`/`pass-050`, `turnover-016`/`pass-067`. Areas: defensive third 2, middle third 2, final third 1. Explicitly state the annotated sample is partial and do not claim causes. |
| D03 | Known regression | `Before Northbridge scored at 45+3, how many passes had they completed?` | Passing-statistics request for Northbridge, strictly before goal `event-07`; goal and later records excluded. Fixture calculation: 14 completed / 18 attempted = 77.8%. This is the exclusive historical anchor, not full-time 30/38. |
| F01 | Fresh: player statistics | `How many passes did Bukayo Saka complete?` | Player `north-player-09`, selected full match. Fixture records: 2 completed / 4 attempted = 50.0%; identify the player and keep the denominator clear. This differs from prior A03, which asked for Saka's shots on target, and A04, which compared Saka's completion rate with Amad. |
| F02 | Fresh: unavailable measurement | `What running distance did Amad cover in kilometres?` | Amad (`east-player-09`) is understood; running distance is unavailable. Say so explicitly, with no substituted statistics or invented distance. Distinct wording/entity framing from A06's team comparison. |
| F03 | Fresh: compound claims | `Northbridge had more shots on target than Eastport, while Eastport had more possession overall.` | Preserve two separate factual claims. At full time shots on target are Northbridge 4, Eastport 5, so the first proposition is contradicted. Possession is Northbridge 56%, Eastport 44%, so the second proposition is contradicted. Do not merge verdicts or infer overall performance. Differs from prior A08's goal-plus-possession compound. |
| F04 | Fresh: historical circumstance | `Did Eastport's goal at 58 minutes come against the run of play?` | Anchor to Eastport goal `event-10` at 58′. Evidence must be strictly before that event; exclude `event-10` and all later events. Pre-goal recorded possession is Northbridge 56.1% vs Eastport 43.9%, but this is not enough to establish territorial dominance or chance quality; answer remains qualified/inconclusive. Differs from prior A09, which concerned Saka's 45+3′ goal. |
| F05 | Fresh: ambiguous player | `What did Bruno contribute?` | Ask whether Bruno Fernandes (`east-player-08`) or Bruno Guimarães (`north-player-17`) is meant. Do not choose a player or substitute team totals. Wording differs from prior A05's `How did Bruno perform?`. |
| F06 | Fresh: selected window | `In the ten minutes ending at 68 minutes, did Eastport have more shots on target?` | `last-10-minutes` ending at 68′; include the 58′ boundary and 64′ event, exclude events after 68′. Each team has one shot on target; Eastport is not greater. Score at the selected time is 1–1. Differs from prior A11, which ended at 58′. |
| R01 | Repeat of D03 | `Before Northbridge scored at 45+3, how many passes had they completed?` | Same settings and expectations as D03: strictly before `event-07`, 14/18, 77.8%. |
| R02 | Repeat of F04 | `Did Eastport's goal at 58 minutes come against the run of play?` | Same settings and expectations as F04: exclusive cutoff before `event-10`, qualified/inconclusive, no goal-or-later events in evidence. |
| R03 | Repeat of F03 | `Northbridge had more shots on target than Eastport, while Eastport had more possession overall.` | Same settings and expectations as F03: two distinct contradicted claims (4 vs 5 shots on target; 44% vs 56% possession). |

## Pre-run fixture verification

Before any provider call, fixture records and deterministic calculators confirmed:

- `event-07`: Northbridge goal by `north-player-09` at 45+3′. Strictly earlier passes: 14 completed from 18 attempts, 77.8%; full-time Northbridge passing: 30/38.
- Full-time shots on target: Northbridge 4, Eastport 5; full-time possession: Northbridge 56%, Eastport 44%.
- `event-10`: Eastport goal by `east-player-10` at 58′. Pre-goal recorded possession: Northbridge 56.1%, Eastport 43.9%.
- Bukayo Saka pass records: `pass-021`, `pass-027`, `pass-050`, `pass-053`; two completed from four attempts.
- The 58′–68′ selected window includes `event-10` and `event-11`, with one shot on target per side and score 1–1.
- Northbridge's five build-up turnover IDs and linked passes are derived from versioned annotations as listed for D02; the area distribution is 2/2/1.

## Prior-wording comparison

The fresh inputs were compared with all 18 records in `docs/foundry-final-acceptance-live-ledger.json`. None repeats a prior exact input. F01 differs from prior Saka shots-on-target and pass-rate comparison questions; F02 uses an Amad-specific distance request rather than the prior team distance comparison; F03 uses a different two-metric compound; F04 uses Eastport's 58′ goal rather than Saka's 45+3′ goal; F05 rephrases the Bruno ambiguity; and F06 changes both wording and window endpoint from A11.

## Capture and ledger handling

For each scheduled attempt, the result ledger will record the attempt ID/group, exact input, selected clock/period, expected interpretation, observed validated interpretation (if any), deterministic assessment/evidence boundaries, summary, outcome/error category, elapsed time, available usage, and raw structured model output captured before parsing/semantic validation. No request headers, credentials, local settings, or unrelated personal data are part of the capture or ledger.

The raw capture is a local diagnostic file and remains Git-ignored. It will be reviewed for accidental sensitive values before producing the sanitized committed ledger. The plan, raw local file, and final ledger must contain 12 attempts at most; the ledger must retain every failed scheduled call.
