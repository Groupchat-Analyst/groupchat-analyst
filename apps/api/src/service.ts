import type {
  AnalysisResponse,
  ClaimEvidence,
  ClaimMetric,
  ClaimResult,
  EvidenceAvailability,
  EvidenceKind,
  EvidenceReference,
  CalculationTrace,
  InterpretedClaim,
  TeamStatistic,
} from '../../shared/src/apiContracts.js'
import {
  calculateEvidence,
  classifyPitchArea,
  EVIDENCE_CAPABILITIES,
  SYNTHETIC_MATCH_EVIDENCE,
  type EvidenceCalculation,
} from '../../shared/src/evidence.js'
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
  'territorial-control':
    'The fixture includes selected event locations, but not continuous field-position, territory, or defensive-shape tracking.',
  'player-events':
    'The fixture has fictional player IDs and lineup records, but no complete player-performance event dataset.',
  'physical-measurements':
    'Running distance and other physical measurements are not recorded; this fixture has no physical-data or continuous-tracking source.',
  'build-up-phase':
    'The fixture does not define or label a build-up phase, so turnovers cannot be filtered to build-up specifically.',
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
  if (
    kind === 'shots' ||
    kind === 'shots-on-target' ||
    kind === 'goals'
  ) {
    return kind
  }
  if (kind === 'possession') return 'possession-percentage'
  return undefined
}

function matchesMetric(event: MatchEvent, metric: ClaimMetric): boolean {
  if (event.type !== 'shot') return false
  if (metric === 'possession-percentage') return false
  if (metric === 'shots') return true
  if (metric === 'goals') return event.outcome === 'goal'
  return event.outcome === 'goal' || event.outcome === 'saved'
}

function statValue(
  team: MatchTeam,
  metric: ClaimMetric,
  events: MatchEvent[],
  advanced: EvidenceCalculation,
): number {
  if (metric === 'possession-percentage') {
    return advanced.teams[team].possessionPercentage ?? 0
  }
  if (metric === 'pass-attempts') return advanced.teams[team].passAttempts
  if (metric === 'pass-completions') return advanced.teams[team].completedPasses
  if (metric === 'pass-completion-percentage') {
    return advanced.teams[team].passCompletionPercentage ?? 0
  }
  return events.filter(
    (event) => event.team === team && matchesMetric(event, metric),
  ).length
}

