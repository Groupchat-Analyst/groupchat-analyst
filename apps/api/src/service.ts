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
import type { InterpretationProvider } from './providers/provider.js'
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
  return event.outcome === 'goal' || event.outcome === 'saved'
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
  return events.filter(
    (event) => event.team === team && matchesMetric(event, metric),
  ).length
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
    claim.intent !== 'statistical-request' &&
    claim.intent !== 'unavailable-metric' &&
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

function formatPlayerStatistic(statistic: PlayerStatistic): string {
  if (statistic.value === null) return `${metricName(statistic.metric)} unavailable`
  const value = statistic.metric.includes('percentage')
    ? `${statistic.value}%`
    : String(statistic.value)
  return `${value} ${metricName(statistic.metric, statistic.value)}`
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

function playerParticipationText(
  player: Pick<PlayerEntityReference, 'id' | 'name' | 'team'>,
  fixture: SyntheticMatchEvidence,
  endElapsed: number,
): string {
  const status = playerParticipation(player, fixture, endElapsed)
  if (status === 'not-yet-on-pitch') return 'has not yet entered the pitch'
  if (status === 'unused-substitute') return 'remained an unused substitute'
  if (status === 'participated') return 'participated and has since been substituted'
  return 'is on the pitch'
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

function createSummary(
  claims: ClaimResult[],
  fixture: SyntheticMatchEvidence,
  advanced: EvidenceCalculation,
  events: MatchEvent[],
): string {
  if (claims.length === 0) {
    return 'Enter an opinion to interpret its claims and retrieve relevant evidence from this synthetic fixture.'
  }

  return claims
    .map((result, index) => {
      const effectiveEndElapsed = claimEndElapsed(result.claim, events, advanced)
      const subject =
        result.claim.playerSubject?.name ??
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
            ? selectedPlayerEntities(result.claim).length
              ? selectedPlayerEntities(result.claim).map((player) =>
                  result.evidence.find(({ reference: item }) =>
                    item.description.includes(player.id),
                  ),
                ).filter((item): item is ClaimEvidence => item !== undefined)
              : TEAMS.map((team) =>
                  result.evidence.find(({ reference: item }) => item.team === team),
                ).filter((item): item is ClaimEvidence => item !== undefined)
            : result.claim.playerSubject &&
                !result.claim.playerMetric &&
                !result.claim.meaning.comparison?.opponentPlayer
              ? [
                  ...result.evidence.filter(({ reference: item }) =>
                    /(?:goal|saved) shot by/i.test(item.description),
                  ),
                  ...result.evidence.filter(({ reference: item }) =>
                    /shot by/i.test(item.description) &&
                    !/(?:goal|saved) shot by/i.test(item.description),
                  ),
                ].slice(0, 2)
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
            `${team} ${value === null ? 'not available' : `${value}${metric.includes('percentage') ? '%' : ''}`} ${metric.replaceAll('-', ' ')}`,
        )
        .join('; ')
      const playerStatsById = new Map<string, PlayerStatistic[]>()
      for (const statistic of result.playerStatistics) {
        const records = playerStatsById.get(statistic.playerId) ?? []
        records.push(statistic)
        playerStatsById.set(statistic.playerId, records)
      }
      const playerStatisticsText = [...playerStatsById.values()]
        .map((items) => {
          const player = items[0]
          const get = (metric: PlayerStatistic['metric']) =>
            items.find((item) => item.metric === metric)?.value
          const attempts = get('pass-attempts')
          const completed = get('pass-completions')
          const percentage = get('pass-completion-percentage')
          const explicitMetric =
            result.claim.playerMetric ??
            (result.claim.meaning.comparison?.opponentPlayer
              ? result.claim.meaning.comparison.metric
              : null)
          if (explicitMetric) {
            if (explicitMetric === 'pass-completion-percentage') {
              return `${player.playerName}: ${completed ?? 'not available'}/${attempts ?? 'not available'} passes (${percentage === null ? 'rate unavailable' : `${percentage}%`})`
            }
            const values = items
              .filter(({ metric }) => metric === explicitMetric)
              .map(formatPlayerStatistic)
            return `${player.playerName}: ${values.join(', ') || 'not available'}`
          }
          const participation = playerParticipation(
            { id: player.playerId, name: player.playerName, team: player.team },
            fixture,
            effectiveEndElapsed,
          )
          if (participation === 'not-yet-on-pitch') {
            return playerParticipationText(
              { id: player.playerId, name: player.playerName, team: player.team },
              fixture,
              effectiveEndElapsed,
            )
          }
          if (participation === 'unused-substitute') {
            return playerParticipationText(
              { id: player.playerId, name: player.playerName, team: player.team },
              fixture,
              effectiveEndElapsed,
            )
          }
          const contributions: string[] = []
          const goals = get('goals')
          const shotsOnTarget = get('shots-on-target')
          const shots = get('shots')
          if (typeof goals === 'number' && goals > 0) contributions.push(`${goals} ${metricName('goals', goals)}`)
          if (typeof shotsOnTarget === 'number' && shotsOnTarget > 0) {
            contributions.push(`${shotsOnTarget} ${metricName('shots-on-target')}`)
          } else if (typeof shots === 'number' && shots > 0) {
            contributions.push(`${shots} ${metricName('shots')}`)
          }
          if (typeof attempts === 'number' && attempts > 0 && typeof completed === 'number') {
            contributions.push(
              `${completed} ${metricName('pass-completions', completed)} from ${attempts} ${metricName('pass-attempts', attempts)}`,
            )
          }
          for (const metric of ['recoveries', 'pressure-observations'] as const) {
            const value = get(metric)
            if (typeof value === 'number' && value > 0) {
              contributions.push(`${value} ${metricName(metric, value)}`)
            }
          }
          const selectedMinutes = get('minutes-played')
          if (typeof selectedMinutes === 'number' && selectedMinutes > 0) {
            contributions.push(`${selectedMinutes} selected-window ${selectedMinutes === 1 ? 'minute' : 'minutes'}`)
          }
          return contributions.length > 0
            ? `Recorded ${contributions.slice(0, 4).join(', ')}`
            : 'Participated; no player-attributed actions are recorded in this period'
        })
        .join('; ')
      const passCalculations = result.calculations.filter(
        ({ metric }) => metric === 'pass-completion-percentage',
      )
      const lossCalculations = result.calculations.filter(
        ({ metric }) => metric === 'possession-losses-by-area',
      )
      const buildUpOnly = result.claim.requiredEvidence.includes('build-up-phase')
      const lossLead = lossCalculations.length
        ? ` ${buildUpOnly ? 'Sampled build-up' : 'All-pass'} turnover locations: ${TEAMS
            .map((team) => {
              const teamCalculations = lossCalculations.filter(
                (calculation) => calculation.team === team,
              )
              if (teamCalculations.length === 0) return ''
              const areas = teamCalculations
                .map(({ area, value }) => `${area} ${value ?? 'not available'}`)
                .join(', ')
              const denominator = teamCalculations[0].denominator
              return `${team}: ${areas} (${denominator} recorded turnovers)`
            })
            .filter(Boolean)
            .join('; ')} (${[...new Set(lossCalculations.map(({ team }) => team))]
            .reduce((total, team) =>
              total + (lossCalculations.find((trace) => trace.team === team)?.denominator ?? 0), 0)} combined recorded turnovers).`
        : ''
      const teamPassSummary = passCalculations.length
        ? passCalculations
            .map(({ team, numerator, denominator, value }) =>
              `${team} ${numerator}/${denominator} (${value === null ? 'rate unavailable' : `${value}%`})`,
            )
            .join('; ')
        : ''
      const statisticsText = playerStatisticsText
        ? result.claim.playerSubject &&
            !result.claim.playerMetric &&
            !result.claim.meaning.comparison?.opponentPlayer
          ? ''
          : ` Recorded player statistics: ${playerStatisticsText}.`
        : teamPassSummary
          ? ` Recorded statistics: ${teamPassSummary}.`
        : statistics
          ? ` Recorded statistics: ${statistics}.`
          : ''
      const broadPlayerSummary = Boolean(
        result.claim.playerSubject &&
        result.claim.meaning.category === 'performance-judgement' &&
        !result.claim.playerMetric &&
        !result.claim.meaning.comparison?.opponentPlayer,
      )
      const noHistoricalParticipation = result.claim.playerSubject &&
        ['not-yet-on-pitch', 'unused-substitute'].includes(
          playerParticipation(
            result.claim.playerSubject,
            fixture,
            effectiveEndElapsed,
          ),
        )
      const prefix = broadPlayerSummary
        ? playerStatisticsText
        : result.assessment
      const leadText = lossLead.trim().replace(/\.$/, '')
      const scopeText = `Period: ${result.periodLabel}.`
      const anchorText = result.claim.historicalEventAnchor
        ? ` Evidence excludes anchor ${result.claim.historicalEventAnchor.eventId} (${result.claim.historicalEventAnchor.relationship}).`
        : ''
      const summaryLimitation = broadPlayerSummary
        ? 'These sparse synthetic records cannot establish an overall performance rating.'
        : result.limitation
      const limitation =
        broadPlayerSummary && noHistoricalParticipation
          ? ''
          : ` ${summaryLimitation}`
      return `Claim ${index + 1} — ${subject}: ${leadText ? `${leadText} ` : ''}${prefix}. ${scopeText}${anchorText}${statisticsText}${limitation}${referenceText}`
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
  const claims = validateInterpretation(
    interpreted,
    eventsThroughSelectedTime,
    fixture.players,
  )
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
    summary: `Simulated match using real-player names. All performances and results are fictional.\n${selectedPeriodLabel}\n\n${createSummary(results, fixture, advanced, eventsThroughSelectedTime)}`,
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
