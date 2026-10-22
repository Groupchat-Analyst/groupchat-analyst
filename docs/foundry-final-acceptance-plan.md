# Foundry final-version acceptance plan

## Frozen protocol

- Application baseline: commit `3a25db2ca146712939371ca9b7e2cfcacab20ce2` on branch `feature/final-version-acceptance-evaluation`.
- Provider: Microsoft Foundry; deployment: `gpt-5-mini`. The HTTPS endpoint has the required `/openai/v1` shape. Credentials are present only in ignored `apps/api/local.settings.json`; values are not included here.
- Model instructions and application code are frozen for this evaluation. Identity fingerprints are recorded below before the first upstream call.
- Maximum budget: 18 upstream calls total. Planned schedule: 12 fresh first attempts, four exact repeats (cases A04, A05, A09, A10), and two real browser submissions. No retry. Stop when 18 calls have been submitted. Browser-generated upstream requests count toward the same limit.
- Fresh case wording below was written for this evaluation and is not drawn from H01–H18 or the independent regression cases. Those are development cases only.
- Expected numerical values were calculated directly from synthetic fixture records and deterministic application calculators before model calls. They were not generated or checked by a model.
- A request counts as correct only when interpretation, named entities/order, metric, requested time scope, assessment, evidence IDs/cutoff, and limitations match the declared expectation. A valid HTTP response alone is not success.
- A structurally accepted interpretation can still misunderstand language. Preserve all such failures; do not repair code or instructions and rerun any case during this evaluation.

## Frozen cases and expected outcomes

Every case uses the full-time selected clock `90+4′` and `match-so-far`, except A10 and its repeat, which use selected clock `57′` and `match-so-far`, and A11, which uses `58′` and `last-10-minutes`.

| ID | Exact input | Expected interpretation and deterministic result |
|---|---|---|
| A01 | “How many passes did Northbridge complete, and what was its completion rate?” | One descriptive Northbridge passing-statistics request, no truth verdict. Fixture calculator: 30 completions / 38 attempts = 78.9%. |
| A02 | “Eastport completed fewer passes than Northbridge, didn’t they?” | One factual team comparison, Eastport first, completed-pass metric, less-than operator. Eastport 23 vs Northbridge 30; the proposition is supported. |
| A03 | “How many shots on target did Bukayo Saka record?” | One player-specific statistical request for Bukayo Saka (`north-player-09`), not team totals. Three on-target shots, from `event-01`, `event-07`, and `event-13`; one is a goal. |
| A04 | “Amad didn’t complete passes at a higher rate than Saka, did he?” | One negation-aware factual player comparison with Amad first and Saka second; operator less-or-equal. Amad 2/3 (66.7%) vs Saka 2/4 (50%); the asserted less-or-equal proposition is contradicted. |
| A05 | “How did Bruno perform?” | Ask whether the user means Bruno Fernandes (`east-player-08`) or Bruno Guimarães (`north-player-17`). Do not choose either player or return invented/team-substituted statistics. |
| A06 | “Did Eastport cover more ground than Northbridge?” | Running-distance comparison is unavailable because physical/tracking measurements are not recorded. No substitute metric or distance value. |
| A07 | “Eastport were the better side all match.” | Broad subjective judgement, not a precise statistic. Qualify the conclusion; relevant possession context is Eastport 44% vs Northbridge 56%, which challenges possession dominance but does not settle overall performance. |
| A08 | “Northbridge scored before half-time, but Eastport had more possession overall.” | Preserve two separate claims: Northbridge scored at `event-07` (45+3′), before half-time; Eastport’s claim to more possession is contradicted by Northbridge 56% vs Eastport 44%. Do not merge the claims or let one verdict stand for both. |
| A09 | “Did Saka’s 45+3′ goal come against the run of play?” | Historical circumstance anchored to Saka’s actual goal `event-07`, with exclusive `before-event` cutoff. Context may include only `event-01`–`event-06`; exclude the anchor and every later event. Before-goal pass records are `pass-001`–`pass-034`; possession is Northbridge 55.6% (25 minutes) vs Eastport 44.4% (20 minutes). Explain that the sparse fixture does not establish territorial control or chance quality. |
| A10 | “At 57 minutes, did Northbridge and Eastport have the same number of shots on target?” | One factual equality comparison at the selected 57′ cutoff. Two shots on target each; score 1–0. Do not include the 58′ event. |
| A11 | “In the last ten minutes ending at 58′, did Eastport have more shots on target than Northbridge?” | One factual Eastport-first shots-on-target comparison. The recent window includes `event-09` and the 58′ boundary `event-10`: Northbridge 0, Eastport 1; proposition supported. Match-so-far score at 58′ is 1–1. Exclude all later events. |
| A12 | “Where are Northbridge losing possession during build-up?” | Filter only explicit versioned build-up annotations; label the sample partial and do not infer causes. The five eligible losses are `turnover-001`/`pass-005` and `turnover-014`/`pass-050` in the defensive third; `turnover-003`/`pass-012` and `turnover-011`/`pass-043` in the middle third; and `turnover-016`/`pass-067` in the final third. Counts: 2 defensive, 2 middle, 1 final. |