function evidenceForClaim(
  claim: InterpretedClaim,
  result: ClaimResult['assessment'],
  events: MatchEvent[],
  availability: EvidenceAvailability[],
  advanced: EvidenceCalculation,
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
  const historicalCutoff = anchorEvent
    ? elapsedMatchMinute(anchorEvent.clock)
    : undefined

  if (
    claim.intent === 'statistical-request' &&
    claim.meaning.comparison?.metric === 'pass-completion-percentage'
  ) {
    for (const pass of advanced.passes) {
      if (pass.team !== claim.subject && pass.team !== claim.meaning.comparison.opponent) continue
      evidence.set(pass.id, {
        role: 'calculation',
        reference: {
          id: pass.id,
          time: formatMatchClock(pass.clock),
          team: pass.team,
          description: `${pass.outcome === 'complete' ? 'Completed' : 'Incomplete'} pass by ${pass.playerId}.`,
        },
      })
    }
    return [...evidence.values()]
  }

  if (claim.intent === 'coaching-question' && availableKinds.has('possession-losses')) {
    const turnovers = advanced.turnovers.filter(
      (turnover) => claim.subject === null || turnover.team === claim.subject,
    )
    const linkedPassIds = new Set(turnovers.map(({ lostPassId }) => lostPassId))
    const passes = advanced.passes.filter((pass) => linkedPassIds.has(pass.id))
    for (const turnover of turnovers) {
      evidence.set(turnover.id, {
        role: 'calculation',
        reference: {
          id: turnover.id,
          time: formatMatchClock(turnover.clock),
          team: turnover.team,
          description: `Recorded incomplete-pass turnover in the ${classifyPitchArea(turnover.location)} at (${turnover.location.x}, ${turnover.location.y}); linked pass ${turnover.lostPassId}.`,
        },
      })
    }
    for (const pass of passes) {
      evidence.set(pass.id, {
        role: 'calculation',
        reference: {
          id: pass.id,
          time: formatMatchClock(pass.clock),
          team: pass.team,
          description: `Linked ${pass.outcome} pass by ${pass.playerId}, from (${pass.start.x}, ${pass.start.y}) to (${pass.end.x}, ${pass.end.y}).`,
        },
      })
    }
    return [...evidence.values()]
  }

  if (
    claim.intent === 'unavailable-metric' ||
    claim.intent === 'unrecognized-language'
  ) {
    return []
  }

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

  const addEvidence = (
    id: string,
    time: string,
    team: EvidenceReference['team'],
    description: string,
    subjectTeam: MatchTeam,
  ) => {
    const comparison = claim.meaning.comparison
    let role: ClaimEvidence['role'] = 'context'
    if (comparison && result !== 'insufficient evidence for a firm conclusion') {
      const operatorSupportsSubject =
        comparison.operator === 'greater-than' ||
        comparison.operator === 'greater-or-equal'
      if (comparison.operator === 'equal' || comparison.operator === 'not-equal') {
        role = 'supporting'
      } else {
        role = (subjectTeam === claim.subject) === operatorSupportsSubject
          ? 'supporting'
          : 'challenging'
      }
    }
    evidence.set(id, {
      role,
      reference: { id, time, team, description },
    })
  }

  if (availableKinds.has('possession')) {
    for (const interval of advanced.possessionIntervals) {
      if (interval.status !== 'controlled' || !interval.team) continue
      const role: ClaimEvidence['role'] =
        claim.intent === 'subjective-judgement' &&
        claim.requiredEvidence.includes('possession') &&
        interval.team !== claim.subject
          ? 'challenging'
          : claim.intent === 'subjective-judgement' &&
              claim.requiredEvidence.includes('possession')
            ? 'supporting'
              : 'context'
      evidence.set(interval.id, {
        role,
        reference: {
            id: interval.id,
            time: `${formatMatchClock(interval.start)}–${formatMatchClock(interval.end)}`,
            team: interval.team,
            description: `${interval.durationMinutes} recorded minutes of controlled possession.`,
        },
      })
    }
  }
  if (availableKinds.has('passing')) {
    for (const pass of advanced.passes) {
      if (
        historicalCutoff !== undefined &&
        elapsedMatchMinute(pass.clock) >= historicalCutoff
      ) {
        continue
      }
      addEvidence(
        pass.id,
        formatMatchClock(pass.clock),
        pass.team,
        `${pass.outcome === 'complete' ? 'Completed' : 'Incomplete'} pass by ${pass.playerId} from (${pass.start.x}, ${pass.start.y}) to (${pass.end.x}, ${pass.end.y}).`,
        pass.team,
      )
    }
  }
  if (availableKinds.has('possession-losses')) {
    for (const turnover of advanced.turnovers) {
      if (
        historicalCutoff !== undefined &&
        elapsedMatchMinute(turnover.clock) >= historicalCutoff
      ) {
        continue
      }
      addEvidence(
        turnover.id,
        formatMatchClock(turnover.clock),
        turnover.team,
        `Possession lost in the ${classifyPitchArea(turnover.location).replaceAll('-', ' ')}; linked to ${turnover.lostPassId}.`,
        turnover.team,
      )
    }
  }

  if (claim.historicalEventAnchor && anchorEvent) {
    evidence.set(anchorEvent.id, {
      role: 'anchor',
      reference: reference(anchorEvent),
    })
  }

  return [...evidence.values()]
}

