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
  PlayerCalculationTrace,
  PlayerEntityReference,
  PlayerStatistic,
  TeamStatistic,
} from '../../shared/src/apiContracts.js'
import {
  calculateEvidence,
  classifyPitchArea,
  EVIDENCE_CAPABILITIES,
  SYNTHETIC_MATCH_EVIDENCE,
  type EvidenceCalculation,
  type SyntheticMatchEvidence,
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
import {
  InterpretationProviderError,
  type InterpretationProvider,
} from './providers/provider.js'
import { LocalInterpretationProvider } from './providers/local.js'
import { parseAnalysisRequest, validateInterpretation } from './validation.js'

const UNAVAILABLE_EVIDENCE: Partial<Record<EvidenceKind, string>> = {
  'territorial-control':
    'The fixture includes selected event locations, but not continuous field-position, territory, or defensive-shape tracking.',
  'physical-measurements':
    'Running distance and other physical measurements are not recorded; this fixture has no physical-data or continuous-tracking source.',
}

function reference(event: MatchEvent): EvidenceReference {
  const shooter =
    event.type === 'shot' && event.playerId
      ? SYNTHETIC_MATCH_EVIDENCE.players.find(
          ({ id }) => id === event.playerId,
        )
      : undefined
  return {
    id: event.id,
    time: formatMatchClock(event.clock),
    team: event.team,
    description: shooter
      ? `${event.description} Shooter: ${shooter.name} (${shooter.id}).`
      : event.description,
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
      (kind === 'build-up-phase'
        ? 'A small versioned sample labels build-up sequences and links selected passes, turnovers, and pressure events; coverage is not complete for the match.'
        : undefined) ??
      (kind === 'player-events'
        ? 'Selected synthetic actions have player IDs, but this is sparse event evidence rather than a complete player-performance dataset.'
        : undefined) ??
      (kind === 'attacking-events'
        ? 'The fixture records a limited set of shots, goals, and other match events.'
        : `The synthetic fixture records ${kind.replaceAll('-', ' ')} events.`),
  }))
}

function metricForEvidence(
  kind: EvidenceKind,
  claim?: InterpretedClaim,
): ClaimMetric | undefined {
  if (
    kind === 'shots' ||
    kind === 'shots-on-target' ||
    kind === 'goals'
  ) {
    return kind
  }
  if (kind === 'possession') return 'possession-percentage'
  if (
    kind === 'passing' &&
    claim?.meaning.comparison &&
    [
      'pass-attempts',
      'pass-completions',
      'pass-completion-percentage',
    ].includes(claim.meaning.comparison.metric)
  ) {
    return claim.meaning.comparison.metric
  }
  return undefined
}

function matchesMetric(event: MatchEvent, metric: ClaimMetric): boolean {
  if (event.type !== 'shot') return false
  if (metric === 'possession-percentage') return false
  if (metric === 'shots') return true
  if (metric === 'goals') return event.outcome === 'goal'
  if (metric === 'shots-on-target') {
    return event.outcome === 'goal' || event.outcome === 'saved'
  }
  return false
}

function statValue(
  team: MatchTeam,
  metric: ClaimMetric,
  events: MatchEvent[],
  advanced: EvidenceCalculation,
): number | null {
  if (metric === 'possession-percentage') {
    return advanced.teams[team].possessionPercentage
  }
  if (metric === 'pass-attempts') return advanced.teams[team].passAttempts
  if (metric === 'pass-completions') return advanced.teams[team].completedPasses
  if (metric === 'pass-completion-percentage') {
    return advanced.teams[team].passCompletionPercentage
  }
  if (metric === 'shots' || metric === 'shots-on-target' || metric === 'goals') {
    return events.filter(
      (event) => event.team === team && matchesMetric(event, metric),
    ).length
  }
  // An unsupported metric must never inherit a shot count.
  return null
}

function selectedPlayerEntities(claim: InterpretedClaim): PlayerEntityReference[] {
  const entities = [
    claim.playerSubject,
    claim.meaning.comparison?.opponentPlayer ?? null,
  ].filter((player): player is PlayerEntityReference => player !== null)
  return [...new Map(entities.map((player) => [player.id, player])).values()]
}

function selectedWindowMinutes(
  player: PlayerEntityReference,
  fixture: SyntheticMatchEvidence,
  advanced: EvidenceCalculation,
): number {
  const record = fixture.players.find(({ id }) => id === player.id)
  const subs = fixture.substitutions.filter(({ team }) => team === player.team)
  let entered = record?.status === 'starter' ? 0 : Number.POSITIVE_INFINITY
  let left = Number.POSITIVE_INFINITY
  for (const sub of subs) {
    const at = elapsedMatchMinute(sub.clock)
    if (sub.playerOnId === player.id) entered = at
    if (sub.playerOffId === player.id) left = at
  }
  return Math.max(
    0,
    Number(
      (
        Math.min(advanced.endElapsed, left) -
        Math.max(advanced.startElapsed, entered)
      ).toFixed(1),
    ),
  )
}