### Repeats and browser allowance

After all 12 first attempts, repeat A04, A05, A09, and A10 once each, with byte-identical input and identical settings. Each repeat remains a separate attempt and is assessed independently.

Use exactly two live browser submissions after the 16 API attempts, subject to the remaining budget:

1. Submit A01 at full time and verify the server’s `summary`, displayed answer, and copied answer are identical.
2. Submit A11 at 58′ / `last-10-minutes` and perform the same comparison.

If any earlier attempted call fails at transport or API validation, do not retry it. Continue only if the service remains usable and never exceed 18 total upstream requests. No further browser interaction that submits analysis is allowed after the second browser request.

## Deterministic calculation basis

The calculations were checked directly using `SYNTHETIC_MATCH_EVIDENCE`, `SYNTHETIC_MATCH_EVENTS`, `calculateEvidence`, and `analyzeMatch` from the pinned source build, with no model involved:

- Dataset version `3.0.0`; 70 authored pass records. Northbridge: 30/38 = 78.9%; Eastport: 23/32 = 71.9%.
- Bukayo Saka (`north-player-09`) has three shots, all on target, with one goal (`event-07`).
- Full-time recorded possession: Northbridge 56%, Eastport 44%.
- Strictly before `event-07`, the event set is `event-01`–`event-06`; the goal and all later events are excluded. Calculated pre-goal possession is 25/45 controlled minutes for Northbridge (55.6%) and 20/45 for Eastport (44.4%); pass records are `pass-001`–`pass-034`.
- At 57′, each team has two shots on target and the score is Northbridge 1–0 Eastport.
- The last-ten-minute sample ending at 58′ has `event-09` and `event-10`; Northbridge has 0 and Eastport 1 shot on target, while the match-so-far score is 1–1.
- Build-up counts are calculated from the five eligible Northbridge turnovers in the selected annotated sample, not from every all-pass turnover.

## Frozen identity

The source commit is the authority for the frozen prompt and code. Hashes below identify the relevant working-tree files at the freeze point.

| Component | SHA-256 |
|---|---|
| `apps/api/src/providers/foundry.ts` (model instructions, request construction and provider handling) | `1d420d705537cbe8ab5a61ec0611c32646e8cf038b967b66004cf9b9958a5aef` |
| `apps/api/src/service.ts` (deterministic calculations, validation boundary and answer writing) | `be3fbe5d1c80d12876973c9223ec23d8e91212ed98f8efb416f5e85a7e50ba12` |
| `apps/api/src/validation.ts` (structured interpretation validation) | `a578133bcd3061722e4b4c1287bc35b90f2bacdecd5e4ec86e6f6bd561c5b122` |
| `apps/shared/src/evidence.ts` (fixture and evidence calculations) | `39ecc781c82080691573dfae557dabaf1edf040ec3111eb1c0c46c4a22823329` |
| `apps/shared/src/match.ts` (event fixture and match-time calculations) | `944409174f266c6e6cfd189bc8389cbbbf49afba1ea066c01b0dcf74ef9d2453` |
| Git tree | `8e7de0a8579c875b9cdcf445c4f40924ecad975a` |