function calculationTraces(
  claim: InterpretedClaim,
  advanced: EvidenceCalculation,
): CalculationTrace[] {
  const teams =
    claim.intent === 'coaching-question'
      ? claim.subject
        ? [claim.subject]
        : TEAMS
      : claim.meaning.comparison
        ? TEAMS.filter(
            (team) => team === claim.subject || team === claim.meaning.comparison?.opponent,
          )
        : claim.intent === 'subjective-judgement' &&
            claim.requiredEvidence.includes('possession')
          ? TEAMS
            : claim.requiredEvidence.includes('possession')
              ? TEAMS
            : []
  const traces: CalculationTrace[] = []

  for (const team of teams) {
    if (
      claim.meaning.comparison?.metric === 'pass-completion-percentage' &&
      advanced.passCoverageComplete
    ) {
      const passes = advanced.passes.filter((pass) => pass.team === team)
      const completed = passes.filter((pass) => pass.outcome === 'complete')
      traces.push({
        team,
        metric: 'pass-completion-percentage',
        value:
          passes.length === 0
            ? 0
            : Number(((completed.length / passes.length) * 100).toFixed(1)),
        numerator: completed.length,
        denominator: passes.length,
        numeratorRecordIds: completed.map(({ id }) => id),
        denominatorRecordIds: passes.map(({ id }) => id),
        denominatorDescription: `All ${passes.length} recorded pass attempts for ${team} in ${advanced.startElapsed}–${advanced.endElapsed} played minutes.`,
      })
      continue
    }

    if (
      claim.intent !== 'coaching-question' &&
      (claim.meaning.comparison?.metric === 'possession-percentage' ||
        claim.requiredEvidence.includes('possession'))
    ) {
      const controlled = advanced.possessionIntervals.filter(
        (interval) => interval.status === 'controlled' && interval.team === team,
      )
      traces.push({
        team,
        metric: 'possession-percentage',
        value: advanced.teams[team].possessionPercentage ?? 0,
        numerator: advanced.teams[team].possessionMinutes,
        denominator: advanced.denominatorMinutes,
        numeratorRecordIds: controlled.map(({ id }) => id),
        denominatorRecordIds: advanced.possessionIntervals
          .filter((interval) => interval.status === 'controlled')
          .map(({ id }) => id),
        denominatorDescription: `${advanced.denominatorMinutes} total recorded controlled-possession minutes; contested and out-of-play intervals excluded.`,
      })
      continue
    }

    if (claim.intent === 'coaching-question') {
      const turnovers = advanced.turnovers.filter(
        (turnover) => turnover.team === team,
      )
      for (const area of [
        'defensive-third',
        'middle-third',
        'final-third',
      ] as const) {
        const inArea = turnovers.filter(
          (turnover) => classifyPitchArea(turnover.location) === area,
        )
        traces.push({
          team,
          metric: 'possession-losses-by-area',
          area,
          value: inArea.length,
          numerator: inArea.length,
          denominator: turnovers.length,
          numeratorRecordIds: inArea.map(({ id }) => id),
          denominatorRecordIds: turnovers.map(({ id }) => id),
          denominatorDescription: `All ${turnovers.length} recorded pass-turnover records for ${team}; no build-up-phase filter is available.`,
        })
      }
    }
  }
  return traces
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
    case 'comparison-request':
      throw new Error('A statistical comparison request does not have a truth verdict.')
  }
}

