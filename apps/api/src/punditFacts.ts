import records from '../../shared/src/data/arsenal-leicester-2499719.json' with { type: 'json' }
import { ARSENAL_LEICESTER_DATASET_ID, ARSENAL_LEICESTER_MATCH_EVENTS } from '../../shared/src/arsenalLeicester.js'
import { elapsedEventSeconds, elapsedMatchMinute, eventsAfterAnchor, eventsBeforeAnchor, formatMatchEventTime } from '../../shared/src/match.js'
import type { AnalysisRequest, AnalysisResponse } from '../../shared/src/apiContracts.js'
import type { PunditFacts } from './providers/provider.js'

const source = records
const sourceById = new Map(source.map((row) => [String(row.id), row]))
const playerNames: Record<number, string> = {
  7868: 'Alex Oxlade-Chamberlain',
  49876: 'Granit Xhaka',
  7870: 'Aaron Ramsey',
  25413: 'Alexandre Lacazette',
  26010: 'Olivier Giroud',
}

function exactSourceTime(period: 1 | 2, seconds: number): string {
  const micros = Math.round(seconds * 1_000_000)
  const minute = Math.floor(micros / 60_000_000)
  const withinMinute = micros % 60_000_000
  const second = Math.floor(withinMinute / 1_000_000)
  const fraction = withinMinute % 1_000_000
  return `${period}H ${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(fraction).padStart(6, '0')}`
}

