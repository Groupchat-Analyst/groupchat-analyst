import {
  buildSyntheticEvidence,
  type SequenceSeed,
  type SyntheticMatchEvidence,
} from './evidence.ts'
import type { MatchEvent } from './match.ts'
import type { MatchClock, MatchTeam } from './matchClock.ts'

/**
 * Second synthetic match: an illustrative, deterministic event sample. Like the baseline it is
 * fictional, uses fictionalised identities only, and is not a complete professional tracking
 * dataset. It deliberately includes counterexamples to common takes:
 *  - Eastport hold the possession majority across the match, yet Northbridge have far more shots;
 *  - goals arrive from both sides (Eastport 26′, Northbridge 57′ and 90+2′) alongside saved,
 *    blocked and wide efforts;
 *  - the final ten minutes (80′ onward) reverse the cumulative possession pattern;
 *  - some players have shots but no recorded pass attempts, or neither.
 */
export const RETURN_DATASET_ID = 'northbridge-eastport-return-demo'
export const RETURN_DATASET_VERSION = '1.0.0'

const c = (minute: number, stoppageMinutes?: number, period: 1 | 2 = minute > 45 || (minute === 90 && stoppageMinutes !== undefined) ? 2 : 1): MatchClock =>
  stoppageMinutes === undefined ? { period, minute } : { period, minute, stoppageMinutes }

export const RETURN_MATCH_EVENTS: MatchEvent[] = [
  { id: 'return-event-01', clock: c(15), team: 'Eastport', type: 'shot', outcome: 'off-target', playerId: 'east-player-08', description: 'Long-range effort curls past the far post.' },
  { id: 'return-event-02', clock: c(18), team: 'Northbridge', type: 'shot', outcome: 'saved', playerId: 'north-player-11', description: 'Turn and shot from the edge of the area is saved low.' },
  { id: 'return-event-03', clock: c(26), team: 'Eastport', type: 'shot', outcome: 'goal', playerId: 'east-player-09', description: 'Eastport score with a first-time finish from a cut-back.' },
  { id: 'return-event-04', clock: c(29), team: 'Northbridge', type: 'shot', outcome: 'blocked', playerId: 'north-player-10', description: 'A defender blocks a shot from the right of the area.' },
  { id: 'return-event-05', clock: c(39), team: 'Northbridge', type: 'shot', outcome: 'off-target', playerId: 'north-player-11', description: 'Volley from a corner clears the bar.' },
  { id: 'return-event-06', clock: c(45, 1), team: 'Northbridge', type: 'shot', outcome: 'saved', playerId: 'north-player-09', description: 'Close-range effort is turned away at the near post.' },
  { id: 'return-event-07', clock: c(47), team: 'Northbridge', type: 'shot', outcome: 'saved', playerId: 'north-player-09', description: 'Northbridge test the goalkeeper again soon after the restart.' },
  { id: 'return-event-08', clock: c(57), team: 'Northbridge', type: 'shot', outcome: 'goal', playerId: 'north-player-11', description: 'Northbridge level with a close-range finish.' },
  { id: 'return-event-09', clock: c(65), team: 'Northbridge', type: 'shot', outcome: 'off-target', playerId: 'north-player-08', description: 'Hurried shot from distance goes wide.' },
  { id: 'return-event-10', clock: c(70), team: 'Eastport', type: 'shot', outcome: 'blocked', playerId: 'east-player-10', description: 'Shot is blocked on the six-yard line.' },
  { id: 'return-event-11', clock: c(74), team: 'Northbridge', type: 'shot', outcome: 'saved', playerId: 'north-player-12', description: 'Low drive is saved at full stretch.' },
  { id: 'return-event-12', clock: c(77), team: 'Northbridge', type: 'shot', outcome: 'off-target', playerId: 'north-player-09', description: 'Header from a free-kick drifts wide.' },
  { id: 'return-event-13', clock: c(82), team: 'Northbridge', type: 'shot', outcome: 'saved', playerId: 'north-player-11', description: 'Shot on the turn is saved by the goalkeeper.' },
  { id: 'return-event-14', clock: c(90, 2), team: 'Northbridge', type: 'shot', outcome: 'goal', playerId: 'north-player-09', description: 'Northbridge score in stoppage time with a placed finish.' },
  { id: 'return-event-15', clock: c(90, 4), team: 'Eastport', type: 'shot', outcome: 'off-target', playerId: 'east-player-10', description: 'Late effort from outside the area misses the target.' },
]

const seed = (
  n: number,
  team: MatchTeam | null,
  start: MatchClock,
  end: MatchClock,
  passCount: number,
  completedPasses: number,
  endReason: SequenceSeed['endReason'],
  extra: Partial<SequenceSeed> = {},
): SequenceSeed => ({
  id: `sequence-${String(n).padStart(2, '0')}`,
  team,
  status: team === null ? (endReason === 'contested' ? 'contested' : 'out-of-play') : 'controlled',
  start,
  end,
  endReason,
  passCount,
  completedPasses,
  ...extra,
})

// Roster slots (0-10): 5 Rice/Baleba, 6 Zubimendi/Mainoo, 7 Ødegaard/Fernandes, 8 Saka/Amad, 9 Eze/Cunha, 10 Gyökeres/Šeško.
const NB_BUILD = [5, 6, 7, 6, 5, 7, 6, 5]
const NB_WIDE = [8, 6, 8, 7, 5, 8, 6]
const EP_BUILD = [7, 6, 7, 5, 7, 6, 7, 5]
const EP_WIDE = [7, 8, 7, 9, 7, 6, 5]

