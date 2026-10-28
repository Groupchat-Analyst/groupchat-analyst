import { formatMatchClock } from '../../shared/src/matchClock.ts'
import type { MatchClock } from '../../shared/src/matchClock'
import type { MatchReplayResponse } from '../../shared/src/apiContracts'

export function isMatchReplayResponse(
  value: unknown,
  selectedTime: string,
  teams: readonly [string, string] = ['Northbridge', 'Eastport'],
): value is MatchReplayResponse {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('selectedTime' in value) ||
    value.selectedTime !== selectedTime ||
    !('score' in value) ||
    typeof value.score !== 'object' ||
    value.score === null ||
    !('players' in value) ||
    !Array.isArray(value.players) ||
    !('events' in value) ||
    !Array.isArray(value.events)
  ) {
    return false
  }

  const score = value.score as Record<string, unknown>
  const validScore = (team: string) => {
    const goals = score[team]
    return typeof goals === 'number' && Number.isInteger(goals) && goals >= 0
  }
  if (!validScore(teams[0]) || !validScore(teams[1])) {
    return false
  }

  const validPlayers = value.players.every(
    (player: unknown) =>
      typeof player === 'object' &&
      player !== null &&
      'id' in player &&
      typeof player.id === 'string' &&
      'team' in player &&
      (player.team === teams[0] || player.team === teams[1]) &&
      'name' in player &&
      typeof player.name === 'string' &&
      'status' in player &&
      (player.status === 'starter' || player.status === 'substitute') &&
      'participation' in player &&
      (player.participation === 'on-pitch' ||
        player.participation === 'participated' ||
        player.participation === 'unused-substitute' ||
        player.participation === 'not-yet-on-pitch'),
  )

  return validPlayers && value.events.every(
    (event: unknown) =>
      typeof event === 'object' &&
      event !== null &&
      'id' in event &&
      typeof event.id === 'string' &&
      'time' in event &&
      typeof event.time === 'string' &&
      'team' in event &&
      (event.team === teams[0] || event.team === teams[1]) &&
      'description' in event &&
      typeof event.description === 'string' &&
      'type' in event &&
      (event.type === 'shot' || event.type === 'other') &&
      (!('outcome' in event) ||
        event.outcome === 'goal' ||
        event.outcome === 'saved' ||
        event.outcome === 'blocked' ||
        event.outcome === 'off-target'),
  )
}

/** Replay frames come from /api/replay only; this never touches /api/analyze. */
export async function fetchReplayFrame(
  clock: MatchClock,
  signal: AbortSignal,
  datasetId?: string,
  teams?: readonly [string, string],
): Promise<MatchReplayResponse> {
  const response = await fetch('/api/replay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(datasetId ? { selectedClock: clock, datasetId } : { selectedClock: clock }),
    signal,
  })
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('The replay service returned an unreadable match moment.')
  }
  if (!response.ok) throw new Error('The synthetic replay is unavailable.')
  if (!isMatchReplayResponse(payload, formatMatchClock(clock), teams)) {
    throw new Error('The replay service returned an incomplete match moment.')
  }
  if (datasetId && payload.datasetId !== datasetId) {
    throw new Error('The replay service returned a moment from a different match.')
  }
  return payload
}
