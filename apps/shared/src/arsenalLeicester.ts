import sourceRecords from './data/arsenal-leicester-2499719.json' with { type: 'json' }
import type { SyntheticMatchEvidence } from './evidence.ts'
import type { MatchClock, MatchEvent, MatchTeam } from './match.ts'

export const ARSENAL_LEICESTER_DATASET_ID = 'arsenal-leicester-wyscout-2499719'
export const ARSENAL_LEICESTER_DATASET_VERSION = '1.0.0'
export const ARSENAL_LEICESTER_WINNING_GOAL = {
  eventId: '177960902',
  sourcePlayerId: '26010',
  scorerAliases: ['Giroud', 'Olivier Giroud'],
} as const
export const ARSENAL_LEICESTER_GOAL_SCORERS = [
  { eventId: '177959212', sourcePlayerId: '25413', scorerAliases: ['Lacazette', 'Alexandre Lacazette'] },
  { eventId: '177960849', sourcePlayerId: '7870', scorerAliases: ['Ramsey', 'Aaron Ramsey'] },
  ARSENAL_LEICESTER_WINNING_GOAL,
] as const

type WyscoutShot = {
  id: number
  matchId: number
  eventName: 'Shot'
  matchPeriod: '1H' | '2H'
  eventSec: number
  teamId: number
  playerId: number
  tags: Array<{ id: number }>
}

function isWyscoutShot(value: unknown): value is WyscoutShot {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    record.eventName === 'Shot' &&
    record.matchId === 2499719 &&
    Number.isInteger(record.id) &&
    (record.matchPeriod === '1H' || record.matchPeriod === '2H') &&
    typeof record.eventSec === 'number' &&
    Number.isInteger(record.teamId) &&
    Number.isInteger(record.playerId) &&
    Array.isArray(record.tags) &&
    record.tags.every(
      (tag) =>
        typeof tag === 'object' &&
        tag !== null &&
        'id' in tag &&
        Number.isInteger(tag.id),
    )
  )
}

function sourceClock(period: '1H' | '2H', eventSec: number): MatchClock {
  const elapsedWholeMinutes = Math.floor(eventSec / 60)
  if (period === '1H') {
    return elapsedWholeMinutes < 45
      ? { period: 1, minute: elapsedWholeMinutes + 1 }
      : { period: 1, minute: 45, stoppageMinutes: elapsedWholeMinutes - 44 }
  }
  return elapsedWholeMinutes < 45
    ? { period: 2, minute: 46 + elapsedWholeMinutes }
    : { period: 2, minute: 90, stoppageMinutes: elapsedWholeMinutes - 44 }
}

function teamForSourceId(teamId: number): MatchTeam {
  if (teamId === 1609) return 'Northbridge'
  if (teamId === 1631) return 'Eastport'
  throw new Error(`Unexpected team ID ${teamId} in Wyscout match 2499719.`)
}

const sourceShots = (sourceRecords as unknown[])
  .filter(isWyscoutShot)
  .sort((first, second) =>
    first.matchPeriod === second.matchPeriod
      ? first.eventSec - second.eventSec
      : first.matchPeriod === '1H' ? -1 : 1,
  )

if (sourceShots.length !== 34) {
  throw new Error(`Expected 34 Wyscout shot records; found ${sourceShots.length}.`)
}

export const ARSENAL_LEICESTER_MATCH_EVENTS: MatchEvent[] = sourceShots.map(
  (source) => ({
    id: String(source.id),
    clock: sourceClock(source.matchPeriod, source.eventSec),
    sourcePeriodSeconds: source.eventSec,
    team: teamForSourceId(source.teamId),
    type: 'shot',
    outcome: source.tags.some(({ id }) => id === 101) ? 'goal' : 'unclassified',
    playerId: String(source.playerId),
    description: 'Recorded Wyscout shot event; outcome classification is unavailable.',
  }),
)

export const ARSENAL_LEICESTER_MATCH_EVIDENCE: SyntheticMatchEvidence = {
  dataset: {
    id: ARSENAL_LEICESTER_DATASET_ID,
    version: ARSENAL_LEICESTER_DATASET_VERSION,
    label: 'Arsenal v Leicester City, 11 August 2017 (historical replay)',
    source: 'Wyscout, Events, figshare article 7770599, match 2499719; Luca Pappalardo and Emanuele Massucco; CC BY 4.0.',
    provenance: 'observed',
    clockConvention: 'Source eventSec values are seconds from the start of each half; all source event IDs are preserved.',
    coordinateConvention: 'Pitch coordinates and shot locations are not mapped.',
  },
  coverage: {
    start: { period: 1, minute: 1 },
    end: { period: 2, minute: 90, stoppageMinutes: 6 },
    completeForPossessionIntervals: false,
    completeForPassEvents: false,
    completeForTurnovers: false,
    missingPeriods: [],
  },
  players: [],
  substitutions: [],
  possessions: [],
  passes: [],
  turnovers: [],
  recoveries: [],
  pressures: [],
  buildUpAnnotations: [],
}
