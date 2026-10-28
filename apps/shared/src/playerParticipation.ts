import type { SyntheticMatchEvidence } from './evidence.ts'
import { elapsedMatchMinute } from './matchClock.ts'

export type PlayerParticipation =
  | 'on-pitch'
  | 'participated'
  | 'unused-substitute'
  | 'not-yet-on-pitch'

export function playerParticipationAt(
  player: Pick<SyntheticMatchEvidence['players'][number], 'id' | 'team' | 'status'>,
  fixture: Pick<SyntheticMatchEvidence, 'substitutions'>,
  endElapsed: number,
): PlayerParticipation {
  const substitutions = fixture.substitutions.filter(
    ({ team }) => team === player.team,
  )
  const entered =
    player.status === 'starter' ||
    substitutions.some(
      ({ playerOnId, clock }) =>
        playerOnId === player.id && elapsedMatchMinute(clock) <= endElapsed,
    )
  const left = substitutions.some(
    ({ playerOffId, clock }) =>
      playerOffId === player.id && elapsedMatchMinute(clock) <= endElapsed,
  )
  if (entered && !left) return 'on-pitch'
  if (entered) return 'participated'
  const fullTime = elapsedMatchMinute({
    period: 2,
    minute: 90,
    stoppageMinutes: 4,
  })
  return endElapsed >= fullTime ? 'unused-substitute' : 'not-yet-on-pitch'
}
