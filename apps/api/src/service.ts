import type {
  AnalysisResponse,
  ClaimEvidence,
  ClaimMetric,
  ClaimResult,
  EvidenceAvailability,
  EvidenceKind,
  EvidenceReference,
  InterpretedClaim,
  TeamStatistic,
} from '../../shared/src/apiContracts.js'
import {
  analyzeMatch,
  elapsedMatchMinute,
  formatMatchClock,
  SYNTHETIC_MATCH_EVENTS,
  TEAMS,
  type MatchEvent,
  type MatchTeam,
} from '../../shared/src/match.js'
import type { InterpretationProvider } from './providers/provider.js'
import { LocalInterpretationProvider } from './providers/local.js'
import { parseAnalysisRequest, validateInterpretation } from './validation.js'

const UNAVAILABLE_EVIDENCE: Partial<Record<EvidenceKind, string>> = {
  possession:
    'The synthetic fixture contains no possession percentages or possession sequence.',
  'territorial-control':
    'The synthetic fixture contains no field-position, territorial progression, or pressure data.',
  'player-events':
    'The synthetic fixture has no player-level event records.',
  passing:
    'The synthetic fixture has no pass counts, pass locations, or passing sequences.',
}

function reference(event: MatchEvent): EvidenceReference {
  return {
    id: event.id,
    time: formatMatchClock(event.clock),
    team: event.team,
    description: event.description,
  }
}

function periodLabel(
  claim: InterpretedClaim,
  selectedPeriodLabel: string,
  events: MatchEvent[],
): string {
  if (claim.timePeriod.kind === 'selected') return selectedPeriodLabel
  const anchorId = claim.timePeriod.eventId
  const anchor = events.find((event) => event.id === anchorId)
  if (!anchor) throw new Error('Validated historical event anchor was not found.')
  return `Recorded match play strictly before ${formatMatchClock(anchor.clock)} (${anchor.id} ${anchor.team} goal)`
}

function eventsForClaim(
  claim: InterpretedClaim,
  selectedEvents: MatchEvent[],
): MatchEvent[] {
  if (claim.timePeriod.kind === 'selected') return selectedEvents
  const anchorId = claim.timePeriod.eventId
  const anchor = selectedEvents.find((event) => event.id === anchorId)
  if (!anchor) return []
  const cutoff = elapsedMatchMinute(anchor.clock)
  return selectedEvents.filter((event) => elapsedMatchMinute(event.clock) < cutoff)
}

function availabilityFor(
  requiredEvidence: EvidenceKind[],
): EvidenceAvailability[] {
  return requiredEvidence.map((kind) => ({
    kind,
    available: UNAVAILABLE_EVIDENCE[kind] === undefined,
    detail:
      UNAVAILABLE_EVIDENCE[kind] ??
      (kind === 'attacking-events'
        ? 'The fixture records a limited set of shots, goals, and other match events.'
        : `The synthetic fixture records ${kind.replaceAll('-', ' ')} events.`),
  }))
}

function metricForEvidence(kind: EvidenceKind): ClaimMetric | undefined {
  if (kind === 'shots' || kind === 'shots-on-target' || kind === 'goals') {
    return kind
  }
  return undefined
}

function matchesMetric(event: MatchEvent, metric: ClaimMetric): boolean {
  if (event.type !== 'shot') return false
  if (metric === 'shots') return true
  if (metric === 'goals') return event.outcome === 'goal'
  return event.outcome === 'goal' || event.outcome === 'saved'
}

function statValue(
  team: MatchTeam,
  metric: ClaimMetric,
  events: MatchEvent[],
): number {
  return events.filter(
    (event) => event.team === team && matchesMetric(event, metric),
  ).length
}