## Results

The application and prompt remained frozen at the pinned baseline. No code, prompt or fixture changes were made in response to results, and no requests were retried.

### Outcome summary

| Evaluation group | Correct | Accepted but wrong | Rejected | Notes |
|---|---:|---:|---:|---|
| 12 fresh first attempts | 8/12 | 1 | 3 | Five supported statistic/comparison cases were correct. |
| Four exact repeats | 2/4 | 0 | 2 | A05 and A10 repeated correctly; A09 changed from a correct answer to rejection. |
| Two real browser submissions | 2/2 | 0 | 0 | Displayed and copied text matched each server summary exactly. |
| All upstream calls | 12/18 | 1 | 5 | All five rejections were classified `semantic-validation`. |

Fresh supported team/player statistics and factual comparisons were correct in 5/5 applicable cases (A01–A03, A10–A11). The broad “better side” judgement was appropriately qualified (A07). The ambiguous “Bruno” question was correctly clarified (A05, and its repeat). The unavailable running-distance question was rejected during semantic validation rather than answered with an explicit unavailability limitation (A06). The two-claim compound question was also rejected (A08). The first historical Saka-goal answer observed an exclusive before-event cutoff and expressed the evidence limitation (A09), but its repeat was rejected. Both selected-time boundary cases were correct: equal shots on target at 57′ and Eastport’s one-to-zero advantage in the ten-minute window ending at 58′ (A10–A11).

One materially wrong interpretation was accepted: A12 asked where Northbridge lost possession during build-up, but the provider returned Northbridge’s general passing totals (30/38, 78.9%) instead of the five eligible, partially annotated build-up losses. The answer did not satisfy the requested question. This is an observed semantic reliability defect; it was preserved and not repaired or rerun.

Repeat outcome was stable in 3/4 pairs: A04 was rejected both times, A05 was correctly clarified both times, A10 returned the correct equality both times, while A09’s correct first response became a semantic-validation rejection. Only 2/3 repeats of initially correct answers remained correct. Rejections should not be interpreted as correct handling of a request.

### Calls, usage and checks

- Exactly 18 upstream calls were made: 12 first attempts, four planned repeats and two live browser submissions. Four empty browser-control requests did not call the provider. No automatic or manual retries were made.
- The API accepted 13 requests and rejected five at semantic validation. No transport, throttling, refusal, incomplete-output or schema failure was observed. A rejected request did not return its model interpretation to the caller.
- Foundry usage telemetry was captured for all attempts: 68,119 prompt tokens, 20,831 completion tokens and 88,950 total tokens. Per-attempt token counts and API-host execution durations are in `foundry-final-acceptance-live-ledger.json`. API-host execution durations ranged from 5.504 to 17.300 seconds. Browser A01 end-to-end elapsed time was not captured; its 5.557-second API-host duration is recorded separately.
- Before the first live call, API build and tests passed (104/104); web tests passed (24/24), and the web production build and lint passed. The evaluation did not change application code after those checks.
- Both real browser answers identified provider `foundry`. For each, the browser-displayed summary and clipboard-write argument exactly matched the server summary.
- The local API emitted its known `AzureWebJobsStorage` health warning; the analysis route remained available and completed the evaluation.

This bounded sample is not evidence of production reliability. In particular, the accepted build-up misinterpretation, unavailable-metric rejection, compound-claim rejection and inconsistent historical repeat remain unresolved. The holdout set was small and provides no broad guarantee about other wording, claims, players or periods. Preserve this result for a separate repair task and a subsequent, independently frozen evaluation.
