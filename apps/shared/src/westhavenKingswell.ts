import { buildSyntheticEvidence, type SyntheticMatchEvidence } from './evidence.ts'
import type { MatchEvent } from './match.ts'
import {
  clockAt as c,
  FIXTURE_CLOCK_CONVENTION,
  FIXTURE_COORDINATE_CONVENTION,
  ROSTER_RETRIEVED,
  sequenceSeed as seed,
} from './fixtureKit.ts'

/**
 * Third synthetic match: Westhaven FC v Kingswell City, a goalless match. Westhaven dominate the
 * ball and the shot count, Kingswell never test the goalkeeper, and Kingswell hold the ball in the
 * final ten minutes. No goal is recorded, so a "before the goal" question has no anchor.
 * Internally Westhaven occupy the home slot ("Northbridge") and Kingswell the away slot
 * ("Eastport"); see teamNaming.ts. Every action and result is fictional; only names are reused.
 */
export const WESTHAVEN_DATASET_ID = 'westhaven-kingswell-demo'
export const WESTHAVEN_DATASET_VERSION = '1.0.0'

export const WESTHAVEN_ROSTER_SOURCES = [
  { team: 'Westhaven FC', reference: 'Chelsea men’s team profiles', url: 'https://www.chelseafc.com/en/teams/mens-profiles', retrieved: ROSTER_RETRIEVED },
  { team: 'Kingswell City', reference: 'Manchester City players', url: 'https://www.mancity.com/players', retrieved: ROSTER_RETRIEVED },
] as const

// Eleven starters (slot order: goalkeeper, back four, then midfield and attack) followed by nine substitutes.
const ROSTERS = {
  Northbridge: [
    'Emiliano Martinez', 'Reece James', 'Wesley Fofana', 'Levi Colwill',
    'Jorrel Hato', 'Moises Caicedo', 'Romeo Lavia', 'Cole Palmer',
    'Pedro Neto', 'Jamie Gittens', 'Joao Pedro',
    'Mike Penders', 'Malo Gusto', 'Maxence Lacroix', 'Jordan Henderson',
    'Valentin Barco', 'Morgan Rogers', 'Danny Welbeck', 'Emmanuel Emegha',
    'Geovany Quenda',
  ],
  Eastport: [
    'Gianluigi Donnarumma', 'Matheus Nunes', 'Rúben Dias', 'Marc Guéhi',
    'Joško Gvardiol', 'Enzo Fernández', 'Mateo Kovačić', 'Rayan Cherki',
    'Phil Foden', 'Jérémy Doku', 'Erling Haaland',
    'Marcus Bettinelli', 'Rico Lewis', 'Abdukodir Khusanov', 'Rayan Aït-Nouri',
    'Nico O\'Reilly', 'Elliot Anderson', 'Antoine Semenyo', 'Iliman Ndiaye',
    'Allan',
  ],
}

export const WESTHAVEN_MATCH_EVENTS: MatchEvent[] = [
  { id: 'westhaven-event-01', clock: c(7), team: 'Northbridge', type: 'shot', outcome: 'blocked', playerId: 'north-player-10', description: 'A defender gets across to block an early shot from the left.' },
  { id: 'westhaven-event-02', clock: c(16), team: 'Eastport', type: 'shot', outcome: 'off-target', playerId: 'east-player-11', description: 'A snap shot on the break flies over the bar.' },
  { id: 'westhaven-event-03', clock: c(22), team: 'Northbridge', type: 'shot', outcome: 'saved', playerId: 'north-player-08', description: 'A curling effort from the edge of the area is tipped away.' },
  { id: 'westhaven-event-04', clock: c(31), team: 'Northbridge', type: 'shot', outcome: 'off-target', playerId: 'north-player-09', description: 'A low shot from the right drifts wide of the post.' },
  { id: 'westhaven-event-05', clock: c(39), team: 'Eastport', type: 'shot', outcome: 'blocked', playerId: 'east-player-10', description: 'A shot from the left of the area is blocked.' },
  { id: 'westhaven-event-06', clock: c(45, 2), team: 'Northbridge', type: 'shot', outcome: 'saved', playerId: 'north-player-08', description: 'A close-range effort is pushed behind just before the break.' },
  { id: 'westhaven-event-07', clock: c(52), team: 'Northbridge', type: 'shot', outcome: 'saved', playerId: 'north-player-11', description: 'A shot from a cut-back is saved low.' },
  { id: 'westhaven-event-08', clock: c(60), team: 'Northbridge', type: 'shot', outcome: 'blocked', playerId: 'north-player-09', description: 'A shot from inside the area is blocked on the line.' },
  { id: 'westhaven-event-09', clock: c(67), team: 'Northbridge', type: 'shot', outcome: 'saved', playerId: 'north-player-18', description: 'A substitute’s first touch is a shot, saved at the near post.' },
  { id: 'westhaven-event-10', clock: c(73), team: 'Eastport', type: 'shot', outcome: 'off-target', playerId: 'east-player-09', description: 'A hurried effort from distance goes wide.' },
  { id: 'westhaven-event-11', clock: c(86), team: 'Northbridge', type: 'shot', outcome: 'off-target', playerId: 'north-player-08', description: 'A shot from the left drifts past the far post.' },
  { id: 'westhaven-event-12', clock: c(90, 2), team: 'Northbridge', type: 'shot', outcome: 'saved', playerId: 'north-player-18', description: 'A stoppage-time header is saved on the line.' },
]

