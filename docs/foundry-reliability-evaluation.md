# Foundry reliability evaluation

## Protocol and predeclared expectations

This bounded evaluation is defined before its live requests. It evaluates the model's validated claim interpretation together with the server's deterministic assessment; HTTP success alone does not count as correctness.

- Deployment under test: the existing ignored local settings, provider `foundry`, deployment `gpt-5-mini`.
- Maximum budget: 30 live API requests total, including repeats and retries. Planned set: 12 first-attempt holdouts plus three repeats (15), three development-case retests, six post-fix holdouts, and three post-fix repeats (27 total). No automatic retry; each case gets one first attempt. Stop if the remaining call budget or service behavior becomes uncertain.
- Existing question-bank cases already used to improve the prompt are development cases, not holdouts: pass-rate comparison; 57′/58′ shots-on-target comparison; the Northbridge first-goal historical question; running distance; and ambiguous Bruno. Their earlier results are recorded separately from the final holdout set.
- The following fresh phrasings are holdouts. Do not change prompts or code after seeing a holdout result. If a fix is necessary, mark any case that informed it as development and do not count that case as unseen evaluation.
- Repeat H01, H06, and H07 after their first attempt to measure repeatability. A repeat does not replace or erase the first result.
- Capture HTTP outcome, provider, elapsed wall time, summary, claim count, subject/player references, intent, category, metric/operator, period/anchor, assessment, statistics, and evidence-reference IDs. Count model usage from safe server telemetry if returned; otherwise report it unavailable.

### Final holdout cases (expected outcomes)

| ID | Input and request settings | Required semantic outcome |
|---|---|---|
| H01 | “How many passes did Northbridge complete?” Full time, match so far. | One statistical request for Northbridge pass completions; 30 completed of 38 attempts; denominator is the selected-window Northbridge pass attempts. No truth verdict. |
| H02 | “Saka's passing accuracy was below Amad's, wasn't it?” Full time. | One factual player comparison, Saka first and Amad second, pass-completion percentage, correct negation-aware verdict from their player-attributed attempts/completions. No team totals substituted. **Development case after its first attempt:** the initial model treated this tag question as a descriptive statistical request. |
| H03 | “Compare completed passes for Bukayo Saka and Amad.” Full time. | One descriptive player-statistic comparison, correct player identities/order and pass-completion counts; not split into unrelated claims or given a truth verdict. |
| H04 | “How did martin odegaard do?” Full time. | Resolve the unaccented, case-varied alias to Martin Ødegaard; summarize only his recorded contributions and qualify the sparse sample. |
| H05 | “Amad's pass completion rate was at least as high as Saka's.” Full time. | One factual player comparison, Amad first and Saka second, with greater-or-equal operator and correct verdict from those players' records. |
| H06 | “Northbridge had more of the ball, but did Saka's opener come against the run of play?” Full time. | Preserve separate possession and historical claims; possession uses 56% vs 44%, and the Saka goal is a separate `event-07` anchor. Historical context excludes that goal and every later event. No definitive broad tactical conclusion from the incomplete evidence. |
| H07 | “What did Bruno contribute?” Full time. | Ask which Bruno (Bruno Fernandes or Bruno Guimarães); no chosen player statistics or team substitution. |
| H08 | “Which team covered the greater distance?” Full time. | Explicitly state physical/running-distance data are unavailable. No substituted shots, passes, or invented distances. **Development case after its first attempt:** the initial model output failed semantic validation. |
| H09 | “How many shots on target did Eastport record in the final ten minutes?” Selected time 58′, period last 10 minutes. | One Eastport shots-on-target statistic in the selected interval ending at 58′; include the boundary event and no later events. |
| H10 | “Was Northbridge's 45+3 goal against the run of play?” Full time. | Historical circumstance anchored to `event-07`; all contextual records strictly precede the goal, with the goal excluded from calculations and cited only as the separate anchor. Explain limits on territorial/chance-quality evidence. |
| H11 | “Eastport completely controlled this match.” Full time. | Treat as a broad judgement, not a precise possession assertion. Show relevant possession context proportionately (Eastport 44%, Northbridge 56%) and state why it cannot establish overall control. **Development case after its first attempt:** the initial model incorrectly requested clarification rather than qualifying the opinion. |
| H12 | “How many goals did Bukayo Saka score?” Full time. | One player-specific goal statistic, attributed to Saka's recorded shot; no inferred assist or unrelated player/team count. |

### Repeats

After all first attempts, repeat H01, H06, and H07 once each with identical input and settings. Compare interpretation, assessment, evidence boundaries, and summary for consistency.

## Post-fix unseen set (predeclared)

These six phrasings remain unseen until the prompt correction is complete. Do not change code or prompt after the first post-fix holdout request.

| ID | Input and request settings | Required semantic outcome |
|---|---|---|
| H13 | “I don't think Saka completed passes at a better rate than Amad.” Full time. | Factual comparison with Saka first, negation expressed as less-or-equal, and correct verdict from player pass records. |
| H14 | “Was there more ground covered by Eastport than Northbridge?” Full time. | Running-distance metric marked unavailable, not clarification, no substitute statistics. |
| H15 | “Eastport were in complete control from start to finish.” Full time. | Broad judgement; use available possession context (44% vs 56%), qualify what it establishes, and do not request clarification or make a definitive overall verdict. |
| H16 | “What did MARTÍN ZUBIMENDI contribute?” Full time. | Resolve accent/case variant to Martín Zubimendi; provide his selected-window contributions and sparse-data limitation. |
| H17 | “Northbridge kept the ball more, while Saka's opening goal came against the run of play.” Full time. | Preserve two claims; possession is 56% vs 44%; use `event-07` as a separate goal anchor and exclude it and later events from the historical calculation. |
| H18 | “Through 57 minutes, Eastport and Northbridge had the same number of shots on target.” Selected time 57′. | One factual equality claim, 2–2, supported at exactly 57′; exclude the 58′ event. |

