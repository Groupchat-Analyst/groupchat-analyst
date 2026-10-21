# Synthetic match evidence data dictionary

`src/evidence.ts` is the typed schema, deterministic fixture, capability catalogue, and calculation contract for the richer prototype dataset. `src/match.ts` remains the original small 16-event fixture used by the shot/score regressions. Both are authored synthetic examples for fictional Northbridge vs Eastport. Real-player names are used only as fictional identities; performances and results are invented.

The simulated lineups use names checked against official squad pages on 19 October 2026:

- Arsenal-inspired Northbridge names: [Premier League Arsenal squad](https://www.premierleague.com/en/clubs/3/arsenal/squad?se=418)
- Manchester United-inspired Eastport names: [Manchester United men's team](https://www.manutd.com/en/teams/mens-team)

No portraits, crests, real performance statistics, or injury information are used. Players retain stable `north-player-NN` / `east-player-NN` IDs, ordered as starters 01–11 and substitutes 12–20.

## Dataset and provenance

| Field | Meaning |
|---|---|
| `dataset.id` | Stable fixture identifier. |
| `dataset.version` | Reproducible data version (`3.0.0`). |
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
| Player / lineup | Stable `id`, `team`, fictionalized use of a real-player `name`, starter/substitute status, selected-window participation and minutes, and synthetic provenance. |
| Substitution | Stable ID, team, period-aware clock, player-on/player-off IDs, and provenance. Only substitutions at or before the selected clock are returned. |
| Possession interval | Stable sequence ID, controlled team or `null`, status (`controlled`, `contested`, `out-of-play`), start/end clocks, end reason, linked original event IDs, and provenance. |
| Pass | Stable event ID, possession ID, team, passer and intended receiver IDs, clock, normalized pitch start/end (`x`,`y` in 0–100), complete/incomplete outcome, qualifiers, and provenance. |
| Turnover | Stable ID, possession/team/player IDs, clock, pitch location, incomplete-pass ID, recovery team when recorded, and provenance. |
| Recovery | Stable ID, recovering team/player, clock/location, and linked turnover ID. |
| Pressure | Stable ID, team/player applying pressure, possession ID, clock/location, and selected pressure-event type. Its coverage is explicitly partial. |
| Shot | Stable original `event-NN` ID, shooting player ID, team, period-aware clock, and outcome. A goal remains a shot outcome and is never counted twice. |
| Build-up annotation | Stable annotation ID, version, phase, possession ID, linked pass/turnover/pressure IDs, team, and explicitly partial sample coverage. |
| Original match event | Stable `event-NN` ID, team, period-aware clock, shot outcome or other event type, and description. Goals remain shot outcomes and are not duplicated in the score. |

## Metric definitions

- **Possession duration:** sum the clipped durations of intervals marked `controlled` for each team.
- **Possession percentage:** each team's controlled minutes divided by the sum of both teams' controlled minutes, multiplied by 100 and rounded to one decimal. The denominator is **recorded controlled possession only**. Contested and out-of-play intervals are excluded; half-time is absent. If possession coverage is incomplete, percentages are `null`, while recorded minutes remain available.
- **Pass attempts/completions:** count pass records inside the selected time window. Completion percentage is completed passes divided by attempts, rounded to one decimal. No attempts or incomplete pass coverage yields `null`, not `0%`.
- **Pass-completion calculation trace:** each team's response includes the completed-pass numerator, all-attempt denominator, and every included `pass-NNN` ID for both counts. The API's raw pass records expose outcome, player, possession, timestamp, coordinates and provenance for independent reproduction.
- **Possession losses by area:** count recorded incomplete-pass turnovers by the endpoint's normalized attacking x-coordinate: defensive third `<33.3`, middle third `33.3–<66.7`, final third `>=66.7`. Both teams' x-axis is normalized toward their attacking direction.
- **Build-up annotations:** phase means an explicitly selected synthetic possession segment authored as build-up across that sequence, not a rule based on pitch third or a phase classifier. Version `1.0.0` labels `sequence-01`, `sequence-02`, `sequence-03`, `sequence-04`, `sequence-14`, `sequence-15`, `sequence-18`, and `sequence-24`. A filtered answer uses only those linked pass/turnover IDs and any selected pressure records. This is a small sample, not complete match-wide coverage. Team-wide build-up and Rice-specific questions can be answered only within this sample; the locations and associations do not establish tactical causes.
- **Player metrics:** pass attempts count passes made by the player, not passes received. Pass completion is completions divided by that player's recorded attempts, and is unavailable for zero attempts or incomplete pass coverage. Shot, target, and goal counts use player-attributed original shot records. Player minutes are the intersection of the selected played-time window with the player's lineup/substitution interval; substitution time is effective for the incoming player at that timestamp and the outgoing player is no longer eligible. The team still has exactly 11 active players on either side.
- **Action status:** `not-yet-on-pitch` means no entry by the selected time; `unused-substitute` means the player did not enter by full-time; `participated` means the player entered and later left; `on-pitch` means active at the selected time. A participant with zero events is distinct from an unavailable metric.
- **Player action attribution:** all authorship and intended-receiver assignments are deterministic synthetic examples, not assertions about real players. No assist is inferred from the pass closest to a goal.
- **Final-third entry:** one completed pass starting outside and ending inside the final third (`x >=66.7`). This is a positional pass-event definition, not a claim of sustained territorial control.
- **Score:** calculate only from the original fixture's goal-shot events through the selected clock.

## Capability catalogue and limitations

The API returns `EVIDENCE_CAPABILITIES` with `available`, `partial`, or `not-recorded` status. Possession intervals, passes/locations, linked losses/recoveries, lineups, and substitutions are available as **synthetic** data. Player-attributed actions, build-up annotations, and selected pressure events are partial; they cannot establish complete player performance, continuous pressing, or match-wide build-up patterns. No running distance or other physical measurement, continuous player/ball tracking, synchronized video, defensive-shape data, or calibrated xG is recorded. The fixture cannot establish tactical causes or overall territorial control from event locations alone.

Continuous tracking, video analysis, physical data and workload, and advanced models are future capabilities only. No values for those capabilities are fabricated or inferred in this prototype.