const SEEDS: SequenceSeed[] = [
  seed(1, 'Eastport', c(1), c(7), 6, 5, 'turnover', { lossArea: 'defensive-third', passers: EP_BUILD }),
  seed(2, 'Northbridge', c(7), c(10), 3, 2, 'turnover', { lossArea: 'middle-third', passers: NB_BUILD }),
  seed(3, 'Eastport', c(10), c(17), 6, 5, 'turnover', { lossArea: 'final-third', eventIds: ['return-event-01'], passers: EP_WIDE }),
  seed(4, 'Northbridge', c(17), c(20), 3, 2, 'turnover', { lossArea: 'middle-third', eventIds: ['return-event-02'], passers: NB_BUILD }),
  seed(5, 'Eastport', c(20), c(27), 7, 7, 'goal', { eventIds: ['return-event-03'], passers: EP_WIDE }),
  seed(6, null, c(27), c(28), 0, 0, 'out-of-play'),
  seed(7, 'Northbridge', c(28), c(31), 4, 3, 'turnover', { lossArea: 'final-third', eventIds: ['return-event-04'], passers: NB_WIDE }),
  seed(8, 'Eastport', c(31), c(38), 6, 5, 'turnover', { lossArea: 'middle-third', passers: EP_BUILD }),
  seed(9, 'Northbridge', c(38), c(41), 3, 2, 'turnover', { lossArea: 'defensive-third', eventIds: ['return-event-05'], passers: NB_BUILD }),
  seed(10, null, c(41), c(42), 0, 0, 'contested'),
  seed(11, 'Eastport', c(42), c(45), 4, 3, 'turnover', { lossArea: 'middle-third', passers: EP_BUILD }),
  seed(12, 'Northbridge', c(45), c(45, 2), 2, 2, 'shot', { eventIds: ['return-event-06'], passers: NB_WIDE }),
  seed(13, 'Eastport', c(45, 2), c(45, 3), 1, 1, 'period-end', { passers: EP_BUILD }),
  seed(14, 'Northbridge', c(46), c(49), 4, 3, 'turnover', { lossArea: 'middle-third', eventIds: ['return-event-07'], passers: NB_WIDE }),
  seed(15, 'Eastport', c(49), c(56), 7, 6, 'turnover', { lossArea: 'final-third', passers: EP_WIDE }),
  seed(16, 'Northbridge', c(56), c(58), 3, 3, 'goal', { eventIds: ['return-event-08'], passers: NB_BUILD }),
  seed(17, 'Eastport', c(58), c(63), 5, 4, 'turnover', { lossArea: 'defensive-third', passers: EP_BUILD }),
  seed(18, 'Northbridge', c(63), c(66), 4, 3, 'turnover', { lossArea: 'middle-third', eventIds: ['return-event-09'], passers: NB_BUILD }),
  seed(19, null, c(66), c(67), 0, 0, 'out-of-play'),
  seed(20, 'Eastport', c(67), c(72), 5, 4, 'turnover', { lossArea: 'middle-third', eventIds: ['return-event-10'], passers: EP_WIDE }),
  seed(21, 'Northbridge', c(72), c(79), 6, 5, 'turnover', { lossArea: 'final-third', eventIds: ['return-event-11', 'return-event-12'], passers: NB_WIDE }),
  seed(22, null, c(79), c(80), 0, 0, 'contested'),
  seed(23, 'Northbridge',   c(80), c(87), 6, 5, 'turnover', { lossArea: 'middle-third', eventIds: ['return-event-13'], passers: NB_BUILD }),
    seed(24, 'Eastport', c(87), c(90, 1), 4, 3, 'turnover', { lossArea: 'defensive-third', passers: EP_BUILD }),
  seed(25, 'Northbridge', c(90, 1), c(90, 3), 3, 3, 'goal', { eventIds: ['return-event-14'], passers: NB_WIDE }),
  seed(26, 'Eastport', c(90, 3), c(90, 4), 2, 1, 'period-end', { eventIds: ['return-event-15'], passers: EP_BUILD }),
]

export const RETURN_MATCH_EVIDENCE: SyntheticMatchEvidence = buildSyntheticEvidence({
  dataset: {
    id: RETURN_DATASET_ID,
    version: RETURN_DATASET_VERSION,
    label: 'Second simulated match using real-player names. All performances and results are fictional; this is an illustrative event sample, not a complete tracking dataset.',
    source: 'Authored deterministic synthetic fixture; roster-name references documented in DATA_DICTIONARY.md',
    provenance: 'synthetic',
    clockConvention: 'Period-aware match clock; first-half 45+N and second-half 90+N stoppage time; halftime excluded from played duration.',
    coordinateConvention: 'Normalized 0–100 pitch coordinates; both teams attack toward increasing x; thirds use x < 33.3, 33.3–<66.7, and >=66.7.',
  },
  seeds: SEEDS,
  substitutions: [
    { id: 'substitution-01', team: 'Northbridge', clock: c(70), playerOnId: 'north-player-12', playerOffId: 'north-player-10', provenance: 'synthetic' },
    { id: 'substitution-02', team: 'Eastport', clock: c(75), playerOnId: 'east-player-12', playerOffId: 'east-player-08', provenance: 'synthetic' },
  ],
  buildUpPossessionIds: ['sequence-02', 'sequence-04', 'sequence-09', 'sequence-18', 'sequence-23'],
  coverage: {
    start: c(1),
    end: c(90, 4),
    completeForPossessionIntervals: true,
    completeForPassEvents: true,
    completeForTurnovers: true,
    missingPeriods: [],
  },
})
