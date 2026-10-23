import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions'
import {
  analyzeMatch,
  formatMatchClock,
  getMatchTimeOptions,
  SYNTHETIC_MATCH_EVENTS,
  type MatchClock,
} from '../../../shared/src/match.js'
import type { MatchReplayResponse } from '../../../shared/src/apiContracts.js'

function isMatchClock(value: unknown): value is MatchClock {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('period' in value) ||
    !('minute' in value) ||
    (('stoppageMinutes' in value) &&
      value.stoppageMinutes !== undefined &&
      typeof value.stoppageMinutes !== 'number')
  ) {
    return false
  }

  return getMatchTimeOptions().some(
    (clock) =>
      clock.period === value.period &&
      clock.minute === value.minute &&
      (clock.stoppageMinutes ?? 0) ===
        ('stoppageMinutes' in value && typeof value.stoppageMinutes === 'number'
          ? value.stoppageMinutes
          : 0),
  )
}

export function getReplayFrame(clock: unknown): MatchReplayResponse {
  if (!isMatchClock(clock)) {
    throw new TypeError('Select a valid match time from the fictional fixture.')
  }

  const analysis = analyzeMatch(SYNTHETIC_MATCH_EVENTS, clock, 'match-so-far')

  return {
    selectedTime: formatMatchClock(clock),
    score: analysis.score,
    events: analysis.periodEvents.map((event) => ({
      id: event.id,
      time: formatMatchClock(event.clock),
      team: event.team,
      description: event.description,
      type: event.type,
      ...(event.type === 'shot' ? { outcome: event.outcome } : {}),
    })),
  }
}

export function createReplayHandler() {
  return async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return {
        status: 400,
        jsonBody: { error: 'Request body must be valid JSON.' },
      }
    }

    try {
      const clock =
        typeof body === 'object' && body !== null && 'selectedClock' in body
          ? body.selectedClock
          : undefined
      return { status: 200, jsonBody: getReplayFrame(clock) }
    } catch (error) {
      if (error instanceof TypeError) {
        return { status: 400, jsonBody: { error: error.message } }
      }
      context.error('Synthetic replay request failed.', error)
      return {
        status: 500,
        jsonBody: { error: 'The synthetic replay could not be loaded.' },
      }
    }
  }
}
