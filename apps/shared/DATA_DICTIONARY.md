# Synthetic match evidence data dictionary

`src/evidence.ts` is the typed schema, deterministic fixture, capability catalogue, and calculation contract for the richer prototype dataset. `src/match.ts` remains the original small 16-event fixture used by the shot/score regressions. Both datasets are authored synthetic examples for fictional Northbridge vs Eastport; neither contains professional or real-club data.

## Dataset and provenance

| Field | Meaning |
|---|---|
| `dataset.id` | Stable fixture identifier. |
| `dataset.version` | Reproducible data version (`2.0.0`). |
| `dataset.label` | User-facing synthetic-data label. |
| `dataset.source` | Authored deterministic prototype fixture. |
| `dataset.provenance` | One of `synthetic`, `observed`, `inferred`, or `modelled`; the current fixture is `synthetic`. |
| `coverage.start`, `coverage.end` | Period-aware clock bounds of the dataset. |
| `coverage.completeFor*`, `coverage.missingPeriods` | Explicit measurement coverage. A missing metric is not a zero. |

The interpretation contract labels each claim's intent as a statistical request, factual claim, subjective judgement, unavailable metric, coaching question, or unrecognized language. Statistical requests return calculated values without a supported/contradicted verdict. An unavailable or unrecognized request returns no unrelated event evidence.

The shared match clock represents normal time and stoppage as `45+N′` or `90+N′`. Period is always part of a timestamp. Half-time has no played duration. A time window uses a lower-inclusive, upper-inclusive selected-time boundary for point events; possession intervals are clipped as half-open duration intervals `[start,end)`. When a selected time clips an interval, its eventual end reason and linked later events are omitted.

For an event exactly at an interval boundary, the event is linked to the interval whose possession produced it. Adjacent intervals share the boundary instant only; the instant contributes no duration twice.

## Record schemas

| Record | Key fields |
|---|---|
| Player / lineup | Stable `id`, `team`, fictional `name`, starter/substitute status, and provenance. |
| Substitution | Stable ID, team, period-aware clock, player-on/player-off IDs, and provenance. Only substitutions at or before the selected clock are returned. |
| Possession interval | Stable sequence ID, controlled team or `null`, status (`controlled`, `contested`, `out-of-play`), start/end clocks, end reason, linked original event IDs, and provenance. |
| Pass | Stable event ID, possession ID, team/player IDs, clock, normalized pitch start/end (`x`,`y` in 0–100), complete/incomplete outcome, qualifiers, and provenance. |
| Turnover | Stable ID, possession/team IDs, clock, pitch location, incomplete-pass ID, recovery team when recorded, and provenance. |
| Recovery | Stable ID, recovering team, clock/location, and linked turnover ID. |
| Pressure | Stable ID, team applying pressure, possession ID, clock/location, and selected pressure-event type. Its coverage is explicitly partial. |
| Original match event | Stable `event-NN` ID, team, period-aware clock, shot outcome or other event type, and description. Goals remain shot outcomes and are not duplicated in the score. |

## Metric definitions

- **Possession duration:** sum the clipped durations of intervals marked `controlled` for each team.
- **Possession percentage:** each team's controlled minutes divided by the sum of both teams' controlled minutes, multiplied by 100 and rounded to one decimal. The denominator is **recorded controlled possession only**. Contested and out-of-play intervals are excluded; half-time is absent. If possession coverage is incomplete, percentages are `null`, while recorded minutes remain available.
- **Pass attempts/completions:** count pass records inside the selected time window. Completion percentage is completed passes divided by attempts, rounded to one decimal. No attempts or incomplete pass coverage yields `null`, not `0%`.
- **Pass-completion calculation trace:** each team's response includes the completed-pass numerator, all-attempt denominator, and every included `pass-NNN` ID for both counts. The API's raw pass records expose outcome, player, possession, timestamp, coordinates and provenance for independent reproduction.
- **Possession losses by area:** count recorded incomplete-pass turnovers by the endpoint's normalized attacking x-coordinate: defensive third `<33.3`, middle third `33.3–<66.7`, final third `>=66.7`. Both teams' x-axis is normalized toward their attacking direction.
- **Build-up questions:** this fixture does not define a build-up phase. The API returns an explicitly broader all-pass-turnover area breakdown with numerator turnover IDs and the all-turnovers denominator IDs; each turnover cites its linked pass ID. Location is not a causal/tactical explanation.
- **Final-third entry:** one completed pass starting outside and ending inside the final third (`x >=66.7`). This is a positional pass-event definition, not a claim of sustained territorial control.
- **Score:** calculate only from the original fixture's goal-shot events through the selected clock.

## Capability catalogue and limitations

The API returns `EVIDENCE_CAPABILITIES` with `available`, `partial`, or `not-recorded` status. Possession intervals, passes/locations, linked losses/recoveries, lineups, and substitutions are available as **synthetic** data. Selected pressure events are partial; they cannot establish continuous pressing. No running distance or other physical measurement, continuous player/ball tracking, synchronized video, defined build-up phase, defensive-shape data, or calibrated xG is recorded. It cannot establish tactical causes, player performance, or overall territorial control from event locations alone.

Continuous tracking, video analysis, physical data and workload, and advanced models are future capabilities only. No values for those capabilities are fabricated or inferred in this prototype.
