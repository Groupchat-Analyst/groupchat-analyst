# Offline repairs for the 5cd4f82 Foundry evaluation

This repair branch addresses the two semantic failures recorded as D01 and D03/R01 in the immutable [evaluation ledger](./foundry-5cd4f82-live-evaluation-ledger.json). The original [plan](./foundry-5cd4f82-live-evaluation-plan.md), ledger, and scores are unchanged. No live model calls were made.

## Reproduced failures and repair evidence

| Case | Before repair, replaying the captured structured output | After repair, offline evidence |
|---|---|---|
| D01 | The claim was correctly assessed as contradicted, with the correct 45+3′ `event-07` evidence and summary. Its limitation nevertheless said the evidence did not establish the “subjective judgement”, contradicting the verdict. | Replaying the same captured interpretation now produces a limitation consistent with the contradicted scoring assertion and restricted to recorded first-half goal events. The assessment, summary, and evidence are unchanged. |
| D03 | The captured output classified “how many passes” as a factual historical circumstance. It did not calculate the requested passing figures and reported insufficient evidence. | A separate offline test supplies the intended statistical-request interpretation and verifies 14 completed of 18 attempts (77.8%), an exclusive `event-07` anchor, the historical passing calculation trace, and evidence containing no records at or after the goal. |
| R01 | The repeat made the same factual-claim classification error and did not calculate passes. | Its original output is retained and replayed unchanged as a development regression. The corrected interpretation path is tested separately; the old captured output is not relabelled as repaired. |

## Contract and scope

Claim intent represents the requested operation; meaning category describes the kind of claim; `timePeriod` and `historicalEventAnchor` represent scope. A quantitative request before a goal remains `statistical-request` with category `other` and passing evidence. A directional numeric assertion remains a factual comparison. A run-of-play judgement remains a `factual-claim` in the `historical-circumstance` category. All before-event scopes must reference the same available goal as their anchor and the named team. Existing player-scorer validation remains in force for historical-circumstance claims that attribute the goal to that player; a player's statistic can also be scoped before a team goal without implying they scored it.

Passing statistics and calculation traces use the existing claim-specific evidence calculation with the anchor’s exclusive elapsed-time cutoff. The half-time assertion limitation now describes the recorded goal evidence and its actual verdict instead of falling through to generic subjective-judgement wording.

## Scope and remaining uncertainty

The regression suite replays all 12 captured raw outputs offline. D01’s limitation is the only captured response field intentionally changed; the original score, summaries, interpretations, calculations, and evidence are preserved. D03/R01 still fail when their original captured interpretations are replayed, as expected: an offline repair cannot change a provider response already captured. The revised provider instructions and the corrected interpretation contract are covered by mocked/provider and deterministic tests, but have not been tested with a new model call. Model adherence to the revised instruction therefore remains unverified and requires a separately authorised evaluation.
