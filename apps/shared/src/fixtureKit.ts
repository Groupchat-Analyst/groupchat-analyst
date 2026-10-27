import type { SequenceSeed } from './evidence.ts'
import type { MatchClock, MatchTeam } from './matchClock.ts'

/** Clock helper shared by the additional fixtures: minute, optional stoppage, derived period. */
export const clockAt = (
  minute: number,
  stoppageMinutes?: number,
  period: 1 | 2 = minute > 45 || (minute === 90 && stoppageMinutes !== undefined) ? 2 : 1,
): MatchClock =>
  stoppageMinutes === undefined ? { period, minute } : { period, minute, stoppageMinutes }

export const sequenceSeed = (
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

export const FIXTURE_CLOCK_CONVENTION =
  'Period-aware match clock; first-half 45+N and second-half 90+N stoppage time; halftime excluded from played duration.'
export const FIXTURE_COORDINATE_CONVENTION =
  'Normalized 0–100 pitch coordinates; both teams attack toward increasing x; thirds use x < 33.3, 33.3–<66.7, and >=66.7.'

export const ROSTER_RETRIEVED = '27 October 2026'
