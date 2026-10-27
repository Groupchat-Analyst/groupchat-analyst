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
 * Fourth synthetic match: Redmere FC v Alderwick United. Redmere lead from 33′, Alderwick equalise
 * at 61′, and after a late substitution (78′) the substitute scores the winner at 88′. Three goals
 * mean "before the goal" is ambiguous until a goal is named. The substitute scorer has no
 * recorded pass attempts. Internally Redmere occupy the home slot ("Northbridge") and Alderwick the
 * away slot ("Eastport"); see teamNaming.ts. Every action and result is fictional.
 */
export const REDMERE_DATASET_ID = 'redmere-alderwick-demo'
export const REDMERE_DATASET_VERSION = '1.0.0'

export const REDMERE_ROSTER_SOURCES = [
  { team: 'Redmere FC', reference: 'Liverpool men’s team', url: 'https://www.liverpoolfc.com/teams/mens-team?position=all', retrieved: ROSTER_RETRIEVED },
  { team: 'Alderwick United', reference: 'Aston Villa teams', url: 'https://www.avfc.co.uk/teams/', retrieved: ROSTER_RETRIEVED },
] as const

const ROSTERS = {
  Northbridge: [
    'Alisson Becker', 'Conor Bradley', 'Virgil van Dijk', 'Giovanni Leoni',
    'Milos Kerkez', 'Ryan Gravenberch', 'Alexis Mac Allister', 'Florian Wirtz',
    'Cody Gakpo', 'Dominik Szoboszlai', 'Alexander Isak',
    'Giorgi Mamardashvili', 'Joe Gomez', 'Jeremie Frimpong', 'Wataru Endo',
    'Federico Chiesa', 'Hugo Ekitike', 'Bradley Barcola', 'Rio Ngumoha',
    'Jayden Danns',
  ],
  Eastport: [
    'Marco Bizot', 'Matty Cash', 'Pau Torres', 'Tyrone Mings',
    'Ian Maatsen', 'Boubacar Kamara', 'John McGinn', 'Emiliano Buendía',
    'Alejandro Garnacho', 'Ross Barkley', 'Nicolas Jackson',
    'Zion Suzuki', 'Victor Lindelöf', 'Matteo Ruggeri', 'Amadou Onana',
    'Leon Goretzka', 'João Gomes', 'Ibrahim Mbaye', 'Tammy Abraham',
    'Brian Madjo',
  ],
}

export const REDMERE_MATCH_EVENTS: MatchEvent[] = [
  { id: 'redmere-event-01', clock: c(9), team: 'Northbridge', type: 'shot', outcome: 'saved', playerId: 'north-player-09', description: 'An early shot from the left is saved at the near post.' },
  { id: 'redmere-event-02', clock: c(21), team: 'Eastport', type: 'shot', outcome: 'off-target', playerId: 'east-player-11', description: 'A shot on the turn goes over the bar.' },
  { id: 'redmere-event-03', clock: c(33), team: 'Northbridge', type: 'shot', outcome: 'goal', playerId: 'north-player-11', description: 'Redmere take the lead with a close-range finish.' },
  { id: 'redmere-event-04', clock: c(40), team: 'Eastport', type: 'shot', outcome: 'blocked', playerId: 'east-player-09', description: 'A defender blocks a shot from the right.' },
  { id: 'redmere-event-05', clock: c(45, 1), team: 'Northbridge', type: 'shot', outcome: 'off-target', playerId: 'north-player-10', description: 'A long-range shot drifts wide before the break.' },
  { id: 'redmere-event-06', clock: c(55), team: 'Northbridge', type: 'shot', outcome: 'saved', playerId: 'north-player-08', description: 'A low drive is saved by the goalkeeper.' },
  { id: 'redmere-event-07', clock: c(61), team: 'Eastport', type: 'shot', outcome: 'goal', playerId: 'east-player-10', description: 'Alderwick equalise with a shot from the edge of the area.' },
  { id: 'redmere-event-08', clock: c(70), team: 'Northbridge', type: 'shot', outcome: 'blocked', playerId: 'north-player-09', description: 'A shot from the right of the area is blocked.' },
  { id: 'redmere-event-09', clock: c(74), team: 'Eastport', type: 'shot', outcome: 'saved', playerId: 'east-player-11', description: 'A shot from a counter-attack is saved low.' },
  { id: 'redmere-event-10', clock: c(84), team: 'Northbridge', type: 'shot', outcome: 'off-target', playerId: 'north-player-17', description: 'A substitute’s shot from distance misses the target.' },
  { id: 'redmere-event-11', clock: c(88), team: 'Eastport', type: 'shot', outcome: 'goal', playerId: 'east-player-19', description: 'Alderwick’s substitute scores a late winner from a cross.' },
  { id: 'redmere-event-12', clock: c(90, 2), team: 'Northbridge', type: 'shot', outcome: 'saved', playerId: 'north-player-17', description: 'A stoppage-time header is saved.' },
]

// Slot 0 (goalkeeper) is never a passer; Alderwick never use slot 10, so Jackson and his replacement have no pass attempts.
const RM_A = [5, 6, 7, 6, 5, 8, 9, 7]
const RM_B = [2, 3, 5, 4, 6, 7, 8, 10]
const AU_A = [5, 6, 7, 6, 5, 8, 9, 8]
const AU_B = [1, 2, 3, 5, 6, 4, 8, 9]

