# Language acceptance matrix

Fictional data only. This records what the **local rule-based interpreter** actually returned for representative football opinions, produced by `analyzeOpinion` with `CLAIM_INTERPRETER_PROVIDER=local` on `feature/explore-more-matches` (probe: 42 inputs, run offline, no model calls).

## How to read this document

| Evidence class | Meaning | Used here |
| --- | --- | --- |
| **Local-rule execution** | The input was run through the real service path with the local interpreter. | Every row below. |
| **Captured Foundry replay** | A genuinely captured Foundry interpretation replayed through real validation with stubbed transport (`apps/api/tests/foundry-captured-replay.test.mjs`, `apps/api/src/testdata`). Offline; not live verification. | Only the four earlier captured cases: shots 57′ and 58′, “parked the bus”, “How many passes did Bruno complete?”. |
| **Manually constructed / stubbed** | Interpretations written by hand in tests to exercise validation. | Existing unit tests only; none of the rows below. |
| **Live Foundry verification** | Real model calls. | **None for this work.** The earlier live ledgers describe earlier application versions. The prompt and schema are unchanged here, so the local-rule results below say nothing about Foundry behaviour. |

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
| 15 | Eastport are not testing the keeper | B 57′ | Attacking output | Shots on target, no verdict on “testing” | Subjective judgement, insufficient evidence; selected team's shots on target in the window shown as context, “testing the keeper” stays qualitative | PASS (repaired) |
| 16 | Eastport have little attacking threat | B 57′ | Attacking output | Shots, no chance-quality claim | Subjective judgement, insufficient evidence | PASS |
| 17 | Eastport are wasteful in front of goal | B 57′ | Finishing | Shots and goals; no chance quality | Subjective judgement, insufficient evidence | PASS |
| 18 | Eastport missed a sitter | B 57′ | Chance quality | Shots; chance quality unrecorded | Subjective judgement, insufficient evidence | PASS |
| 19 | Northbridge dominated possession | B 57′ | Broad dominance | Context only, no firm verdict | Subjective judgement, insufficient evidence | PASS |
| 20 | Eastport had more possession than Northbridge | R 90+4′ | Possession comparison | Verdict from controlled time | Factual claim, supported (58.2% v 41.8%) | PASS |
| 21 | Northbridge parked the bus | B 57′ | Defensive approach | Unavailable defensive shape; possession as labelled context only | Subjective judgement, insufficient evidence; possession shares attributed per team, role “context”, stated not to support or contradict defensive shape; also covered by captured Foundry replay | PASS (repaired) |
| 22 | Northbridge are sitting deep | B 57′ | Defensive approach | Same | Same | PASS (repaired) |
| 23 | Eastport are pinned back | B 57′ | Pressure/territory | Positional summaries cannot establish control | Subjective judgement, insufficient evidence | PASS |
| 24 | Eastport cannot get out of their half | B 57′ | Progression | Same | Same | PASS |
| 25 | Northbridge are pressing high | B 57′ | Pressing | Pressure records are a sample; no verdict | Subjective judgement, insufficient evidence; both teams' pressure-observation counts and the records, labelled as a partial sample (no continuous pressing, height or intensity) | PASS (repaired) |
| 26 | Eastport have the momentum | B 57′ | Momentum | Recent-window context, no verdict | Subjective judgement, insufficient evidence | PASS |
| 27 | Northbridge had more possession than Eastport | R 88′, last 10 min | Rolling window | Window figures that differ from the whole match | Factual claim, supported (88.9% in the window; 42.4% cumulative) | PASS |
| 28 | Eastport scored before half-time | B 57′ | Goal chronology | Factual verdict | Factual claim, contradicted | PASS |
| 29 | Northbridge did not score in the first half | B 57′ | Negated goal claim | Factual verdict | Factual claim, contradicted: Northbridge’s goal is recorded at 45+3′ | PASS (repaired) |
| 30 | Northbridge had more shots on target than Eastport before the goal | B 57′ | Pre-goal chronology | Verdict on the period before the anchor event | Resolves the one goal recorded by 57′ (45+3′), counts strictly before it; contradicted (1 on target each) | PASS (repaired) |
| 31 | Both teams had the same number of shots | B 57′ | Equality | Verdict | Equality comparison on shots; supported (4 each) | PASS (repaired) |
| 32 | Every Eastport shot was on target | B 57′ | “Every” quantifier | Verdict with counts | Universal claim against Eastport’s shots; contradicted (2 of 4); zero attempts gives insufficient evidence | PASS (repaired) |
| 33 | Northbridge had no shots on target | B 57′ | Zero attempts | Verdict on a count of zero | Zero assertion on shots on target; contradicted (2 on target of 4 shots) | PASS (repaired) |
| 34 | Eastport had more shots on target than Northbridge but Northbridge had more possession | B 57′ | Two claims, “but” | Two assessed claims | Two claims: contradicted; supported | PASS |
| 35 | How many passes did Bruno complete? | B 58′ | Ambiguous first name | Ask Fernandes or Guimarães; no count | Clarification needed; also covered by captured Foundry replay | PASS |
| 36 | How did Saka perform? | B 57′ | Open player question | Recorded contributions, no rating | Same evidence as case 1 | PASS |
| 37 | How did he play? | B 57′ | Unclear pronoun | Ask who | Clarification needed | PASS |
| 38 | Saka and Rice have been poor | B 57′ | Two players, one judgement | Both players’ records | Two separate claims, one per player, each with its own records and a “no overall rating” limitation | PASS (repaired) |
| 39 | Northbridge covered more distance than Eastport | B 57′ | Running distance | Unavailable data, no substitute metric | Unavailable metric, “unavailable data” | PASS |
| 40 | Rice is injured | B 57′ | Injury judgement | Unavailable data | Unavailable metric | PASS |
| 41 | Eastport will win | B 57′ | Prediction | Explicit limitation | “That’s a prediction about what happens next, and the records only cover play up to 57′.” | PASS |
| 42 | Eastport had a shot from outside the box | B 57′ | Shot location | Unavailable or checked against recorded positions | Unavailable data: shot records hold no coordinates or zone, free-text descriptions are not location data, and no other shot count is substituted | PASS (repaired) |