function makeLimitation(
  claim: InterpretedClaim,
  availability: EvidenceAvailability[],
  result: ClaimResult['assessment'],
  advanced: EvidenceCalculation,
): string {
  const unavailable = availability
    .filter((item) => !item.available)
    .map((item) => item.detail)
  if (claim.clarificationNeeds.length > 0) {
    return claim.clarificationNeeds.join(' ')
  }
  if (claim.intent === 'unavailable-metric') {
    return unavailable.length > 0
      ? unavailable.join(' ')
      : 'The requested metric is not recorded in this synthetic fixture.'
  }
  if (claim.intent === 'unrecognized-language') {
    return 'The local interpreter cannot reliably identify the requested football evidence. No unrelated statistics or events were selected.'
  }
  if (claim.intent === 'statistical-request') {
    return 'Descriptive statistics are provided from the recorded synthetic events; this request does not receive a supported/contradicted truth verdict.'
  }
  if (claim.intent === 'coaching-question') {
    const phaseNotRecorded = unavailable.find((detail) =>
      /does not define or label a build-up phase/i.test(detail),
    )
    const turnovers = claim.subject
      ? advanced.turnovers.filter(({ team }) => team === claim.subject)
      : advanced.turnovers
    const teamSummary = claim.subject
      ? `for ${claim.subject}`
      : 'for both teams'
    const areaCounts = (['defensive-third', 'middle-third', 'final-third'] as const)
      .map((area) =>
        `${area} ${turnovers.filter(({ location }) => classifyPitchArea(location) === area).length}`,
      )
      .join(', ')
    return `${phaseNotRecorded ?? ''} The fixture has no build-up-phase filter, so this is an all-pass-turnover breakdown ${teamSummary}: ${areaCounts} (${turnovers.length} recorded turnovers total). The recorded locations do not establish why possession was lost or explain a tactical cause.`
  }
  if (
    claim.intent === 'subjective-judgement' &&
    claim.requiredEvidence.includes('possession') &&
    claim.subject
  ) {
    const opponent = TEAMS.find((team) => team !== claim.subject)!
    const ownShare = advanced.teams[claim.subject].possessionPercentage
    const opponentShare = advanced.teams[opponent].possessionPercentage
    if (ownShare !== null && opponentShare !== null) {
      return `${claim.subject} recorded ${ownShare}% possession versus ${opponent}'s ${opponentShare}%; this challenges the possession-majority aspect of the claim. These figures do not establish the full subjective judgement "${claim.text}" or overall dominance.`
    }
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
  if (claim.meaning.comparison?.metric === 'possession-percentage') {
    return 'Possession percentage is calculated only across recorded controlled-possession minutes; contested and out-of-play time are excluded. It does not establish territorial control, chance quality, or overall performance.'
  }
  return 'This is a comparison of recorded events in the synthetic fixture, not a claim about chance quality or overall performance.'
}

function assessOneClaim(
  claim: InterpretedClaim,
  selectedPeriodEvents: MatchEvent[],
  selectedPeriodLabel: string,
  allSelectedEvents: MatchEvent[],
  advanced: EvidenceCalculation,
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
          (event) =>
            elapsedMatchMinute(event.clock) <
            elapsedMatchMinute(anchorEvent.clock),
        )
        : evidenceEvents
  const availability = availabilityFor(claim.requiredEvidence)
  const canRetrieveSubjectEvidence =
    (claim.subject !== null ||
      claim.meaning.category === 'coaching-question') &&
    claim.clarificationNeeds.length === 0
  const availableForIntent = claim.intent !== 'unavailable-metric' &&
    claim.intent !== 'unrecognized-language'
  const statistics: TeamStatistic[] = canRetrieveSubjectEvidence && availableForIntent
    ? claim.intent === 'statistical-request' &&
        claim.meaning.comparison?.metric === 'pass-completion-percentage'
      ? TEAMS.flatMap((team) => ([
          { team, metric: 'pass-attempts' as const, value: advanced.teams[team].passAttempts },
          { team, metric: 'pass-completions' as const, value: advanced.teams[team].completedPasses },
          { team, metric: 'pass-completion-percentage' as const, value: advanced.teams[team].passCompletionPercentage ?? 0 },
        ]))
      : claim.intent === 'subjective-judgement' &&
          claim.requiredEvidence.includes('possession') &&
          advanced.possessionCoverageComplete
        ? TEAMS.map((team) => ({
            team,
            metric: 'possession-percentage' as const,
            value: advanced.teams[team].possessionPercentage ?? 0,
          }))
        : claim.requiredEvidence.flatMap((kind) => {
        const metric = metricForEvidence(kind)
        if (
          !metric ||
          !availability.some((item) => item.kind === kind && item.available)
        ) {
          return []
        }
        if (
          metric === 'possession-percentage' &&
          (advanced.denominatorMinutes === 0 ||
            !advanced.possessionCoverageComplete)
        ) {
          return []
        }
        const relevantTeams = claim.meaning.comparison
          ? TEAMS.filter(
              (team) => team === claim.subject || team === claim.meaning.comparison?.opponent,
            )
          : TEAMS
        return relevantTeams.map((team) => ({
          team,
          metric,
          value: statValue(team, metric, scopedEvents, advanced),
        }))
      })
    : []
  const resolvedAvailability =
    canRetrieveSubjectEvidence && claim.intent !== 'unrecognized-language'
      ? availability
      : []

  let assessment: ClaimResult['assessment'] =
    claim.clarificationNeeds.length > 0 ||
    (claim.subject === null && claim.meaning.category !== 'coaching-question')
      ? 'clarification needed'
      : 'insufficient evidence for a firm conclusion'
  if (assessment !== 'clarification needed' && claim.intent === 'statistical-request') {
    assessment = 'statistics provided'
  } else if (assessment !== 'clarification needed' && claim.intent === 'unavailable-metric') {
    assessment = 'unavailable data'
  } else if (assessment !== 'clarification needed' && claim.intent === 'unrecognized-language') {
    assessment = 'unrecognized language'
  }
  const comparison = claim.meaning.comparison
  const comparisonEvidenceKind =
    comparison?.metric === 'possession-percentage'
      ? 'possession'
      : comparison?.metric
  if (
    assessment !== 'clarification needed' &&
    comparison &&
    claim.intent !== 'statistical-request' &&
    claim.intent !== 'unavailable-metric' &&
    comparisonEvidenceKind &&
    resolvedAvailability.some(
      (item) => item.kind === comparisonEvidenceKind && item.available,
    ) &&
    (comparison.metric === 'possession-percentage'
      ? advanced.denominatorMinutes > 0 && advanced.possessionCoverageComplete
      : scopedEvents.some((event) => matchesMetric(event, comparison.metric)))
  ) {
    const subjectValue = statValue(
      claim.subject!,
      comparison.metric,
      scopedEvents,
      advanced,
    )
    const opponentValue = statValue(
      comparison.opponent,
      comparison.metric,
      scopedEvents,
      advanced,
    )
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
          advanced,
          anchorEvent,
        )
      : [],
    calculations: calculationTraces(claim, advanced),
    limitation: makeLimitation(claim, availability, assessment, advanced),
  }
}