function evidenceForClaim(
  claim: InterpretedClaim,
  result: 'supported' | 'contradicted' | 'insufficient evidence for a firm conclusion' | 'clarification needed',
  events: MatchEvent[],
  availability: EvidenceAvailability[],
  anchorEvent?: MatchEvent,
): ClaimEvidence[] {
  const evidence = new Map<string, ClaimEvidence>()
  const requiredMetrics = claim.requiredEvidence
    .map(metricForEvidence)
    .filter((metric): metric is ClaimMetric => metric !== undefined)
  const wantsAttackingEvents = claim.requiredEvidence.includes('attacking-events')
  const availableKinds = new Set(
    availability.filter((item) => item.available).map((item) => item.kind),
  )

  for (const event of events) {
    const relevant =
      (wantsAttackingEvents && availableKinds.has('attacking-events')) ||
      requiredMetrics.some((metric) => matchesMetric(event, metric))
    if (!relevant) continue

    let role: ClaimEvidence['role'] = 'context'
    const comparison = claim.meaning.comparison
    if (comparison && result !== 'insufficient evidence for a firm conclusion') {
      if (result === 'supported') {
        const operatorSupportsSubject =
          comparison.operator === 'greater-than' ||
          comparison.operator === 'greater-or-equal'
        role =
          comparison.operator === 'equal' ||
          comparison.operator === 'not-equal' ||
          (event.team === claim.subject) === operatorSupportsSubject
            ? 'supporting'
            : 'challenging'
      } else if (result === 'contradicted') {
        role = 'challenging'
      }
    }
    evidence.set(event.id, { role, reference: reference(event) })
  }

  if (claim.historicalEventAnchor && anchorEvent) {
    evidence.set(anchorEvent.id, {
      role: 'anchor',
      reference: reference(anchorEvent),
    })
  }

  return [...evidence.values()]
}

function compare(
  subject: number,
  opponent: number,
  operator: NonNullable<InterpretedClaim['meaning']['comparison']>['operator'],
): boolean {
  switch (operator) {
    case 'greater-than':
      return subject > opponent
    case 'less-than':
      return subject < opponent
    case 'equal':
      return subject === opponent
    case 'greater-or-equal':
      return subject >= opponent
    case 'less-or-equal':
      return subject <= opponent
    case 'not-equal':
      return subject !== opponent
  }
}

function makeLimitation(
  claim: InterpretedClaim,
  availability: EvidenceAvailability[],
  result: ClaimResult['assessment'],
): string {
  const unavailable = availability
    .filter((item) => !item.available)
    .map((item) => item.detail)
  if (claim.clarificationNeeds.length > 0) {
    return claim.clarificationNeeds.join(' ')
  }
  if (unavailable.length > 0) {
    return `${unavailable.join(' ')} These missing data prevent a firm conclusion about "${claim.meaning.description}".`
  }
  if (claim.meaning.category !== 'factual-comparison') {
    return `The fixture records only the evidence listed for this claim. Those events provide context, but do not establish the full subjective judgement "${claim.text}".`
  }
  if (result === 'insufficient evidence for a firm conclusion') {
    return 'No relevant events were recorded in the selected claim period, so this comparison cannot be assessed.'
  }
  return 'This is a comparison of recorded events in the synthetic fixture, not a claim about chance quality or overall performance.'
}

function assessOneClaim(
  claim: InterpretedClaim,
  selectedPeriodEvents: MatchEvent[],
  selectedPeriodLabel: string,
  allSelectedEvents: MatchEvent[],
): ClaimResult {
  const evidenceEvents =
    claim.timePeriod.kind === 'before-event'
      ? eventsForClaim(claim, allSelectedEvents)
      : eventsForClaim(claim, selectedPeriodEvents)
  const anchorEvent = claim.historicalEventAnchor && claim.subject !== null
    ? allSelectedEvents.find(
        (event) => event.id === claim.historicalEventAnchor?.eventId,
      )
    : undefined
  const scopedEvents =
    claim.timePeriod.kind === 'before-event' && anchorEvent
      ? evidenceEvents.filter(
          (event) => elapsedMatchMinute(event.clock) < elapsedMatchMinute(anchorEvent.clock),
        )
      : evidenceEvents
  const availability = availabilityFor(claim.requiredEvidence)
  const canRetrieveSubjectEvidence =
    claim.subject !== null && claim.clarificationNeeds.length === 0
  const statistics: TeamStatistic[] = canRetrieveSubjectEvidence
    ? claim.requiredEvidence.flatMap((kind) => {
        const metric = metricForEvidence(kind)
        if (
          !metric ||
          !availability.some((item) => item.kind === kind && item.available)
        ) {
          return []
        }
        return TEAMS.map((team) => ({
          team,
          metric,
          value: statValue(team, metric, scopedEvents),
        }))
      })
    : []
  const resolvedAvailability = canRetrieveSubjectEvidence ? availability : []

  let assessment: ClaimResult['assessment'] =
    claim.clarificationNeeds.length > 0 || claim.subject === null
      ? 'clarification needed'
      : 'insufficient evidence for a firm conclusion'
  const comparison = claim.meaning.comparison
  if (
    assessment !== 'clarification needed' &&
    comparison &&
    resolvedAvailability.some(
      (item) => item.kind === comparison.metric && item.available,
    ) &&
    scopedEvents.some((event) => matchesMetric(event, comparison.metric))
  ) {
    const subjectValue = statValue(claim.subject!, comparison.metric, scopedEvents)
    const opponentValue = statValue(comparison.opponent, comparison.metric, scopedEvents)
    assessment = compare(subjectValue, opponentValue, comparison.operator)
      ? 'supported'
      : 'contradicted'
  }

  return {
    claim,
    assessment,
    periodLabel: periodLabel(claim, selectedPeriodLabel, allSelectedEvents),
    statistics,
    evidenceAvailability: resolvedAvailability,
    evidence: canRetrieveSubjectEvidence
      ? evidenceForClaim(
          claim,
          assessment,
          scopedEvents,
          resolvedAvailability,
          anchorEvent,
        )
      : [],
    limitation: makeLimitation(claim, availability, assessment),
  }
}