export function historicalPunditFacts(request: AnalysisRequest, response: AnalysisResponse): PunditFacts | undefined {
  if (request.datasetId !== ARSENAL_LEICESTER_DATASET_ID || request.inputLanguage && request.inputLanguage !== 'en') return
  if (response.claims.length === 0 || response.claims.some(({ assessment }) =>
    assessment === 'clarification needed' || assessment === 'unrecognized language' || assessment === 'unavailable data')) return
  if (response.claims.some(({ claim }) => claim.intent !== 'subjective-judgement' || !claim.requiredEvidence.includes('shots'))) return
  const periods = response.claims.map(({ claim }) => claim.timePeriod)
  const period = periods[0]
  if (period.kind === 'selected' || (period.kind === 'before-event' && period.lookbackSeconds === undefined) ||
      periods.some((other) => other.kind === 'selected' || other.kind !== period.kind ||
        other.eventId !== period.eventId ||
        (other.kind === 'before-event' && period.kind === 'before-event' && other.lookbackSeconds !== period.lookbackSeconds))) return
  const anchor = ARSENAL_LEICESTER_MATCH_EVENTS.find((event) => event.id === period.eventId)
  if (!anchor || anchor.type !== 'shot' || anchor.outcome !== 'goal' ||
      elapsedEventSeconds(anchor) > elapsedMatchMinute(request.selectedClock) * 60) return
  if (anchor.sourcePeriodSeconds === undefined ||
      (period.kind === 'before-event' && anchor.sourcePeriodSeconds < period.lookbackSeconds!)) return
  const anchorTime = elapsedEventSeconds(anchor)
  const start = period.kind === 'before-event' ? anchorTime - period.lookbackSeconds! : anchorTime
  const end = period.kind === 'before-event' ? anchorTime : elapsedMatchMinute(request.selectedClock) * 60
  const events = (period.kind === 'before-event'
    ? eventsBeforeAnchor(ARSENAL_LEICESTER_MATCH_EVENTS, anchor, period.lookbackSeconds)
    : eventsAfterAnchor(ARSENAL_LEICESTER_MATCH_EVENTS, anchor, end))
    .filter((event) => event.type === 'shot')
  const shots: PunditFacts['shots'] = []
  for (const event of events) {
    const row = sourceById.get(event.id)
    if (!row || row.eventName !== 'Shot' || !row.positions[0]) return
    const tags = new Set(row.tags.map(({ id }) => id))
    const outcome = tags.has(101) ? 'goal' : tags.has(2101) ? 'blocked' : tags.has(1801) ? 'on target' : tags.has(1802) ? 'not accurate' : 'unclassified'
    shots.push({
      id: event.id, time: formatMatchEventTime(event),
      team: event.team === 'Northbridge' ? 'Arsenal' : 'Leicester City',
      playerId: row.playerId,
      ...(playerNames[row.playerId] ? { playerName: playerNames[row.playerId] } : {}),
      origin: row.positions[0], outcome,
    })
  }
  const scoreAtStart = { Arsenal: 0, 'Leicester City': 0 }
  for (const event of ARSENAL_LEICESTER_MATCH_EVENTS) {
    if (event.type === 'shot' && event.outcome === 'goal' &&
        (elapsedEventSeconds(event) < start || (period.kind === 'after-event' && elapsedEventSeconds(event) === start))) {
      scoreAtStart[event.team === 'Northbridge' ? 'Arsenal' : 'Leicester City']++
    }
  }
  const sequence: PunditFacts['sequence'] = []
  const sequenceRows = [
    { id: '177960899', eventName: 'Shot', playerId: 25413, description: 'Lacazette shot' },
    { id: '177960861', eventName: 'Save attempt', playerId: 8480, description: 'Schmeichel save' },
    { id: '177960900', eventName: 'Free Kick', playerId: 49876, description: 'Xhaka corner' },
    { id: '177960902', eventName: 'Shot', playerId: 26010, description: period.kind === 'before-event' ? 'Giroud goal, after the exclusive window' : 'Giroud goal within the window' },
  ]
  if (anchor.id === '177960902' || anchor.id === '177960849') {
    if (period.kind === 'after-event' && anchor.id === '177960849') {
      sequence.push({ id: anchor.id, time: formatMatchEventTime(anchor), description: 'Ramsey equaliser, excluded from the window' })
    }
    for (const item of sequenceRows) {
      const row = sourceById.get(item.id)
      if (!row || row.eventName !== item.eventName || row.playerId !== item.playerId || row.matchPeriod !== '2H') return
      const absolute = 48 * 60 + row.eventSec
      if (absolute >= start && absolute <= elapsedMatchMinute(request.selectedClock) * 60) {
        const minute = Math.floor(row.eventSec / 60)
        const seconds = (row.eventSec % 60).toFixed(3).padStart(6, '0')
        sequence.push({ id: item.id, time: `2H ${String(minute).padStart(2, '0')}:${seconds}`, description: item.description })
      }
    }
  }
  const shotCounts = {
    Arsenal: shots.filter((shot) => shot.team === 'Arsenal').length,
    'Leicester City': shots.filter((shot) => shot.team === 'Leicester City').length,
  }
  const verifiedPhrases: PunditFacts['verifiedPhrases'] = [{
    token: '[[SHOT_COUNTS]]',
    text: `Arsenal had ${shotCounts.Arsenal} shots to Leicester City's ${shotCounts['Leicester City']} in the spell`,
    eventIds: shots.map(({ id }) => id),
  }]
  const score = { ...scoreAtStart }
  for (const shot of shots) {
    if (shot.outcome !== 'goal') continue
    const team = shot.team === 'Arsenal' ? 'Arsenal' : 'Leicester City'
    score[team]++
    if (shot.playerName) {
      verifiedPhrases.push({
        token: `[[GOAL_${shot.id}]]`,
        text: `${shot.playerName} made it ${score.Arsenal}–${score['Leicester City']}`,
        eventIds: [shot.id],
      })
    }
  }
  const sequenceIds = sequence.map(({ id }) => id)
  if (['177960899', '177960861', '177960900'].every((id) => sequenceIds.includes(id))) {
    verifiedPhrases.push({
      token: '[[SHOT_SAVE_CORNER]]',
      text: 'Lacazette’s shot was followed by Schmeichel’s save and Xhaka’s corner',
      eventIds: ['177960899', '177960861', '177960900'],
    })
  }
  if (sequenceIds.includes('177960902') && period.kind === 'before-event') {
    verifiedPhrases.push({
      token: '[[WINNER_AFTER_SPELL]]',
      text: 'Giroud scored the winner after the counted spell',
      eventIds: ['177960902'],
    })
  }
  if (period.kind === 'after-event' && anchor.id === '177960849') {
    verifiedPhrases.push({
      token: '[[GOAL_177960849]]',
      text: 'Aaron Ramsey made it 3–3 before the spell',
      eventIds: [anchor.id],
    })
  }
  return {
    opinion: request.opinion,
    window: period.kind === 'before-event'
      ? `${exactSourceTime(anchor.clock.period, anchor.sourcePeriodSeconds - period.lookbackSeconds!)} inclusive to ${exactSourceTime(anchor.clock.period, anchor.sourcePeriodSeconds)} exclusive (goal ${anchor.id}).`
      : `After ${exactSourceTime(anchor.clock.period, anchor.sourcePeriodSeconds)} exclusive (goal ${anchor.id}) through ${request.selectedClock.minute}:00 replay time inclusive.`,
    source: `${response.evidenceFoundation.dataset.source} Player identities: Wyscout Players, figshare article 7765196, CC BY 4.0.`,
    scoreAtStart,
    shotCounts,
    shots,
    sequence,
    limitations: [
      'Coordinates are normalized from the attacking team perspective: x increases towards the opposing goal; they are not measured distance or chance quality.',
      'No tracking, possession intervals, passing, pressure observations, defensive shape or tactical causes are mapped.',
      ...new Set(response.claims.flatMap(({ evidenceAvailability }) =>
        evidenceAvailability.filter(({ available }) => !available).map(({ detail }) => detail))),
      'The sequence is chronological; records alone do not prove causation.',
    ],
    verifiedPhrases,
  }
}