function createSummary(claims: ClaimResult[]): string {
  if (claims.length === 0) {
    return 'Enter an opinion to interpret its claims and retrieve relevant evidence from this synthetic fixture.'
  }

  return claims
    .map((result, index) => {
      const subject =
        result.claim.subject ??
        (result.claim.meaning.category === 'coaching-question'
          ? 'Both teams'
          : 'Unclear subject')
      const evidenceExamples =
        result.claim.intent === 'coaching-question'
          ? (() => {
              const turnover = result.evidence.find(({ reference: item }) =>
                item.id.startsWith('turnover-'),
              )
              const linkedPassId = turnover?.reference.description.match(
                /linked pass (pass-\d+)/i,
              )?.[1]
              const linkedPass = result.evidence.find(
                ({ reference: item }) => item.id === linkedPassId,
              )
              return [turnover, linkedPass].filter(
                (item): item is ClaimEvidence => item !== undefined,
              )
            })()
          : result.claim.intent === 'statistical-request'
            ? TEAMS.map((team) =>
                result.evidence.find(({ reference: item }) => item.team === team),
              ).filter((item): item is ClaimEvidence => item !== undefined)
            : [
                ...result.evidence.filter(({ role }) => role === 'anchor'),
                ...result.evidence.filter(({ role }) => role !== 'anchor'),
              ].slice(0, 2)
      const references = evidenceExamples.map(
        ({ reference: item }) => `${item.id} (${item.team}, ${item.time})`,
      )
      const referenceText = references.length
        ? ` Example references (abbreviated): ${references.join(', ')}.`
        : ''
      const statistics = result.statistics
        .map(
          ({ team, metric, value }) =>
            `${team} ${value}${metric.includes('percentage') ? '%' : ''} ${metric.replaceAll('-', ' ')}`,
        )
        .join('; ')
      const passCalculations = result.calculations.filter(
        ({ metric }) => metric === 'pass-completion-percentage',
      )
      const possessionCalculations = result.calculations.filter(
        ({ metric }) => metric === 'possession-percentage',
      )
      const lossCalculations = result.calculations.filter(
        ({ metric }) => metric === 'possession-losses-by-area',
      )
      const lossLead = lossCalculations.length
        ? ` Available all-pass turnover locations: ${lossCalculations
            .map(({ area, value }) => `${area} ${value}`)
            .join(', ')} (${lossCalculations[0].denominator} recorded turnovers total).`
        : ''
      const calculationText = passCalculations.length
        ? ` Pass completion calculation: ${passCalculations
            .map(({ team, numerator, denominator, value }) =>
              `${team} ${numerator}/${denominator} (${value}%), denominator all ${denominator} recorded passes`,
            )
            .join('; ')}.`
        : possessionCalculations.length
          ? ` Possession calculation denominator: ${possessionCalculations[0].denominator} controlled-possession minutes.`
          : ''
      const statisticsText = statistics ? ` Recorded statistics: ${statistics}.` : ''
      return `Claim ${index + 1} — ${subject}:${lossLead} ${result.assessment}.${statisticsText}${calculationText} ${result.limitation}${referenceText}`
    })
    .join('\n')
}