function playerResults(
  claim: InterpretedClaim,
  advanced: EvidenceCalculation,
  events: MatchEvent[],
  fixture: SyntheticMatchEvidence,
): { statistics: PlayerStatistic[]; calculations: PlayerCalculationTrace[] } {
  const statistics: PlayerStatistic[] = []
  const calculations: PlayerCalculationTrace[] = []
  const entities = selectedPlayerEntities(claim)
  for (const player of entities) {
    const passes = advanced.passes.filter(({ playerId }) => playerId === player.id)
    const completed = passes.filter(({ outcome }) => outcome === 'complete')
    const shots = events.filter(
      (event) => event.type === 'shot' && event.playerId === player.id,
    )
    const onTarget = shots.filter(
      (event) =>
        event.type === 'shot' &&
        (event.outcome === 'goal' || event.outcome === 'saved'),
    )
    const goals = shots.filter(
      (event) => event.type === 'shot' && event.outcome === 'goal',
    )
    const recoveries = advanced.recoveries.filter(
      ({ playerId }) => playerId === player.id,
    )
    const pressures = advanced.pressures.filter(
      ({ playerId }) => playerId === player.id,
    )
    const requestedMetric =
      claim.playerMetric ??
      (claim.meaning.comparison?.opponentPlayer
        ? claim.meaning.comparison.metric
        : null)
    const requestedMetrics = requestedMetric === 'pass-completion-percentage'
      ? new Set(['pass-attempts', 'pass-completions', 'pass-completion-percentage'])
      : requestedMetric
        ? new Set([requestedMetric])
        : null
    const values: Array<[PlayerStatistic['metric'], number | null]> = [
      ['pass-attempts', passes.length],
      ['pass-completions', completed.length],
      [
        'pass-completion-percentage',
        passes.length > 0 && advanced.passCoverageComplete
          ? Number(((completed.length / passes.length) * 100).toFixed(1))
          : null,
      ],
      ['shots', shots.length],
      ['shots-on-target', onTarget.length],
      ['goals', goals.length],
      ['minutes-played', selectedWindowMinutes(player, fixture, advanced)],
      ['recoveries', recoveries.length],
      ['pressure-observations', pressures.length],
    ]
    for (const [metric, value] of values) {
      if (!requestedMetrics || requestedMetrics.has(metric)) {
        statistics.push({
          playerId: player.id,
          playerName: player.name,
          team: player.team,
          metric,
          value,
        })
      }
    }
    const calculationMetrics = new Set<PlayerCalculationTrace['metric']>(
      requestedMetrics
        ? requestedMetric === 'pass-completion-percentage'
          ? ['pass-completion-percentage']
          : [requestedMetric as PlayerCalculationTrace['metric']]
        : [
          'pass-completion-percentage',
          'shots',
          'shots-on-target',
          'goals',
          'recoveries',
          'pressure-observations',
        ],
    )
    const calculationsForPlayer: Array<{
      metric: PlayerCalculationTrace['metric']
      selected: Array<{ id: string }>
      denominator: Array<{ id: string }>
      value: number | null
      denominatorDescription: string
    }> = [
      {
        metric: 'pass-attempts',
        selected: passes,
        denominator: passes,
        value: passes.length,
        denominatorDescription: `Count of recorded passes made by ${player.name} in the selected claim period; receiving a pass is not a pass attempt.`,
      },
      {
        metric: 'pass-completions',
        selected: completed,
        denominator: passes,
        value: completed.length,
        denominatorDescription: `${completed.length} completed passes among ${passes.length} recorded pass attempts made by ${player.name}.`,
      },
      {
        metric: 'pass-completion-percentage',
        selected: completed,
        denominator: passes,
        value:
          passes.length > 0 && advanced.passCoverageComplete
            ? Number(((completed.length / passes.length) * 100).toFixed(1))
            : null,
        denominatorDescription: `${passes.length} recorded passes made by ${player.name} in the selected claim period. Receiving a pass is not a pass attempt.`,
      },
      {
        metric: 'shots',
        selected: shots,
        denominator: shots,
        value: shots.length,
        denominatorDescription: 'Count of this player’s recorded shot events in the selected claim period.',
      },
      {
        metric: 'shots-on-target',
        selected: onTarget,
        denominator: shots,
        value: onTarget.length,
        denominatorDescription: `Count of recorded shots on target among ${shots.length} player-attributed shots.`,
      },
      {
        metric: 'goals',
        selected: goals,
        denominator: shots,
        value: goals.length,
        denominatorDescription: `Count of recorded goals among ${shots.length} player-attributed shots.`,
      },
      {
        metric: 'recoveries',
        selected: recoveries,
        denominator: recoveries,
        value: recoveries.length,
        denominatorDescription: 'Count of this player’s recorded recovery observations in the selected claim period.',
      },
      {
        metric: 'pressure-observations',
        selected: pressures,
        denominator: pressures,
        value: pressures.length,
        denominatorDescription: 'Count of this player’s selected pressure observations; pressure coverage is partial.',
      },
    ]
    for (const { metric, selected, denominator, value, denominatorDescription } of calculationsForPlayer) {
      if (!calculationMetrics.has(metric)) continue
      calculations.push({
        playerId: player.id,
        playerName: player.name,
        team: player.team,
        metric,
        numerator: selected.length,
        denominator: denominator.length,
        value,
        numeratorRecordIds: selected.map(({ id }) => id),
        denominatorRecordIds: denominator.map(({ id }) => id),
        denominatorDescription,
      })
    }
  }
  return { statistics, calculations }
}