Repeat H13, H14, and H17 once each after the post-fix first attempts. Re-test H02, H08, and H11 as development checks only. Planned total: 27 live calls; automatic retries: zero.

## Failure taxonomy and bounded behavior

Every upstream/provider failure should be explicitly classifiable as one of: `transport`, `throttling`, `refusal`, `incomplete-output`, `schema`, or `semantic-validation`. Do not silently fall back to the local interpreter. The request timeout is bounded to 30 seconds and the adapter performs no retries. Mock tests cover each category, and the UI must clear an earlier answer while a replacement request is loading or fails.

## Results

The 30-request live budget is exhausted. No further live requests were made after the final correction.

### Semantic outcomes

| Set | First attempt / repeat outcomes | Interpretation |
|---|---:|---|
| Initial H01–H12 | 9/12 correct on first attempt | H02 returned statistics instead of the negated factual comparison; H08 failed semantic validation; H11 asked for clarification instead of qualifying the broad opinion. These three cases became development cases and are excluded from the final holdout rate. |
| Post-hoc subset of initial cases not used to inform fixes | 9/9 correct | This is a selected subset, not an unbiased accuracy estimate. The original first-attempt result remains **9/12**. The subset comprises supported statistical/comparison and historical cases H01, H03–H06, H09–H10 and H12 (8/8), plus ambiguous-name handling H07 (1/1). |
| Initial repeats R01, R06, R07 | 3/3 correct | All three repeated requests returned correct semantics. |
| Development retests after first prompt changes | 1/3 correct | H11 passed; H02 and H08 still failed semantic validation. |
| Fresh H13–H18 first attempts | 6/6 correct | This set included supported statistics, aliases, a compound historical claim, a broad opinion, and a strict 57′ boundary. |
| Repeats R13, R14, R17 | 1/3 correct | R17 passed; H13 and H14 repeats failed semantic validation despite passing first attempts. |
| Final development retests | 3/3 correct | H02 and H08 passed after the final prompt/validation changes; the repeated unavailable-distance case H14 also passed. |

Across all 30 requests, the run summary recorded 23 semantically correct responses, five HTTP 502 responses attributed to semantic validation, and two HTTP 200 responses with incorrect semantics (the first H02 and H11 attempts). HTTP success is not used as a correctness proxy. The retained per-call response file does not contain error bodies or `failureType`; therefore the five individual failure classifications and the absence of other live failure categories cannot be independently re-audited from that file.

Supported statistical requests were answered accurately in the selected initial subset (8/8); ambiguous Bruno was correctly clarified (1/1). The initial unavailable-distance request and its first development retest failed validation. The final development retest for that wording and the final H14 repeat were reported as passing; those final three calls are not present in the retained per-call output file. Repeated behaviour was not fully stable: H13/H14 passed first attempts and failed repeats, and H14 passed only after the final correction.

### Final-fix holdout status

H02, H08, and H14 are development cases because their failures informed the final prompt/validation changes. H13 is also not treated as a final holdout because its repeat failure exposed the same negation reliability weakness. H15–H18 had passed before the last correction and did not directly inform it, but were not rerun after that correction. **No unseen post-final-fix holdout set was run.** The evaluation therefore does not establish post-fix generalisation or production reliability.

### Latency, usage, and failure handling

- Live calls: 30/30; maximum permitted: 30. Automatic retries: none.
- Elapsed time: approximately 5.5–17.4 seconds per call.
- Provider-reported token usage: 98,622 prompt, 31,524 completion, 130,146 total tokens across the set.
- A local response file retained 27 of the 30 per-call response records. Its per-call fields include input, request period/minute, provider, latency, summary and validated interpretation/evidence, but not code/prompt revision, failure bodies/categories or per-call token usage. The final development retest for H02, final development retest for H08, and final H14 repeat are absent. See the redacted retained-record ledger in [foundry-reliability-call-ledger.json](./foundry-reliability-call-ledger.json). Missing historical output has not been reconstructed.
- Mocked tests exercise each failure category, bounded timeout behavior, token telemetry, and explicit API failure responses. This is mocked verification, not live testing of every failure mode.
- A browser check used intercepted mock responses only: it loaded a prior answer, returned a mocked 502 for the next request, and verified the previous answer was cleared, the error was shown, and no stale summary remained. No live model request was used for this check.
- Desktop and 390-pixel mobile screenshots were captured from the running interface. The API response for the screenshot session was mocked; screenshots are visual checks, not evidence of a live model answer.

The local Functions host emitted an `AzureWebJobsStorage` health warning during evaluation, although the analysis route remained available. The provider remains bounded by a 30-second timeout and no automatic retries. Repeated semantic variability, the incomplete per-call historical record, and the absence of a post-final-fix holdout set remain primary reliability limitations.
