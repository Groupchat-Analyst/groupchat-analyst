import { formatMatchClock } from '../../shared/src/matchClock.ts'
import type { MatchClock } from '../../shared/src/matchClock'
import type { MatchReplayResponse } from '../../shared/src/apiContracts'

export function isMatchReplayResponse(
  value: unknown,
  selectedTime: string,
): value is MatchReplayResponse {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('selectedTime' in value) ||
    value.selectedTime !== selectedTime ||
    !('score' in value) ||
    typeof value.score !== 'object' ||
    value.score === null ||
    !('events' in value) ||
    !Array.isArray(value.events)
  ) {
    return false
  }

  const score = value.score
  if (
    !('Northbridge' in score) ||
    typeof score.Northbridge !== 'number' ||
    !Number.isInteger(score.Northbridge) ||
    !('Eastport' in score) ||
    typeof score.Eastport !== 'number' ||
    !Number.isInteger(score.Eastport) ||
    score.Northbridge < 0 ||
    score.Eastport < 0
  ) {
    return false
  }

  return value.events.every(
    (event: unknown) =>
      typeof event === 'object' &&
      event !== null &&
      'id' in event &&
      typeof event.id === 'string' &&
      'time' in event &&
      typeof event.time === 'string' &&
      'team' in event &&
      (event.team === 'Northbridge' || event.team === 'Eastport') &&
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
): Promise<MatchReplayResponse> {
  const response = await fetch('/api/replay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ selectedClock: clock }),
    signal,
  })
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('The replay service returned an unreadable match moment.')
  }
  if (!response.ok) throw new Error('The synthetic replay is unavailable.')
  if (!isMatchReplayResponse(payload, formatMatchClock(clock))) {
    throw new Error('The replay service returned an incomplete match moment.')
  }
  return payload
}