function participationStatus(
  player: SyntheticMatchEvidence['players'][number],
  fixture: SyntheticMatchEvidence,
  endElapsed: number,
): AnalysisResponse['evidenceFoundation']['players'][number]['participation'] {
  const subs = fixture.substitutions.filter(({ team }) => team === player.team)
  const entered =
    player.status === 'starter' ||
    subs.some(
      ({ playerOnId, clock }) =>
        playerOnId === player.id && elapsedMatchMinute(clock) <= endElapsed,
    )
  const left = subs.some(
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

function evidenceForClaim(
  claim: InterpretedClaim,
  result: ClaimResult['assessment'],
  events: MatchEvent[],
  availability: EvidenceAvailability[],
  advanced: EvidenceCalculation,
  anchorEvent?: MatchEvent,
): ClaimEvidence[] {
  if (
    claim.clarificationNeeds.length > 0 ||
    (claim.subject === null && claim.meaning.category !== 'coaching-question')
  ) {
    return []
  }
  const evidence = new Map<string, ClaimEvidence>()
  const requiredMetrics = claim.requiredEvidence
    .map((kind) => metricForEvidence(kind, claim))
    .filter((metric): metric is ClaimMetric => metric !== undefined)
  const wantsAttackingEvents = claim.requiredEvidence.includes('attacking-events')
  const availableKinds = new Set(
    availability.filter((item) => item.available).map((item) => item.kind),
  )
  const historicalCutoff = anchorEvent
    ? elapsedMatchMinute(anchorEvent.clock)
    : undefined

  if (
    !claim.playerSubject &&
    claim.meaning.comparison &&
    ['pass-attempts', 'pass-completions', 'pass-completion-percentage'].includes(
      claim.meaning.comparison.metric,
    )
  ) {
    for (const pass of advanced.passes) {
      if (
        pass.team !== claim.subject &&
        pass.team !== claim.meaning.comparison.opponent
      ) continue
      evidence.set(pass.id, {
        role: 'calculation',
        reference: {
          id: pass.id,
          time: formatMatchClock(pass.clock),
          team: pass.team,
          description: `${pass.outcome === 'complete' ? 'Completed' : 'Incomplete'} pass by ${pass.playerId}, intended for ${pass.receiverId}.`,
        },
      })
    }
    return [...evidence.values()]
  }

  if (claim.intent === 'coaching-question' && availableKinds.has('possession-losses')) {
    const buildUpOnly = claim.requiredEvidence.includes('build-up-phase')
    const eligibleTurnovers = buildUpOnly
      ? advanced.buildUpTurnovers
      : advanced.turnovers
    const turnovers = eligibleTurnovers.filter((turnover) =>
      (claim.subject === null || turnover.team === claim.subject) &&
      (!claim.playerSubject || turnover.playerId === claim.playerSubject.id),
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
          description: `Recorded ${buildUpOnly ? 'annotated build-up ' : ''}incomplete-pass turnover by ${turnover.playerId} in the ${classifyPitchArea(turnover.location)} at (${turnover.location.x}, ${turnover.location.y}); linked pass ${turnover.lostPassId}.`,
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
          description: `Linked ${pass.outcome} pass by ${pass.playerId} intended for ${pass.receiverId}, from (${pass.start.x}, ${pass.start.y}) to (${pass.end.x}, ${pass.end.y}).`,
        },
      })
    }
    if (buildUpOnly) {
      const annotationIds = new Set(
        advanced.buildUpAnnotations
          .filter((annotation) =>
            turnovers.some(({ possessionId }) => possessionId === annotation.possessionId),
          )
          .flatMap(({ pressureIds }) => pressureIds),
      )
      for (const pressure of advanced.pressures.filter(({ id }) => annotationIds.has(id))) {
        evidence.set(pressure.id, {
          role: 'context',
          reference: {
            id: pressure.id,
            time: formatMatchClock(pressure.clock),
            team: pressure.team,
            description: `Selected ${pressure.type.replaceAll('-', ' ')} observation by ${pressure.playerId}; pressure coverage is partial.`,
          },
        })
      }
    }
    return [...evidence.values()]
  }

  if (
    claim.intent === 'unavailable-metric' ||
    claim.intent === 'unrecognized-language'
  ) {
    return []
  }

  if (claim.playerSubject) {
    const players = selectedPlayerEntities(claim)
    const playerIds = new Set(players.map(({ id }) => id))
    const requestedMetric =
      claim.playerMetric ??
      (claim.meaning.comparison?.opponentPlayer
        ? claim.meaning.comparison.metric
        : null)
    const statisticRequest =
      claim.intent === 'statistical-request' ||
      (claim.intent === 'factual-claim' && claim.meaning.comparison !== null)
    const addPlayerEvidence = (
      id: string,
      time: string,
      team: MatchTeam,
      description: string,
    ) => evidence.set(id, {
      role: 'calculation',
      reference: { id, time, team, description },
    })
    for (const pass of advanced.passes) {
      const narrowPassingRequest = requestedMetric?.startsWith('pass-') ?? false
      if (
        narrowPassingRequest
          ? !playerIds.has(pass.playerId) ||
            (requestedMetric === 'pass-completions' && pass.outcome !== 'complete')
          : statisticRequest || (!playerIds.has(pass.playerId) && !playerIds.has(pass.receiverId))
      ) continue
      addPlayerEvidence(
        pass.id,
        formatMatchClock(pass.clock),
        pass.team,
        `${pass.outcome === 'complete' ? 'Completed' : 'Incomplete'} pass by ${pass.playerId} intended for ${pass.receiverId}.`,
      )
    }
    for (const event of events) {
      if (event.type !== 'shot' || !event.playerId || !playerIds.has(event.playerId)) continue
      if (
        requestedMetric === 'shots-on-target' &&
        event.outcome !== 'goal' &&
        event.outcome !== 'saved'
      ) continue
      if (requestedMetric === 'goals' && event.outcome !== 'goal') continue
      if (
        statisticRequest &&
        requestedMetric !== 'shots' &&
        requestedMetric !== 'shots-on-target' &&
        requestedMetric !== 'goals'
      ) continue
      addPlayerEvidence(
        event.id,
        formatMatchClock(event.clock),
        event.team,
        `${event.outcome} shot by ${event.playerId}.`,
      )
    }
    for (const turnover of advanced.turnovers) {
      if (
        statisticRequest ||
        (requestedMetric && requestedMetric !== 'recoveries' && requestedMetric !== 'pressure-observations') ||
        !playerIds.has(turnover.playerId)
      ) continue
      addPlayerEvidence(
        turnover.id,
        formatMatchClock(turnover.clock),
        turnover.team,
        `Pass turnover by ${turnover.playerId} in the ${classifyPitchArea(turnover.location)}; linked pass ${turnover.lostPassId}.`,
      )
    }
    for (const item of [
      ...advanced.recoveries.map((record) => ({ ...record, kind: 'recovery' as const })),
      ...advanced.pressures.map((record) => ({ ...record, kind: 'pressure' as const })),
    ]) {
      const relevant =
        requestedMetric === 'recoveries'
          ? item.kind === 'recovery'
          : requestedMetric === 'pressure-observations'
            ? item.kind === 'pressure'
            : !requestedMetric && !statisticRequest
      if (!playerIds.has(item.playerId) || !relevant) continue
      addPlayerEvidence(
        item.id,
        formatMatchClock(item.clock),
        item.team,
        item.kind === 'recovery'
          ? `Recorded recovery by ${item.playerId} linked to ${item.turnoverId}.`
          : `Selected ${item.type.replaceAll('-', ' ')} observation by ${item.playerId}; pressure coverage is partial.`,
      )
    }
    if (claim.historicalEventAnchor && anchorEvent) {
      evidence.set(anchorEvent.id, {
        role: 'anchor',
        reference: reference(anchorEvent),
      })
    }
    return [...evidence.values()]
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
      const subjectShare =
        claim.subject === null
          ? null
          : advanced.teams[claim.subject].possessionPercentage
      const opponent = claim.subject
        ? TEAMS.find((team) => team !== claim.subject)
        : undefined
      const opponentShare = opponent
        ? advanced.teams[opponent].possessionPercentage
        : null
      const hasDirectionalShare =
        claim.intent === 'subjective-judgement' &&
        claim.requiredEvidence.includes('possession') &&
        subjectShare !== null &&
        opponentShare !== null &&
        subjectShare !== opponentShare
      const subjectHasMajority =
        hasDirectionalShare && subjectShare !== null && opponentShare !== null
          ? subjectShare > opponentShare
          : false
      const role: ClaimEvidence['role'] = hasDirectionalShare
        ? (interval.team === claim.subject) === subjectHasMajority
          ? 'supporting'
          : 'challenging'
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
  if (
    claim.clarificationNeeds.length > 0 ||
    (claim.subject === null && claim.meaning.category !== 'coaching-question') ||
    (claim.playerSubject !== null && claim.intent !== 'coaching-question')
  ) {
    return []
  }
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
      claim.meaning.comparison &&
      [
        'pass-attempts',
        'pass-completions',
        'pass-completion-percentage',
      ].includes(claim.meaning.comparison.metric)
    ) {
      const passes = advanced.passes.filter((pass) => pass.team === team)
      const completed = passes.filter((pass) => pass.outcome === 'complete')
      const percentage = advanced.teams[team].passCompletionPercentage
      traces.push({
        team,
        metric: 'pass-completion-percentage',
        value: percentage,
        numerator: completed.length,
        denominator: passes.length,
        numeratorRecordIds: completed.map(({ id }) => id),
        denominatorRecordIds: passes.map(({ id }) => id),
        denominatorDescription: `All ${passes.length} recorded pass attempts for ${team} in ${advanced.startElapsed}–${advanced.endElapsed} played minutes; the percentage is unavailable when there are no attempts or pass coverage is incomplete.`,
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
        value: advanced.teams[team].possessionPercentage,
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
      const turnovers = (
        claim.requiredEvidence.includes('build-up-phase')
          ? advanced.buildUpTurnovers
          : advanced.turnovers
      ).filter(
        (turnover) =>
          turnover.team === team &&
          (!claim.playerSubject || turnover.playerId === claim.playerSubject.id),
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
          denominatorDescription: claim.requiredEvidence.includes('build-up-phase')
            ? `${turnovers.length} eligible turnover records for ${team} in the versioned, selected-sample build-up annotations; annotation coverage is not complete for the match.`
            : `All ${turnovers.length} recorded pass-turnover records for ${team}.`,
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
    if (claim.requiredEvidence.includes('passing')) {
      return advanced.passCoverageComplete
        ? 'Descriptive statistics are provided from recorded synthetic passes. Pass-completion percentage is not available when no attempts are recorded; zero attempts is distinct from attempted passes with no completions.'
        : 'Pass counts describe the recorded subset only. Pass-completion percentage is unavailable because pass coverage is incomplete; no recorded-subset rate is substituted for the full period.'
    }
    return 'Descriptive statistics are provided from the recorded synthetic events; this request does not receive a supported/contradicted truth verdict.'
  }
  if (claim.intent === 'coaching-question') {
    const buildUpOnly = claim.requiredEvidence.includes('build-up-phase')
    const turnovers = (
      buildUpOnly ? advanced.buildUpTurnovers : advanced.turnovers
    ).filter(
      ({ team, playerId }) =>
        (!claim.subject || team === claim.subject) &&
        (!claim.playerSubject || playerId === claim.playerSubject.id),
    )
    const teamSummary = claim.subject
      ? `for ${claim.playerSubject?.name ?? claim.subject}`
      : 'for both teams'
    const areaCounts = (['defensive-third', 'middle-third', 'final-third'] as const)
      .map((area) =>
        `${area} ${turnovers.filter(({ location }) => classifyPitchArea(location) === area).length}`,
      )
      .join(', ')
    const scope = buildUpOnly
      ? 'This is a filtered result from the versioned, selected-sample build-up annotations; they do not cover the match continuously.'
      : 'This is an all-pass-turnover breakdown.'
    return `${scope} Recorded turnover locations ${teamSummary}: ${areaCounts} (${turnovers.length} eligible recorded turnovers). These records do not establish why possession was lost; linked passes and any selected pressure observations describe associations, not tactical causes.`
  }
  if (claim.playerSubject) {
    return `The fixture provides only sparse synthetic actions attributed to ${claim.playerSubject.name}; pass, shot, recovery, and selected pressure counts are not a complete performance measure. No overall player rating or ranking is inferred.`
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
      const majorityContext =
        ownShare > opponentShare
          ? `This supports the possession-majority aspect of the claim for ${claim.subject}.`
          : ownShare < opponentShare
            ? `This challenges the possession-majority aspect of the claim for ${claim.subject}.`
            : `The recorded shares are equal, so neither team had a possession majority.`
      return `${claim.subject} recorded ${ownShare}% possession versus ${opponent}'s ${opponentShare}%. ${majorityContext} These figures do not establish the full subjective judgement "${claim.text}" or overall dominance.`
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
  fixture: SyntheticMatchEvidence,
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
  const playerData = claim.playerSubject &&
      canRetrieveSubjectEvidence &&
      claim.intent !== 'coaching-question' &&
      claim.intent !== 'unavailable-metric' &&
      claim.intent !== 'unrecognized-language'
    ? playerResults(claim, advanced, scopedEvents, fixture)
    : { statistics: [], calculations: [] }
  const statistics: TeamStatistic[] = canRetrieveSubjectEvidence &&
    availableForIntent &&
    !claim.playerSubject
    ? claim.intent === 'statistical-request' &&
        claim.requiredEvidence.includes('passing')
      ? (claim.meaning.comparison ? TEAMS : [claim.subject!]).flatMap((team) => ([
          { team, metric: 'pass-attempts' as const, value: advanced.teams[team].passAttempts },
          { team, metric: 'pass-completions' as const, value: advanced.teams[team].completedPasses },
          { team, metric: 'pass-completion-percentage' as const, value: advanced.teams[team].passCompletionPercentage },
        ]))
      : claim.intent === 'subjective-judgement' &&
          claim.requiredEvidence.includes('possession') &&
          advanced.possessionCoverageComplete
        ? TEAMS.map((team) => ({
            team,
            metric: 'possession-percentage' as const,
            value: advanced.teams[team].possessionPercentage,
          }))
        : claim.requiredEvidence.flatMap((kind) => {
        const metric = metricForEvidence(kind, claim)
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
        if (
          metric.startsWith('pass-') &&
          !advanced.passCoverageComplete
        ) {
          return []
        }
        const relevantTeams = claim.meaning.comparison
          ? TEAMS.filter(
              (team) => team === claim.subject || team === claim.meaning.comparison?.opponent,
            )
          : claim.subject
            ? [claim.subject]
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
      ? availability.map((item) =>
          item.kind === 'passing' && !advanced.passCoverageComplete
            ? {
                ...item,
                available: false,
                detail:
                  'Pass coverage is incomplete for this selected window; only recorded pass counts can be shown, and completion percentages cannot be calculated reliably.',
              }
            : item,
        )
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
      : comparison &&
          ['pass-attempts', 'pass-completions', 'pass-completion-percentage'].includes(comparison.metric)
        ? 'passing'
      : comparison &&
          ['recoveries', 'pressure-observations'].includes(comparison.metric)
        ? 'player-events'
      : comparison?.metric
  const comparisonMetricAvailable =
    comparison?.opponentPlayer
      ? playerData.statistics.some(
          ({ playerId, metric, value }) =>
            playerId === claim.playerSubject?.id &&
            metric === comparison.metric &&
            value !== null,
        ) &&
        playerData.statistics.some(
          ({ playerId, metric, value }) =>
            playerId === comparison.opponentPlayer?.id &&
            metric === comparison.metric &&
            value !== null,
        )
      : comparison?.metric === 'possession-percentage'
      ? advanced.denominatorMinutes > 0 && advanced.possessionCoverageComplete
      : comparison?.metric === 'pass-completion-percentage'
        ? advanced.passCoverageComplete &&
          advanced.teams[claim.subject ?? 'Northbridge'].passCompletionPercentage !== null &&
          comparison !== null &&
          advanced.teams[comparison.opponent].passCompletionPercentage !== null
        : comparison && ['pass-attempts', 'pass-completions'].includes(comparison.metric)
          ? advanced.passCoverageComplete
          : scopedEvents.some((event) =>
              comparison ? matchesMetric(event, comparison.metric) : false,
            )
  if (
    assessment !== 'clarification needed' &&
    comparison &&
    claim.intent === 'factual-claim' &&
    comparisonEvidenceKind &&
    resolvedAvailability.some(
      (item) => item.kind === comparisonEvidenceKind && item.available,
    ) &&
    comparisonMetricAvailable
  ) {
    const subjectValue = comparison.opponentPlayer
      ? playerData.statistics.find(
          ({ playerId, metric }) =>
            playerId === claim.playerSubject?.id && metric === comparison.metric,
        )?.value ?? null
      : statValue(claim.subject!, comparison.metric, scopedEvents, advanced)
    const opponentValue = comparison.opponentPlayer
      ? playerData.statistics.find(
          ({ playerId, metric }) =>
            playerId === comparison.opponentPlayer?.id &&
            metric === comparison.metric,
        )?.value ?? null
      : statValue(comparison.opponent, comparison.metric, scopedEvents, advanced)
    if (subjectValue !== null && opponentValue !== null) {
      assessment = compare(subjectValue, opponentValue, comparison.operator)
        ? 'supported'
        : 'contradicted'
    }
  }

  return {
    claim,
    assessment,
    periodLabel: periodLabel(claim, selectedPeriodLabel, allSelectedEvents),
    statistics,
    playerStatistics: playerData.statistics,
    playerCalculations: playerData.calculations,
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
    calculations: canRetrieveSubjectEvidence
      ? calculationTraces(claim, advanced)
      : [],
    limitation: makeLimitation(claim, availability, assessment, advanced),
  }
}

function metricName(metric: ClaimMetric, value?: number): string {
  const singularLabels: Partial<Record<ClaimMetric, string>> = {
    goals: 'goal',
    shots: 'shot',
    'shots-on-target': 'shot on target',
    'pass-attempts': 'pass attempt',
    'pass-completions': 'pass completion',
    recoveries: 'recovery',
    'pressure-observations': 'selected pressure observation',
  }
  const pluralLabels: Partial<Record<ClaimMetric, string>> = {
    'shots-on-target': 'shots on target',
    'pressure-observations': 'selected pressure observations',
  }
  if (value === 1) {
    return singularLabels[metric] ?? metric.replaceAll('-', ' ')
  }
  return pluralLabels[metric] ?? metric
    .replaceAll('-', ' ')
    .replace('pressure observations', 'selected pressure observations')
}

function playerParticipation(
  player: Pick<PlayerEntityReference, 'id' | 'name' | 'team'>,
  fixture: SyntheticMatchEvidence,
  endElapsed: number,
): AnalysisResponse['evidenceFoundation']['players'][number]['participation'] {
  const record = fixture.players.find(({ id }) => id === player.id)
  if (!record) throw new Error(`Player ${player.id} is not in the active fixture.`)
  return participationStatus(record, fixture, endElapsed)
}

function claimEndElapsed(
  claim: InterpretedClaim,
  events: MatchEvent[],
  advanced: EvidenceCalculation,
): number {
  if (claim.timePeriod.kind === 'selected') return advanced.endElapsed
  const anchorId = claim.timePeriod.eventId
  const anchor = events.find(({ id }) => id === anchorId)
  if (!anchor) throw new Error('Validated historical event anchor was not found.')
  return elapsedMatchMinute(anchor.clock) - 0.000001
}

function formatCount(metric: ClaimMetric, value: number | null): string {
  if (value === null) return `${metricName(metric)} is unavailable`
  if (metric === 'possession-percentage') return `${value}% possession`
  if (metric === 'pass-completion-percentage') return `${value}%`
  return `${value} ${metricName(metric, value)}`
}

function joinNaturally(items: string[]): string {
  if (items.length < 2) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

function comparisonValues(result: ClaimResult): Array<{
  name: string
  value: number | null
  attempts?: number | null
  completions?: number | null
}> {
  const comparison = result.claim.meaning.comparison
  if (!comparison) return []
  if (comparison.opponentPlayer && result.claim.playerSubject) {
    return [result.claim.playerSubject, comparison.opponentPlayer].map((player) => {
      const statistic = (metric: ClaimMetric) =>
        result.playerStatistics.find(
          (item) => item.playerId === player.id && item.metric === metric,
        )?.value ?? null
      return {
        name: player.name,
        value: statistic(comparison.metric),
        attempts: statistic('pass-attempts'),
        completions: statistic('pass-completions'),
      }
    })
  }
  if (!result.claim.subject) return []
  return [result.claim.subject, comparison.opponent].map((team) => {
    const statistic = (metric: ClaimMetric) =>
      result.statistics.find(
        (item) => item.team === team && item.metric === metric,
      )?.value ?? null
    const passTrace = result.calculations.find(
      (item) => item.team === team &&
        item.metric === 'pass-completion-percentage',
    )
    return {
      name: team,
      value: statistic(comparison.metric) ?? passTrace?.value ?? null,
      attempts: statistic('pass-attempts') ?? passTrace?.denominator ?? null,
      completions: statistic('pass-completions') ?? passTrace?.numerator ?? null,
    }
  })
}

function comparisonSentence(result: ClaimResult): string | undefined {
  const metric = result.claim.meaning.comparison?.metric
  const [subject, opponent] = comparisonValues(result)
  if (!metric || !subject || !opponent) return undefined
  const lead =
    result.assessment === 'supported'
      ? 'Yes — '
      : result.assessment === 'contradicted'
        ? 'No — '
        : 'The recorded figures do not settle this comparison: '
  const comparison =
    metric === 'pass-completion-percentage'
      ? subject.value === null || opponent.value === null
        ? `${subject.name}'s pass completion rate is unavailable; ${opponent.name}'s rate is ${opponent.value === null ? 'also unavailable' : `${opponent.value}%`}`
        : `${subject.name} completed ${subject.completions} of ${subject.attempts} passes (${subject.value}%), compared with ${opponent.name}'s ${opponent.completions} of ${opponent.attempts} passes (${opponent.value}%)`
      : subject.value === null || opponent.value === null
        ? `${subject.name}'s ${metricName(metric)} is unavailable; ${opponent.name}'s ${metricName(metric)} is ${opponent.value === null ? 'also unavailable' : formatCount(metric, opponent.value)}`
        : `${subject.name} recorded ${formatCount(metric, subject.value)}, compared with ${opponent.name}'s ${formatCount(metric, opponent.value)}`
  return `${lead}${comparison}.`
}

function statisticsSentence(result: ClaimResult): string | undefined {
  const playerStatistics = result.playerStatistics
  if (playerStatistics.length > 0) {
    const metrics = [...new Set(playerStatistics.map(({ metric }) => metric))]
    const players = [...new Map(
      playerStatistics.map(({ playerId, playerName, team }) => [
        playerId,
        { id: playerId, name: playerName, team },
      ]),
    ).values()]
    const statements = players.map((player) => {
      const get = (metric: ClaimMetric) =>
        playerStatistics.find(
          (item) => item.playerId === player.id && item.metric === metric,
        )?.value ?? null
      if (metrics.includes('pass-completion-percentage')) {
        const attempts = get('pass-attempts')
        const completions = get('pass-completions')
        const rate = get('pass-completion-percentage')
        return `${player.name} completed ${completions} of ${attempts} passes (${rate === null ? 'rate unavailable' : `${rate}%`})`
      }
      const values = metrics
        .map((metric) => get(metric))
        .filter((value): value is number | null => value !== undefined)
        .map((value, index) => formatCount(metrics[index], value))
      return `${player.name}: ${values.join(', ')}`
    })
    return statements.length ? `${joinNaturally(statements)}.` : undefined
  }
  if (result.statistics.length === 0) return undefined
  const teams = [...new Set(result.statistics.map(({ team }) => team))]
  const statements = teams.map((team) => {
    const teamStatistics = result.statistics.filter((item) => item.team === team)
    if (teamStatistics.some(({ metric }) => metric === 'pass-completion-percentage')) {
      const attempts = teamStatistics.find(({ metric }) => metric === 'pass-attempts')?.value
      const completions = teamStatistics.find(({ metric }) => metric === 'pass-completions')?.value
      const rate = teamStatistics.find(
        ({ metric }) => metric === 'pass-completion-percentage',
      )?.value
      return `${team} completed ${completions ?? 'an unavailable number of'} of ${attempts ?? 'an unavailable number of'} passes (${rate === null || rate === undefined ? 'rate unavailable' : `${rate}%`})`
    }
    const values = teamStatistics.map(
      ({ metric, value }) => `recorded ${formatCount(metric, value)}`,
    )
    return `${team} ${values.join(' and ')}`
  })
  return statements.length ? `${joinNaturally(statements)}.` : undefined
}

function broadPlayerSentence(
  result: ClaimResult,
  fixture: SyntheticMatchEvidence,
  endElapsed: number,
): string {
  const player = result.claim.playerSubject
  if (!player) return ''
  const participation = playerParticipation(player, fixture, endElapsed)
  if (participation === 'not-yet-on-pitch') {
    return `${player.name} had not yet come on by the end of this period.`
  }
  if (participation === 'unused-substitute') {
    return `${player.name} remained an unused substitute in this period.`
  }

  const values = new Map(
    result.playerStatistics.map(({ metric, value }) => [metric, value]),
  )
  const contributions: string[] = []
  const goals = values.get('goals')
  const onTarget = values.get('shots-on-target')
  const shots = values.get('shots')
  if (typeof goals === 'number' && goals > 0) {
    contributions.push(`scored ${formatCount('goals', goals)}`)
  }
  if (typeof onTarget === 'number' && onTarget > 0) {
    contributions.push(`had ${formatCount('shots-on-target', onTarget)}`)
  } else if (typeof shots === 'number' && shots > 0) {
    contributions.push(`had ${formatCount('shots', shots)}`)
  }
  const attempts = values.get('pass-attempts')
  const completions = values.get('pass-completions')
  if (typeof attempts === 'number' && attempts > 0 && typeof completions === 'number') {
    contributions.push(`completed ${completions} of ${attempts} passes`)
  }
  for (const metric of ['recoveries', 'pressure-observations'] as const) {
    const count = values.get(metric)
    if (typeof count === 'number' && count > 0) {
      contributions.push(`made ${formatCount(metric, count)}`)
    }
  }
  const minutes = values.get('minutes-played')
  if (typeof minutes === 'number' && minutes > 0 && minutes < 90) {
    contributions.push(`played ${minutes} minutes in the selected period`)
  }
  if (contributions.length === 0) {
    return `${player.name} participated, but no player-attributed actions are recorded for this period.`
  }
  return `${player.name} ${contributions.join(', ')}.`
}

function coachingSentence(result: ClaimResult): string {
  const buildUpOnly = result.claim.requiredEvidence.includes('build-up-phase')
  const losses = result.calculations.filter(
    ({ metric }) => metric === 'possession-losses-by-area',
  )
  const teams = [...new Set(losses.map(({ team }) => team))]
  if (losses.length === 0) {
    return result.limitation
  }
  const summaries = teams.map((team) => {
    const teamLosses = losses.filter((item) => item.team === team)
    const areas = teamLosses
      .map(({ area, value }) => `${area?.replaceAll('-', ' ')} ${value ?? 'unavailable'}`)
      .join(', ')
    return `${team}: ${areas} (${teamLosses[0].denominator} recorded losses)`
  })
  const total = teams.reduce(
    (sum, team) =>
      sum + (losses.find((item) => item.team === team)?.denominator ?? 0),
    0,
  )
  const phase = buildUpOnly ? 'the annotated build-up sample' : 'the recorded passes'
  const findings = `${phase}, ${summaries.join('; ')}; ${total} losses in total.`
  const limitation = buildUpOnly
    ? 'This is a partial annotated sample, not a match-wide count. Linked passes and any recorded pressure show context, not why possession was lost.'
    : 'This covers recorded pass turnovers only, not every way possession can change. The records do not show why the ball was lost.'
  return `${findings} ${limitation}`
}

function historicalScope(
  claim: InterpretedClaim,
  events: MatchEvent[],
): string {
  if (claim.timePeriod.kind !== 'before-event') return ''
  const anchorId = claim.timePeriod.eventId
  const anchor = events.find(({ id }) => id === anchorId)
  if (!anchor) throw new Error('Validated historical event anchor was not found.')
  return `This uses play strictly before ${anchor.team}'s goal at ${formatMatchClock(anchor.clock)}; the goal is a separate time anchor.`
}

function passDataLimitation(result: ClaimResult): string {
  if (!result.claim.requiredEvidence.includes('passing')) return ''
  const passingAvailability = result.evidenceAvailability.find(
    ({ kind }) => kind === 'passing',
  )
  if (passingAvailability && !passingAvailability.available) {
    return passingAvailability.detail
  }
  const attempts = [
    ...result.statistics
      .filter(({ metric }) => metric === 'pass-attempts')
      .map(({ value }) => value),
    ...result.playerStatistics
      .filter(({ metric }) => metric === 'pass-attempts')
      .map(({ value }) => value),
  ]
  return attempts.length > 0 && attempts.every((value) => value === 0)
    ? 'No pass attempts were recorded, so a completion rate cannot be calculated.'
    : ''
}

function answerForClaim(
  result: ClaimResult,
  fixture: SyntheticMatchEvidence,
  events: MatchEvent[],
  advanced: EvidenceCalculation,
): string {
  const claim = result.claim
  if (claim.clarificationNeeds.length > 0) {
    return claim.clarificationNeeds.join(' ')
  }
  if (result.assessment === 'clarification needed') {
    return `Could you clarify who or what you mean by “${claim.text}”?`
  }
  if (claim.intent === 'unavailable-metric') return result.limitation
  if (claim.intent === 'unrecognized-language') return result.limitation
  if (claim.intent === 'coaching-question') return coachingSentence(result)
  if (claim.intent === 'statistical-request') {
    const statistics = statisticsSentence(result) ?? result.limitation
    const scope = historicalScope(claim, events)
    const limitation = passDataLimitation(result)
    return `${statistics}${limitation ? ` ${limitation}` : ''}${scope ? ` ${scope}` : ''}`
  }
  if (
    claim.meaning.category === 'historical-circumstance' &&
    claim.playerSubject &&
    !/against the run of play/i.test(claim.text)
  ) {
    return `${broadPlayerSentence(result, fixture, claimEndElapsed(claim, events, advanced))} ${historicalScope(claim, events)} These sparse synthetic records cannot establish an overall performance rating.`
  }
  if (
    claim.intent === 'factual-claim' &&
    claim.meaning.category === 'factual-comparison'
  ) {
    const comparison = comparisonSentence(result)
    if (comparison) {
      const limitation =
        result.claim.meaning.comparison?.metric === 'possession-percentage'
          ? ' Possession is calculated from recorded controlled time only; it does not show territorial control or overall performance.'
          : passDataLimitation(result)
            ? ` ${passDataLimitation(result)}`
            : ''
      return `${comparison}${limitation}`
    }
  }
  if (claim.meaning.category === 'historical-circumstance') {
    const scope = historicalScope(claim, events)
    const conclusion =
      result.assessment === 'supported'
        ? `The recorded evidence supports the view that ${claim.text.replace(/[.!?]+$/, '')}.`
        : `The available evidence cannot establish whether ${claim.text.replace(/[.!?]+$/, '')}.`
    const limitation = result.limitation.includes('territory') ||
      result.limitation.includes('chance quality')
      ? 'The fixture has no continuous territorial or chance-quality data.'
      : result.limitation
    return `${conclusion} ${scope} ${limitation}`
  }
  if (
    claim.intent === 'subjective-judgement' &&
    claim.requiredEvidence.includes('possession') &&
    claim.subject
  ) {
    const own = result.statistics.find(({ team }) => team === claim.subject)?.value
    const opponentStat = result.statistics.find(({ team }) => team !== claim.subject)
    const opponent = opponentStat?.value
    if (own !== undefined && own !== null && opponent !== undefined && opponent !== null) {
      const supports = own > opponent
      const aspect = supports
        ? 'This supports the possession-majority part of the claim.'
        : own < opponent
          ? 'This challenges the possession-majority part of the claim.'
          : 'The recorded shares are equal.'
      return `${claim.subject} had ${own}% of recorded possession; ${opponentStat?.team} had ${opponent}%. ${aspect} Possession share alone cannot establish overall dominance.`
    }
  }
  if (claim.playerSubject) {
    const endElapsed = claimEndElapsed(claim, events, advanced)
    const answer = broadPlayerSentence(result, fixture, endElapsed)
    return `${answer} These are sparse synthetic records, not a complete performance measure or overall rating.`
  }
  if (claim.intent === 'subjective-judgement') {
    return `The available match events do not establish the broader judgement: “${claim.text}”.`
  }
  if (result.assessment === 'insufficient evidence for a firm conclusion') {
    return `The available evidence does not settle whether ${claim.text}. ${result.limitation}`
  }
  return `${result.assessment}. ${result.limitation}`
}

function createSummary(
  claims: ClaimResult[],
  fixture: SyntheticMatchEvidence,
  advanced: EvidenceCalculation,
  events: MatchEvent[],
  selectedPeriodLabel: string,
): string {
  if (claims.length === 0) {
    return 'Enter an opinion to interpret its claims and retrieve relevant evidence from this synthetic fixture.'
  }

  const answers = claims.map((result) =>
    answerForClaim(result, fixture, events, advanced),
  )
  return `${answers.join(' ')}\n\nSelected period: ${selectedPeriodLabel}. This is a fictional match using real-player names; all performances and results are fictional.`
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
  fixture: SyntheticMatchEvidence,
  selectedEvents: MatchEvent[],
): AnalysisResponse['evidenceFoundation'] {
  const passReferences = advanced.passes.map((pass) =>
    evidenceReference(
      pass.id,
      formatMatchClock(pass.clock),
      pass.team,
      `${pass.outcome === 'complete' ? 'Completed' : 'Incomplete'} pass by ${pass.playerId} intended for ${pass.receiverId}, from (${pass.start.x}, ${pass.start.y}) to (${pass.end.x}, ${pass.end.y}).`,
    ),
  )
  const turnoverReferences = advanced.turnovers.map((turnover) =>
    evidenceReference(
      turnover.id,
      formatMatchClock(turnover.clock),
      turnover.team,
      `Lost possession by ${turnover.playerId} in the ${classifyPitchArea(turnover.location).replaceAll('-', ' ')}; ${turnover.recoveredBy ? `recovered by ${turnover.recoveredBy}` : 'recovery team not recorded'}.`,
    ),
  )
  const recoveryReferences = advanced.recoveries.map((recovery) =>
    evidenceReference(
      recovery.id,
      formatMatchClock(recovery.clock),
      recovery.team,
      `Recovery by ${recovery.playerId} following ${recovery.turnoverId} at (${recovery.location.x}, ${recovery.location.y}).`,
    ),
  )
  const pressureReferences = advanced.pressures.map((pressure) =>
    evidenceReference(
      pressure.id,
      formatMatchClock(pressure.clock),
      pressure.team,
      `Recorded ${pressure.type.replaceAll('-', ' ')} pressure by ${pressure.playerId} at (${pressure.location.x}, ${pressure.location.y}); pressure coverage is partial.`,
    ),
  )

  return {
    dataset: {
      id: fixture.dataset.id,
      version: fixture.dataset.version,
      label: fixture.dataset.label,
      source: fixture.dataset.source,
      provenance: fixture.dataset.provenance,
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
      'Build-up events are returned only for a versioned, selected sample of explicitly annotated sequences; this sample is not complete match-wide phase coverage.',
      'Intervals use half-aware clocks and are clipped to the selected window; halftime has no possession duration. A clipped interval omits its eventual end reason.',
      'Event references use stable fixture IDs, team/player IDs, period-aware match timestamps, dataset version 3.0.0, and synthetic provenance.',
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
      receiverId: pass.receiverId,
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
      playerId: turnover.playerId,
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
    players: fixture.players.map((player) => ({
      ...player,
      participation: participationStatus(player, fixture, advanced.endElapsed),
      minutesInWindow: selectedWindowMinutes(player, fixture, advanced),
      selectedWindowActions: new Set([
        ...advanced.passes
          .filter(({ playerId, receiverId }) =>
            playerId === player.id || receiverId === player.id,
          )
          .map(({ id }) => id),
        ...advanced.turnovers
          .filter(({ playerId }) => playerId === player.id)
          .map(({ id }) => id),
        ...advanced.recoveries
          .filter(({ playerId }) => playerId === player.id)
          .map(({ id }) => id),
        ...advanced.pressures
          .filter(({ playerId }) => playerId === player.id)
          .map(({ id }) => id),
        ...selectedEvents
          .filter((event) => event.type === 'shot' && event.playerId === player.id)
          .map(({ id }) => id),
      ]).size,
    })),
    buildUpAnnotations: advanced.buildUpAnnotations.map((annotation) => ({
      id: annotation.id,
      version: annotation.version,
      phase: annotation.phase,
      team: annotation.team,
      possessionId: annotation.possessionId,
      passIds: annotation.passIds,
      turnoverIds: annotation.turnoverIds,
      pressureIds: annotation.pressureIds,
      coverage: annotation.coverage,
    })),
    buildUpCoverage: 'selected-sample',
    substitutions: fixture.substitutions
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
  fixture: SyntheticMatchEvidence = SYNTHETIC_MATCH_EVIDENCE,
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
    fixture,
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
        players: fixture.players,
      })
    : { claims: [] }
  let claims: InterpretedClaim[]
  try {
    claims = validateInterpretation(
      interpreted,
      eventsThroughSelectedTime,
      fixture.players,
      { requireClaims: request.opinion.length > 0 },
    )
  } catch (error) {
    if (provider.name === 'foundry') {
      throw new InterpretationProviderError(
        'semantic-validation',
        error instanceof Error
          ? error.message
          : 'Microsoft Foundry interpretation did not match the validated claim contract.',
        error,
      )
    }
    throw error
  }
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
          fixture,
          anchor.clock,
          'match-so-far',
          undefined,
          elapsedMatchMinute(anchor.clock),
        )
      : advanced
    return assessOneClaim(
      claim,
      matchAnalysis.periodEvents,
      selectedPeriodLabel,
      eventsThroughSelectedTime,
      claimAdvanced,
      fixture,
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
    summary: createSummary(
      results,
      fixture,
      advanced,
      eventsThroughSelectedTime,
      selectedPeriodLabel,
    ),
    selectedTime,
    selectedPeriodLabel,
    score: matchSoFar.score,
    periodStatistics,
    periodEvents: matchAnalysis.periodEvents.map(reference),
    evidenceFoundation: createEvidenceFoundation(
      advanced,
      selectedPeriodLabel,
      fixture,
      matchAnalysis.periodEvents,
    ),
    claims: results,
  }

  return response
}
