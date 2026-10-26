# Language acceptance matrix

Fictional data only. This records what the **local rule-based interpreter** actually returned for representative football opinions, produced by `analyzeOpinion` with `CLAIM_INTERPRETER_PROVIDER=local` on `feature/explore-more-matches` (probe: 41 inputs, run offline, no model calls).

## How to read this document

| Evidence class | Meaning | Used here |
| --- | --- | --- |
| **Local-rule execution** | The input was run through the real service path with the local interpreter. | Every row below. |
| **Captured Foundry replay** | A genuinely captured Foundry interpretation replayed through real validation with stubbed transport (`apps/api/tests/foundry-captured-replay.test.mjs`, `apps/api/src/testdata`). Offline; not live verification. | Only the four earlier captured cases: shots 57′ and 58′, “parked the bus”, “How many passes did Bruno complete?”. |
| **Manually constructed / stubbed** | Interpretations written by hand in tests to exercise validation. | Existing unit tests only; none of the rows below. |
| **Live Foundry verification** | Real model calls. | **None for this work.** The earlier live ledgers belong to the earlier prompt/schema. The prompt and schema are unchanged here, so the local-rule results below say nothing about Foundry behaviour. |

Untested wording is not claimed as Foundry-supported.

Result key: **PASS** the response type addresses the actual request; **PARTIAL** addressed but clumsy or incomplete; **FAIL** a generic refusal or the wrong question answered. A generic refusal of an ordinary, identifiable football opinion is a failure, not an honest limitation.

Match key: **B** = Original match (`…-analysis-demo` 3.0.0, 57′ unless stated). **R** = Return match (`…-return-demo` 1.0.0).

## Cases