Totals, verified by per-case assertions in `apps/api/tests/language-matrix.test.mjs` (intent, assessment, statistics, reply meaning, evidence presence): 42 inputs, 42 PASS, 0 PARTIAL, 0 FAIL. Four cases (#15, #21, #22, #25) were previously PARTIAL and were repaired, without changing their expectations, through shared topic handling (`topicContext` in `apps/api/src/service.ts`), with regressions in `apps/api/tests/topic-context.test.mjs` covering windows, negated forms and the new fixtures. Possession shown for #21–22 is context only (role “context”) and is never used for or against defensive shape; pressure for #25 is a selected-possession sample. Two older tests that forbade any percentage in a “parked the bus” reply were refined to allow possession only inside that labelled sentence. This is a bounded local-rule corpus, not general language understanding. Completed-pass count comparisons (“X completed more passes than Y”, with fewer/negated/as-many forms, aliases and windows) are covered by `apps/api/tests/completed-passes.test.mjs`. Cases 29–33, 38 and 42 were repaired through shared semantics (count assertions, strict goal anchors, multi-player expansion) and are covered by `apps/api/tests/semantic-assertions.test.mjs`.

Limits of that result:
- These are **local-rule** results only. Foundry interpretation of these forms is **unverified**; the Foundry schema and prompt are unchanged and cannot emit the local-only `shot-location` evidence kind.
- “Before the goal” counts strictly before the resolved goal, computed over all recorded events up to the selected time, not the Last-10-minutes window.
- A bare “the goal” resolves only when exactly one goal is recorded by the selected time; otherwise the app asks which goal.
- Case 35 (“How many passes did Bruno complete?”) remains a clarification by design (two players share that first name).
- Offline Foundry-path checks: `foundry-offline-fixtures.test.mjs` holds a **captured replay** of the genuine baseline shots pair (omitted and explicit `datasetId`) and, separately, a **constructed stub** on the Return fixture. Neither is live Foundry verification.

## Verified second-fixture calculations (Return match, local-rule execution)

These are covered by `apps/api/tests/dataset-selection.test.mjs`, `return-fixture.test.mjs` and `dataset-examples.test.mjs`.

- At 90+4′ the score is 2–1. Eastport hold 58.2% of recorded possession to Northbridge’s 41.8%, while Northbridge lead 11–4 on shots.
- At 88′, Last 10 minutes, Northbridge have 88.9% possession; cumulatively at 88′ they have 42.4%; at 90+4′ Last 10 minutes it is 50/50.
- Saka at 60′: 2 shots on target and 5 of 5 passes. A player with no attempts shows a null completion rate, not 0%.
- Substitutions apply before events at the same timestamp, and the first-half stoppage events (45+1′) are included in order.

## Stage 2 fixtures (local-rule execution)

Covered by `apps/api/tests/new-fixtures.test.mjs` and the catalog examples in `dataset-examples.test.mjs`; these are checks of fixture behaviour on the same bounded rules, not additions to the 42-row matrix (which is unchanged and still runs on the local provider).

- Westhaven FC v Kingswell City (goalless): “Kingswell City had no shots on target” → supported (0 of 3 shots); last-10-minutes possession 40%/60% contradicts “Westhaven FC had more possession” while the whole match favours Westhaven; “Haaland’s passing has been poor” → no recorded pass attempts, no completion rate; “before the goal” → no goal recorded, asks for clarification; “Pedro” → asks which Pedro.
- Redmere FC v Alderwick United: “Abraham has scored” is supported from 88′ and not before; “Every Alderwick United shot was on target” → contradicted (3 of 5); “before the goal” → asks which of three goals; “Jackson has been poor” → recorded contributions, no rating.
- A team or player belonging to another match is not reinterpreted (“Eastport…” in Westhaven gives clarification/limitation, never a verdict).
- Known coverage limit: “completed more passes than …” is unrecognised on every fixture under local rules.

## Coverage statement

The local interpreter reads a bounded set of patterns by *meaning class* (a shared opinion-topic classifier, a comparison parser and a player-metric parser). It is not an open language model and will decline wording outside those classes. Foundry interpretation for these classes has not been verified on the current prompt and schema.

## Additional composition regressions (independent offline review)

The original 42 rows above still pass on Node 22.23.3. They are a bounded acceptance corpus, not a claim that every football phrasing works. A further nine regression tests in `semantic-composition.test.mjs` cover failures found beyond that list:

- Player goal statements and their negations, including “Saka has not scored”, distinguish Saka from Rice and respect the selected window.
- Player first-half scoring statements preserve scorer identity, exclude future goals, and do not fail semantic validation.
- Zero and universal shot assertions composed with “before the goal” use the strict historical denominator and clarify absent or ambiguous goals.
- “Not every shot was on target” and “every shot was not on target” retain different meanings.
- An ambiguous first name in “Bruno has been poor” produces a clarification, not two invented player opinions. Explicitly named players and unique first names still work.

These repairs are locally executed and regression-tested only. No new Foundry interpretation or real-device claim is made.
