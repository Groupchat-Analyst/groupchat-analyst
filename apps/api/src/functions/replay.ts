import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions'
import {
  analyzeMatch,
  formatMatchClock,
  getMatchTimeOptions,
  type MatchClock,
} from '../../../shared/src/match.js'
import { findCatalogEntry } from '../../../shared/src/datasetCatalog.js'
import { toDisplay } from '../../../shared/src/teamNaming.js'
import { elapsedMatchMinute } from '../../../shared/src/matchClock.js'
import { playerParticipationAt } from '../../../shared/src/playerParticipation.js'
import { resolveDataset } from '../datasets.js'
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

export function getReplayFrame(
  clock: unknown,
  datasetId?: unknown,
): MatchReplayResponse {
  if (!isMatchClock(clock)) {
    throw new TypeError('Select a valid match time from the fictional fixture.')
  }
  if (datasetId !== undefined && !findCatalogEntry(datasetId)) {
    throw new TypeError('datasetId is not a supported match.')
  }
  const dataset = resolveDataset(datasetId)

  const analysis = analyzeMatch(dataset.events, clock, 'match-so-far')
  const selectedElapsed = elapsedMatchMinute(clock)

  return toDisplay({
    datasetId: dataset.id,
    datasetVersion: dataset.version,
    selectedTime: formatMatchClock(clock),
    score: analysis.score,
    players: dataset.evidence.players.map((player) => ({
      id: player.id,
      team: player.team,
      name: player.name,
      status: player.status,
      participation: playerParticipationAt(
        player,
        dataset.evidence,
        selectedElapsed,
      ),
    })),
    events: analysis.periodEvents.map((event) => ({
      id: event.id,
      time: formatMatchClock(event.clock),
      team: event.team,
      description: event.description,
      type: event.type,
      ...(event.type === 'shot' ? { outcome: event.outcome } : {}),
    })),
  }, dataset.naming)
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
      const record = typeof body === 'object' && body !== null ? body : {}
      const clock = 'selectedClock' in record ? record.selectedClock : undefined
      return {
        status: 200,
        jsonBody: getReplayFrame(
          clock,
          'datasetId' in record ? record.datasetId : undefined,
        ),
      }
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