| # | Input | Match / time | Intended meaning and entity | Expected response | Actual (local rules) | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Saka has had a horrible game | B 57′ | Broad performance judgement, Saka, match so far | Qualified opinion; Saka’s recorded contributions; no rating | Subjective judgement, insufficient evidence; shows 1 goal, 2 shots on target, 1 of 2 passes, 1 recovery; no benchmark stated | PASS |
| 2 | Saka is having a poor game | B 57′ | Same, negative synonym | Same | Same class | PASS |
| 3 | Saka has been brilliant | B 57′ | Praise, same standard | Same standard as 1 | Same class, same evidence | PASS |
| 4 | Saka is having a good game | B 57′ | Praise | Same | Same class | PASS |
| 5 | Saka has not had a horrible game | B 57′ | Negated criticism | Qualified; not read as praise | Subjective judgement, insufficient evidence | PASS |
| 6 | Saka has been invisible | B 57′ | Involvement (low) | Recorded actions, no verdict | Subjective judgement, insufficient evidence | PASS |
| 7 | Saka is barely involved | B 57′ | Involvement | Same | Same | PASS |
| 8 | Saka is carrying the team | B 57′ | Involvement (high) | Same | Same | PASS |
| 9 | Saka keeps misplacing passes | B 57′ | Passing quality | Pass counts, no verdict without a benchmark | Subjective judgement, insufficient evidence | PASS |
| 10 | Saka’s passing has been poor | R 70′ | Passing quality | Counts with a no-benchmark limitation | 5 of 5 (100%) plus the no-benchmark limitation; not turned into a verdict | PASS |
| 11 | Northbridge are struggling to string passes together | B 57′ | Team passing | Pass evidence, no verdict | Subjective judgement, insufficient evidence | PASS |
| 12 | Northbridge keep giving it away | B 57′ | Possession losses | Recorded turnovers | Subjective judgement, insufficient evidence | PASS |
| 13 | Northbridge are sloppy on the ball | R 90+4′ | Possession losses by third | Recorded turnovers by third | Subjective judgement, insufficient evidence | PASS |
| 14 | Eastport had more shots than Northbridge | B 57′ | Shots comparison | Factual verdict with figures | Factual claim, contradicted | PASS |
| 15 | Eastport are not testing the keeper | B 57′ | Attacking output | Shots on target, no verdict on “testing” | Subjective judgement, insufficient evidence | PASS |
| 16 | Eastport have little attacking threat | B 57′ | Attacking output | Shots, no chance-quality claim | Subjective judgement, insufficient evidence | PASS |
| 17 | Eastport are wasteful in front of goal | B 57′ | Finishing | Shots and goals; no chance quality | Subjective judgement, insufficient evidence | PASS |
| 18 | Eastport missed a sitter | B 57′ | Chance quality | Shots; chance quality unrecorded | Subjective judgement, insufficient evidence | PASS |
| 19 | Northbridge dominated possession | B 57′ | Broad dominance | Context only, no firm verdict | Subjective judgement, insufficient evidence | PASS |
| 20 | Eastport had more possession than Northbridge | R 90+4′ | Possession comparison | Verdict from controlled time | Factual claim, supported (58.2% v 41.8%) | PASS |
| 21 | Northbridge parked the bus | B 57′ | Defensive approach | Unavailable defensive shape; possession as labelled context only | Subjective judgement, insufficient evidence; also covered by captured Foundry replay | PASS |
| 22 | Northbridge are sitting deep | B 57′ | Defensive approach | Same | Same | PASS |
| 23 | Eastport are pinned back | B 57′ | Pressure/territory | Positional summaries cannot establish control | Subjective judgement, insufficient evidence | PASS |
| 24 | Eastport cannot get out of their half | B 57′ | Progression | Same | Same | PASS |
| 25 | Northbridge are pressing high | B 57′ | Pressing | Pressure records are a sample; no verdict | Subjective judgement, insufficient evidence | PASS |
| 26 | Eastport have the momentum | B 57′ | Momentum | Recent-window context, no verdict | Subjective judgement, insufficient evidence | PASS |
| 27 | Northbridge had more possession than Eastport | R 88′, last 10 min | Rolling window | Window figures that differ from the whole match | Factual claim, supported (88.9% in the window; 42.4% cumulative) | PASS |
| 28 | Eastport scored before half-time | B 57′ | Goal chronology | Factual verdict | Factual claim, contradicted | PASS |
| 29 | Northbridge did not score in the first half | B 57′ | Negated goal claim | Factual verdict | “Couldn’t match that to something I can check” | **FAIL** |
| 30 | Northbridge had more shots on target than Eastport before the goal | B 57′ | Pre-goal chronology | Verdict on the period before the anchor event | Generic refusal | **FAIL** |
| 31 | Both teams had the same number of shots | B 57′ | Equality | Verdict | Clarification needed; no evidence retrieved | PARTIAL |
| 32 | Every Eastport shot was on target | B 57′ | “Every” quantifier | Verdict with counts | Generic refusal | **FAIL** |
| 33 | Northbridge had no shots on target | B 57′ | Zero attempts | Verdict on a count of zero | Answered with a general shots/goals summary; the shots-on-target question is not addressed | **FAIL** |
| 34 | Eastport had more shots on target than Northbridge but Northbridge had more possession | B 57′ | Two claims, “but” | Two assessed claims | Two claims: contradicted; supported | PASS |
| 35 | How many passes did Bruno complete? | B 58′ | Ambiguous first name | Ask Fernandes or Guimarães; no count | Clarification needed; also covered by captured Foundry replay | PASS |
| 36 | How did Saka perform? | B 57′ | Open player question | Recorded contributions, no rating | Same evidence as case 1 | PASS |
| 37 | How did he play? | B 57′ | Unclear pronoun | Ask who | Clarification needed | PASS |
| 38 | Saka and Rice have been poor | B 57′ | Two players, one judgement | Both players’ records | A “Which player do you mean?” clarification, although both were named | PARTIAL |
| 39 | Northbridge covered more distance than Eastport | B 57′ | Running distance | Unavailable data, no substitute metric | Unavailable metric, “unavailable data” | PASS |
| 40 | Rice is injured | B 57′ | Injury judgement | Unavailable data | Unavailable metric | PASS |
| 41 | Eastport will win | B 57′ | Prediction | Explicit limitation | “That’s a prediction about what happens next, and the records only cover play up to 57′.” | PASS |
| 42 | Eastport had a shot from outside the box | B 57′ | Shot location | Unavailable or checked against recorded positions | Generic refusal | **FAIL** |

Totals: 42 inputs, 35 PASS, 2 PARTIAL (31, 38), 5 FAIL (29, 30, 32, 33, 42). The failures and partials are open defects, not exclusions. Cases 29, 30, 32 and 33 map to the “negation”, “pre-goal chronology”, “every/none” and “zero attempts” classes: the local rules do not yet interpret those quantified or negated factual forms, and a Foundry interpretation for them is **unverified**.

## Verified second-fixture calculations (Return match, local-rule execution)

These are covered by `apps/api/tests/dataset-selection.test.mjs`, `return-fixture.test.mjs` and `dataset-examples.test.mjs`.

- At 90+4′ the score is 2–1. Eastport hold 58.2% of recorded possession to Northbridge’s 41.8%, while Northbridge lead 11–4 on shots.
- At 88′, Last 10 minutes, Northbridge have 88.9% possession; cumulatively at 88′ they have 42.4%; at 90+4′ Last 10 minutes it is 50/50.
- Saka at 60′: 2 shots on target and 5 of 5 passes. A player with no attempts shows a null completion rate, not 0%.
- Substitutions apply before events at the same timestamp, and the first-half stoppage events (45+1′) are included in order.

## Coverage statement

The local interpreter reads a bounded set of patterns by *meaning class* (a shared opinion-topic classifier, a comparison parser and a player-metric parser). It is not an open language model and will decline wording outside those classes. Foundry interpretation for these classes has not been verified on the current prompt and schema.