function createSummary(claims: ClaimResult[]): string {
  if (claims.length === 0) {
    return 'Enter an opinion to interpret its claims and retrieve relevant evidence from this synthetic fixture.'
  }

  return claims
    .map((result, index) => {
      const subject = result.claim.subject ?? 'Unclear subject'
      const references = [
        ...result.evidence.filter(({ role }) => role === 'anchor'),
        ...result.evidence.filter(({ role }) => role !== 'anchor'),
      ]
        .slice(0, 2)
        .map(({ reference: item }) => `${item.id} (${item.team}, ${item.time})`)
      const referenceText = references.length
        ? ` References: ${references.join(', ')}.`
        : ''
      const statistics = result.statistics
        .map(
          ({ team, metric, value }) =>
            `${team} ${value} ${metric.replaceAll('-', ' ')}`,
        )
        .join('; ')
      const statisticsText = statistics ? ` Recorded counts: ${statistics}.` : ''
      return `Claim ${index + 1} — ${subject}: ${result.assessment}.${statisticsText} ${result.limitation}${referenceText}`
    })
    .join('\n')
}

export async function analyzeOpinion(
  input: unknown,
  provider: InterpretationProvider = new LocalInterpretationProvider(),
): Promise<AnalysisResponse> {
  const request = parseAnalysisRequest(input)
  const matchEvents = SYNTHETIC_MATCH_EVENTS
  const matchSoFar = analyzeMatch(
    matchEvents,
    request.selectedClock,
    'match-so-far',
  )
  const matchAnalysis = analyzeMatch(
    matchEvents,
    request.selectedClock,
    request.period,
  )
  const selectedElapsedMinute = elapsedMatchMinute(request.selectedClock)
  const eventsThroughSelectedTime = matchEvents.filter(
    (event) => elapsedMatchMinute(event.clock) <= selectedElapsedMinute,
  )
  const selectedTime = formatMatchClock(request.selectedClock)
  const selectedPeriodLabel =
    request.period === 'match-so-far'
      ? `Match so far through ${selectedTime}`
      : `Last 10 minutes ending ${selectedTime}`
  const interpreted = request.opinion
    ? await provider.interpret(request.opinion, {
        events: eventsThroughSelectedTime,
        selectedClock: request.selectedClock,
        selectedTime,
        period: request.period,
      })
    : { claims: [] }
  const claims = validateInterpretation(interpreted, eventsThroughSelectedTime)
  const results = claims.map((claim) =>
    assessOneClaim(
      claim,
      matchAnalysis.periodEvents,
      selectedPeriodLabel,
      eventsThroughSelectedTime,
    ),
  )
  const periodStatistics: AnalysisResponse['periodStatistics'] = {
    Northbridge: {
      shots: matchAnalysis.shots.Northbridge.shots,
      shotsOnTarget: matchAnalysis.shots.Northbridge.shotsOnTarget,
      goals: matchAnalysis.periodEvents.filter(
        (event) =>
          event.type === 'shot' &&
          event.team === 'Northbridge' &&
          event.outcome === 'goal',
      ).length,
    },
    Eastport: {
      shots: matchAnalysis.shots.Eastport.shots,
      shotsOnTarget: matchAnalysis.shots.Eastport.shotsOnTarget,
      goals: matchAnalysis.periodEvents.filter(
        (event) =>
          event.type === 'shot' &&
          event.team === 'Eastport' &&
          event.outcome === 'goal',
      ).length,
    },
  }
  const response: AnalysisResponse = {
    provider: provider.name,
    providerLabel:
      provider.name === 'foundry'
        ? 'Microsoft Foundry structured-output model'
        : 'Server-side local rule-based interpreter (no model connection)',
    summary: createSummary(results),
    selectedTime,
    selectedPeriodLabel,
    score: matchSoFar.score,
    periodStatistics,
    periodEvents: matchAnalysis.periodEvents.map(reference),
    claims: results,
  }

  return response
}