// Roster slots (0-10) used as passers. Slot 0 (goalkeeper) is never used; Kingswell never use slot 10.
const WH_A = [5, 6, 7, 6, 5, 8, 9, 7]
const WH_B = [2, 3, 5, 4, 6, 7, 8, 9]
const WH_C = [6, 7, 8, 9, 10, 8, 7, 6]
const KC_A = [5, 6, 7, 6, 5, 8, 9, 8]
const KC_B = [1, 2, 3, 5, 6, 4, 8, 9]

const SEEDS = [
  seed(1, 'Northbridge', c(1), c(8), 6, 6, 'shot', { eventIds: ['westhaven-event-01'], passers: WH_A }),
  seed(2, 'Eastport', c(8), c(13), 4, 3, 'turnover', { lossArea: 'middle-third', passers: KC_A }),
  seed(3, null, c(13), c(14), 0, 0, 'contested'),
  seed(4, 'Eastport', c(14), c(17), 4, 3, 'shot', { eventIds: ['westhaven-event-02'], passers: KC_B }),
  seed(5, 'Northbridge', c(17), c(23), 7, 6, 'shot', { eventIds: ['westhaven-event-03'], passers: WH_C }),
  seed(6, 'Eastport', c(23), c(30), 6, 5, 'turnover', { lossArea: 'defensive-third', passers: KC_A }),
  seed(7, 'Northbridge', c(30), c(33), 4, 3, 'shot', { eventIds: ['westhaven-event-04'], passers: WH_B }),
  seed(8, 'Northbridge', c(33), c(38), 5, 4, 'turnover', { lossArea: 'middle-third', passers: WH_A }),
  seed(9, 'Eastport', c(38), c(41), 3, 2, 'shot', { eventIds: ['westhaven-event-05'], passers: KC_B }),
  seed(10, 'Northbridge', c(41), c(45, 1), 5, 4, 'turnover', { lossArea: 'final-third', passers: WH_B }),
  seed(11, 'Northbridge', c(45, 1), c(45, 3), 3, 3, 'period-end', { eventIds: ['westhaven-event-06'], passers: WH_A }),
  seed(12, 'Northbridge', c(46), c(53), 7, 6, 'shot', { eventIds: ['westhaven-event-07'], passers: WH_C }),
  seed(13, 'Eastport', c(53), c(58), 5, 4, 'turnover', { lossArea: 'defensive-third', passers: KC_A }),
  seed(14, 'Northbridge', c(58), c(61), 4, 3, 'shot', { eventIds: ['westhaven-event-08'], passers: WH_B }),
  seed(15, 'Eastport', c(61), c(66), 6, 4, 'turnover', { lossArea: 'middle-third', passers: KC_B }),
  seed(16, 'Northbridge', c(66), c(68), 3, 3, 'shot', { eventIds: ['westhaven-event-09'], passers: WH_C }),
  seed(17, 'Eastport', c(68), c(74), 6, 5, 'shot', { eventIds: ['westhaven-event-10'], passers: KC_A }),
  seed(18, null, c(74), c(75), 0, 0, 'out-of-play'),
  seed(19, 'Northbridge', c(75), c(80), 5, 4, 'turnover', { lossArea: 'final-third', passers: WH_B }),
  seed(20, 'Eastport', c(80), c(85), 6, 5, 'turnover', { lossArea: 'defensive-third', passers: KC_B }),
  seed(21, 'Northbridge', c(85), c(87), 3, 3, 'shot', { eventIds: ['westhaven-event-11'], passers: WH_A }),
  seed(22, 'Eastport', c(87), c(90, 1), 7, 6, 'turnover', { lossArea: 'final-third', passers: KC_A }),
  seed(23, 'Northbridge', c(90, 1), c(90, 3), 3, 3, 'shot', { eventIds: ['westhaven-event-12'], passers: WH_C }),
  seed(24, 'Eastport', c(90, 3), c(90, 4), 2, 1, 'period-end', { passers: KC_B }),
]

export const WESTHAVEN_MATCH_EVIDENCE: SyntheticMatchEvidence = buildSyntheticEvidence({
  dataset: {
    id: WESTHAVEN_DATASET_ID,
    version: WESTHAVEN_DATASET_VERSION,
    label: 'Third simulated match using real-player names. All performances and results are fictional; this is an illustrative event sample, not a complete tracking dataset.',
    source: 'Authored deterministic synthetic fixture. Player names are dated reference snapshots (retrieved 27 October 2026): Chelsea https://www.chelseafc.com/en/teams/mens-profiles and Manchester City https://www.mancity.com/players; documented in DATA_DICTIONARY.md',
    provenance: 'synthetic',
    clockConvention: FIXTURE_CLOCK_CONVENTION,
    coordinateConvention: FIXTURE_COORDINATE_CONVENTION,
  },
  rosters: ROSTERS,
  seeds: SEEDS,
  substitutions: [
    { id: 'substitution-01', team: 'Northbridge', clock: c(62), playerOnId: 'north-player-18', playerOffId: 'north-player-11', provenance: 'synthetic' },
    { id: 'substitution-02', team: 'Eastport', clock: c(70), playerOnId: 'east-player-17', playerOffId: 'east-player-07', provenance: 'synthetic' },
  ],
  buildUpPossessionIds: ['sequence-02', 'sequence-06', 'sequence-13', 'sequence-20'],
  coverage: {
    start: c(1),
    end: c(90, 4),
    completeForPossessionIntervals: true,
    completeForPassEvents: true,
    completeForTurnovers: true,
    missingPeriods: [],
  },
})
