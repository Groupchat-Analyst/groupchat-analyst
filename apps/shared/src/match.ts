import {
  elapsedMatchMinute,
  type AnalysisPeriod,
  type MatchClock,
  type MatchTeam,
} from './matchClock.ts'

export {
  elapsedMatchMinute,
  formatMatchClock,
  getMatchTimeOptions,
  TEAMS,
} from './matchClock.ts'
export type { AnalysisPeriod, MatchClock, MatchTeam } from './matchClock.ts'

export type MatchEvent =
  | {
      id: string
      clock: MatchClock
      team: MatchTeam
      type: 'shot'
      outcome: 'goal' | 'saved' | 'blocked' | 'off-target'
      description: string
    }
  | {
      id: string
      clock: MatchClock
      team: MatchTeam
      type: 'other'
      description: string
    }

export type TeamShotStats = {
  shots: number
  shotsOnTarget: number
}

export type MatchAnalysis = {
  selectedElapsedMinute: number
  score: Record<MatchTeam, number>
  shots: Record<MatchTeam, TeamShotStats>
  periodEvents: MatchEvent[]
  explanation: string
}

export const SYNTHETIC_MATCH_EVENTS: MatchEvent[] = [
  {
    id: 'event-01',
    clock: { period: 1, minute: 12 },
    team: 'Northbridge',
    type: 'shot',
    outcome: 'saved',
    description: 'Low shot from the edge of the box, saved by the goalkeeper.',
  },
  {
    id: 'event-02',
    clock: { period: 1, minute: 18 },
    team: 'Eastport',
    type: 'shot',
    outcome: 'off-target',
    description: 'First-time effort from outside the area goes wide.',
  },
  {
    id: 'event-03',
    clock: { period: 1, minute: 27 },
    team: 'Northbridge',
    type: 'other',
    description: 'Northbridge win a corner.',
  },
  {
    id: 'event-04',
    clock: { period: 1, minute: 31 },
    team: 'Eastport',
    type: 'shot',
    outcome: 'saved',
    description: 'Header from a cross is held by the goalkeeper.',
  },
  {
    id: 'event-05',
    clock: { period: 1, minute: 38 },
    team: 'Northbridge',
    type: 'shot',
    outcome: 'blocked',
    description: 'A defender blocks a shot inside the area.',
  },
  {
    id: 'event-06',
    clock: { period: 1, minute: 45, stoppageMinutes: 2 },
    team: 'Eastport',
    type: 'shot',
    outcome: 'off-target',
    description: 'Free-kick attempt clears the crossbar.',
  },
  {
    id: 'event-07',
    clock: { period: 1, minute: 45, stoppageMinutes: 3 },
    team: 'Northbridge',
    type: 'shot',
    outcome: 'goal',
    description: 'Northbridge score with a close-range shot.',
  },
  {
    id: 'event-08',
    clock: { period: 2, minute: 46 },
    team: 'Eastport',
    type: 'shot',
    outcome: 'saved',
    description: 'Eastport test the goalkeeper soon after the restart.',
  },
  {
    id: 'event-09',
    clock: { period: 2, minute: 51 },
    team: 'Northbridge',
    type: 'shot',
    outcome: 'off-target',
    description: 'A counter-attacking effort goes wide.',
  },
  {
    id: 'event-10',
    clock: { period: 2, minute: 58 },
    team: 'Eastport',
    type: 'shot',
    outcome: 'goal',
    description: 'Eastport level the score with a shot from the area.',
  },
  {
    id: 'event-11',
    clock: { period: 2, minute: 64 },
    team: 'Northbridge',
    type: 'shot',
    outcome: 'saved',
    description: 'A driven effort is pushed away by the goalkeeper.',
  },
  {
    id: 'event-12',
    clock: { period: 2, minute: 70 },
    team: 'Eastport',
    type: 'shot',
    outcome: 'blocked',
    description: 'A defender gets in the way of a shot from the area.',
  },
  {
    id: 'event-13',
    clock: { period: 2, minute: 77 },
    team: 'Northbridge',
    type: 'shot',
    outcome: 'saved',
    description: 'A header from a cross is saved.',
  },
  {
    id: 'event-14',
    clock: { period: 2, minute: 83 },
    team: 'Eastport',
    type: 'shot',
    outcome: 'goal',
    description: 'Eastport take the lead with a shot from close range.',
  },
  {
    id: 'event-15',
    clock: { period: 2, minute: 90, stoppageMinutes: 2 },
    team: 'Eastport',
    type: 'shot',
    outcome: 'saved',
    description: 'Late shot is held by the goalkeeper.',
  },
  {
    id: 'event-16',
    clock: { period: 2, minute: 90, stoppageMinutes: 4 },
    team: 'Northbridge',
    type: 'shot',
    outcome: 'off-target',
    description: 'Northbridge shoot over in stoppage time.',
  },
]

export function analyzeMatch(
  events: MatchEvent[],
  selectedClock: MatchClock,
  period: AnalysisPeriod,
): MatchAnalysis {
  const selectedElapsedMinute = elapsedMatchMinute(selectedClock)
  const periodStartMinute =
    period === 'last-10-minutes' ? selectedElapsedMinute - 10 : 0
  const eventsThroughSelectedTime = events.filter(
    (event) => elapsedMatchMinute(event.clock) <= selectedElapsedMinute,
  )
  const periodEvents = eventsThroughSelectedTime.filter(
    (event) => elapsedMatchMinute(event.clock) >= periodStartMinute,
  )
  const score: MatchAnalysis['score'] = {
    Northbridge: 0,
    Eastport: 0,
  }
  const shots: MatchAnalysis['shots'] = {
    Northbridge: { shots: 0, shotsOnTarget: 0 },
    Eastport: { shots: 0, shotsOnTarget: 0 },
  }

  for (const event of eventsThroughSelectedTime) {
    if (event.type === 'shot' && event.outcome === 'goal') {
      score[event.team] += 1
    }
  }

  for (const event of periodEvents) {
    if (event.type !== 'shot') continue

    shots[event.team].shots += 1
    if (event.outcome === 'goal' || event.outcome === 'saved') {
      shots[event.team].shotsOnTarget += 1
    }
  }

  const home = shots.Northbridge
  const away = shots.Eastport
  const shotCount = (count: number) => `${count} ${count === 1 ? 'shot' : 'shots'}`
  const attemptCount = (count: number) =>
    `${count} ${count === 1 ? 'attempt' : 'attempts'}`
  const shootingComparison =
    home.shots === away.shots
      ? `Both teams recorded ${shotCount(home.shots)}`
      : `${home.shots > away.shots ? 'Northbridge' : 'Eastport'} recorded more shots`

  return {
    selectedElapsedMinute,
    score,
    shots,
    periodEvents,
    explanation: `${shootingComparison} in this period. Northbridge had ${shotCount(home.shotsOnTarget)} on target from ${attemptCount(home.shots)}; Eastport had ${shotCount(away.shotsOnTarget)} on target from ${attemptCount(away.shots)}. Shot counts describe attempts and accuracy, but alone cannot establish which team played better overall or how dangerous the chances were.`,
  }
}
