export type MatchClock = {
  period: 1 | 2
  minute: number
  stoppageMinutes?: number
}

export type MatchTeam = 'Northbridge' | 'Eastport'
export type AnalysisPeriod = 'match-so-far' | 'last-10-minutes'

export const TEAMS: MatchTeam[] = ['Northbridge', 'Eastport']

const FIRST_HALF_STOPPAGE_MINUTES = 3
const SECOND_HALF_REGULATION_END = 90

export function elapsedMatchMinute(clock: MatchClock): number {
  if (clock.period === 1) {
    return clock.minute + (clock.stoppageMinutes ?? 0)
  }

  return (
    FIRST_HALF_STOPPAGE_MINUTES +
    (clock.minute - 45) +
    45 +
    (clock.stoppageMinutes ?? 0)
  )
}

export function formatMatchClock(clock: MatchClock): string {
  const stoppage = clock.stoppageMinutes
  const minute = stoppage === undefined ? clock.minute : `${clock.minute}+${stoppage}`
  return `${minute}′`
}

export function getMatchTimeOptions(): MatchClock[] {
  const firstHalf: MatchClock[] = Array.from({ length: 45 }, (_, index) => ({
    period: 1,
    minute: index + 1,
  }))
  const firstHalfStoppage: MatchClock[] = Array.from(
    { length: FIRST_HALF_STOPPAGE_MINUTES },
    (_, index) => ({
      period: 1,
      minute: 45,
      stoppageMinutes: index + 1,
    }),
  )
  const secondHalf: MatchClock[] = Array.from({ length: 45 }, (_, index) => ({
    period: 2,
    minute: index + 46,
  }))
  const secondHalfStoppage: MatchClock[] = Array.from(
    { length: 4 },
    (_, index) => ({
      period: 2,
      minute: SECOND_HALF_REGULATION_END,
      stoppageMinutes: index + 1,
    }),
  )

  return [...firstHalf, ...firstHalfStoppage, ...secondHalf, ...secondHalfStoppage]
}