function evidenceReference(
  id: string,
  time: string,
  team: EvidenceReference['team'],
  description: string,
): EvidenceReference {
  return { id, time, team, description }
}

function createEvidenceFoundation(
  advanced: EvidenceCalculation,
  periodLabel: string,
): AnalysisResponse['evidenceFoundation'] {
  const passReferences = advanced.passes.map((pass) =>
    evidenceReference(
      pass.id,
      formatMatchClock(pass.clock),
      pass.team,
      `${pass.outcome === 'complete' ? 'Completed' : 'Incomplete'} pass by ${pass.playerId} from (${pass.start.x}, ${pass.start.y}) to (${pass.end.x}, ${pass.end.y}).`,
    ),
  )
  const turnoverReferences = advanced.turnovers.map((turnover) =>
    evidenceReference(
      turnover.id,
      formatMatchClock(turnover.clock),
      turnover.team,
      `Lost possession in the ${classifyPitchArea(turnover.location).replaceAll('-', ' ')}; ${turnover.recoveredBy ? `recovered by ${turnover.recoveredBy}` : 'recovery team not recorded'}.`,
    ),
  )
  const recoveryReferences = advanced.recoveries.map((recovery) =>
    evidenceReference(
      recovery.id,
      formatMatchClock(recovery.clock),
      recovery.team,
      `Recovery following ${recovery.turnoverId} at (${recovery.location.x}, ${recovery.location.y}).`,
    ),
  )
  const pressureReferences = advanced.pressures.map((pressure) =>
    evidenceReference(
      pressure.id,
      formatMatchClock(pressure.clock),
      pressure.team,
      `Recorded ${pressure.type.replaceAll('-', ' ')} pressure at (${pressure.location.x}, ${pressure.location.y}); pressure coverage is partial.`,
    ),
  )

  return {
    dataset: {
      id: SYNTHETIC_MATCH_EVIDENCE.dataset.id,
      version: SYNTHETIC_MATCH_EVIDENCE.dataset.version,
      label: SYNTHETIC_MATCH_EVIDENCE.dataset.label,
      source: SYNTHETIC_MATCH_EVIDENCE.dataset.source,
      provenance: SYNTHETIC_MATCH_EVIDENCE.dataset.provenance,
    },
    capabilities: EVIDENCE_CAPABILITIES,
    possessionDenominatorMinutes: advanced.denominatorMinutes,
    possessionCoverageComplete: advanced.possessionCoverageComplete,
    passCoverageComplete: advanced.passCoverageComplete,
    turnoverCoverageComplete: advanced.turnoverCoverageComplete,
    missingCoveragePeriods: advanced.missingCoveragePeriods,
    excludedOutOfPlayMinutes: advanced.excludedOutOfPlayMinutes,
    contestedMinutes: advanced.contestedMinutes,
    metricDefinitions: [
      'Possession percentage = each team’s controlled-possession minutes divided by the sum of both teams’ controlled-possession minutes. Contested and out-of-play intervals are excluded.',
      'Pass completion = completed recorded passes divided by pass attempts in the selected window.',
      'Pass attempts, completions, percentage, numerator IDs, and denominator IDs are returned as a calculation trace for statistical requests.',
      'Possession losses are recorded incomplete-pass turnovers grouped by the x-coordinate of the pass endpoint: defensive third <33.3, middle third 33.3–<66.7, final third >=66.7.',
      'Final-third entries count completed passes whose start is outside and endpoint is inside the final third (x >=66.7).',
      'No build-up phase is defined in this fixture; turnover area counts are for all recorded incomplete-pass turnovers, not a build-up-specific subset.',
      'Intervals use half-aware clocks and are clipped to the selected window; halftime has no possession duration. A clipped interval omits its eventual end reason.',
      'Event references use stable fixture IDs, team/player IDs, period-aware match timestamps, dataset version 2.0.0, and synthetic provenance.',
    ],
    teams: advanced.teams,
    possessionIntervals: advanced.possessionIntervals.map((interval) => ({
      id: interval.id,
      team: interval.team,
      status: interval.status,
      start: formatMatchClock(interval.start),
      end: formatMatchClock(interval.end),
      durationMinutes: interval.durationMinutes,
      relatedEventIds: interval.relatedEventIds,
      ...(interval.endReason ? { endReason: interval.endReason } : {}),
    })),
    passRecords: advanced.passes.map((pass) => ({
      id: pass.id,
      possessionId: pass.possessionId,
      team: pass.team,
      playerId: pass.playerId,
      time: formatMatchClock(pass.clock),
      start: pass.start,
      end: pass.end,
      outcome: pass.outcome,
      qualifiers: pass.qualifiers,
      provenance: pass.provenance,
    })),
    turnoverRecords: advanced.turnovers.map((turnover) => ({
      id: turnover.id,
      possessionId: turnover.possessionId,
      team: turnover.team,
      time: formatMatchClock(turnover.clock),
      location: turnover.location,
      lostPassId: turnover.lostPassId,
      recoveredBy: turnover.recoveredBy,
      provenance: turnover.provenance,
    })),
    passReferences,
    turnoverReferences,
    recoveryReferences,
    pressureReferences,
    players: SYNTHETIC_MATCH_EVIDENCE.players,
    substitutions: SYNTHETIC_MATCH_EVIDENCE.substitutions
      .filter(
        (substitution) =>
          elapsedMatchMinute(substitution.clock) <= advanced.endElapsed,
      )
      .map((substitution) => ({
        id: substitution.id,
        team: substitution.team,
        time: formatMatchClock(substitution.clock),
        playerOnId: substitution.playerOnId,
        playerOffId: substitution.playerOffId,
      })),
    windowLabel: periodLabel,
  }
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
  const advanced = calculateEvidence(
    SYNTHETIC_MATCH_EVIDENCE,
    request.selectedClock,
    request.period,
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
        capabilities: EVIDENCE_CAPABILITIES,
      })
    : { claims: [] }
  const claims = validateInterpretation(interpreted, eventsThroughSelectedTime)
  const results = claims.map((claim) => {
    const anchorEventId =
      claim.timePeriod.kind === 'before-event'
        ? claim.timePeriod.eventId
        : undefined
    const anchor =
      anchorEventId
        ? eventsThroughSelectedTime.find(
            (event) => event.id === anchorEventId,
          )
        : undefined
    const claimAdvanced = anchor
      ? calculateEvidence(
          SYNTHETIC_MATCH_EVIDENCE,
          anchor.clock,
          'match-so-far',
        )
      : advanced
    return assessOneClaim(
      claim,
      matchAnalysis.periodEvents,
      selectedPeriodLabel,
      eventsThroughSelectedTime,
      claimAdvanced,
    )
  })
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
    evidenceFoundation: createEvidenceFoundation(advanced, selectedPeriodLabel),
    claims: results,
  }

  return response
}