const SEEDS = [
  seed(1, 'Northbridge', c(1), c(8), 5, 4, 'turnover', { lossArea: 'middle-third', passers: RM_A }),
  seed(2, 'Northbridge', c(8), c(10), 3, 3, 'shot', { eventIds: ['redmere-event-01'], passers: RM_B }),
  seed(3, 'Eastport', c(10), c(16), 5, 4, 'turnover', { lossArea: 'defensive-third', passers: AU_A }),
  seed(4, null, c(16), c(17), 0, 0, 'contested'),
  seed(5, 'Eastport', c(17), c(22), 5, 4, 'shot', { eventIds: ['redmere-event-02'], passers: AU_B }),
  seed(6, 'Northbridge', c(22), c(26), 4, 3, 'turnover', { lossArea: 'middle-third', passers: RM_A }),
  seed(7, 'Eastport', c(26), c(29), 3, 2, 'turnover', { lossArea: 'final-third', passers: AU_A }),
  seed(8, 'Northbridge', c(29), c(34), 6, 6, 'goal', { eventIds: ['redmere-event-03'], passers: RM_B }),
  seed(9, 'Eastport', c(34), c(38), 4, 3, 'turnover', { lossArea: 'middle-third', passers: AU_B }),
  seed(10, null, c(38), c(39), 0, 0, 'out-of-play'),
  seed(11, 'Eastport', c(39), c(42), 3, 2, 'shot', { eventIds: ['redmere-event-04'], passers: AU_A }),
  seed(12, 'Northbridge', c(42), c(45, 2), 5, 4, 'shot', { eventIds: ['redmere-event-05'], passers: RM_A }),
  seed(13, 'Eastport', c(46), c(50), 5, 4, 'turnover', { lossArea: 'defensive-third', passers: AU_B }),
  seed(14, 'Northbridge', c(50), c(56), 6, 5, 'shot', { eventIds: ['redmere-event-06'], passers: RM_B }),
  seed(15, 'Northbridge', c(56), c(60), 4, 3, 'turnover', { lossArea: 'final-third', passers: RM_A }),
  seed(16, 'Eastport', c(60), c(62), 3, 3, 'goal', { eventIds: ['redmere-event-07'], passers: AU_A }),
  seed(17, 'Northbridge', c(62), c(66), 5, 4, 'turnover', { lossArea: 'middle-third', passers: RM_B }),
  seed(18, null, c(66), c(67), 0, 0, 'contested'),
  seed(19, 'Northbridge', c(67), c(71), 4, 3, 'shot', { eventIds: ['redmere-event-08'], passers: RM_A }),
  seed(20, 'Eastport', c(71), c(75), 4, 4, 'shot', { eventIds: ['redmere-event-09'], passers: AU_B }),
  seed(21, 'Northbridge', c(75), c(80), 5, 4, 'turnover', { lossArea: 'final-third', passers: RM_B }),
  seed(22, 'Eastport', c(80), c(83), 4, 3, 'turnover', { lossArea: 'middle-third', passers: AU_A }),
  seed(23, 'Northbridge', c(83), c(85), 3, 3, 'shot', { eventIds: ['redmere-event-10'], passers: RM_A }),
  seed(24, 'Eastport', c(85), c(89), 4, 4, 'goal', { eventIds: ['redmere-event-11'], passers: AU_B }),
  seed(25, 'Northbridge', c(89), c(90, 3), 6, 4, 'shot', { eventIds: ['redmere-event-12'], passers: RM_B }),
  seed(26, 'Eastport', c(90, 3), c(90, 4), 2, 1, 'period-end', { passers: AU_A }),
]

export const REDMERE_MATCH_EVIDENCE: SyntheticMatchEvidence = buildSyntheticEvidence({
  dataset: {
    id: REDMERE_DATASET_ID,
    version: REDMERE_DATASET_VERSION,
    label: 'Fourth simulated match using real-player names. All performances and results are fictional; this is an illustrative event sample, not a complete tracking dataset.',
    source: 'Authored deterministic synthetic fixture. Player names are dated reference snapshots (retrieved 27 October 2026): Liverpool https://www.liverpoolfc.com/teams/mens-team?position=all and Aston Villa https://www.avfc.co.uk/teams/; documented in DATA_DICTIONARY.md',
    provenance: 'synthetic',
    clockConvention: FIXTURE_CLOCK_CONVENTION,
    coordinateConvention: FIXTURE_COORDINATE_CONVENTION,
  },
  rosters: ROSTERS,
  seeds: SEEDS,
  substitutions: [
    { id: 'substitution-01', team: 'Eastport', clock: c(78), playerOnId: 'east-player-19', playerOffId: 'east-player-11', provenance: 'synthetic' },
    { id: 'substitution-02', team: 'Northbridge', clock: c(80), playerOnId: 'north-player-17', playerOffId: 'north-player-11', provenance: 'synthetic' },
  ],
  buildUpPossessionIds: ['sequence-01', 'sequence-06', 'sequence-13', 'sequence-22'],
  coverage: {
    start: c(1),
    end: c(90, 4),
    completeForPossessionIntervals: true,
    completeForPassEvents: true,
    completeForTurnovers: true,
    missingPeriods: [],
  },
})
