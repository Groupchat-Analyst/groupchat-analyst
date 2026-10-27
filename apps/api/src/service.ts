import type {
  AnalysisRequest,
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
  PlayerResolutionOption,
  TeamStatistic,
} from '../../shared/src/apiContracts.js'
import {
  calculateEvidence,
  classifyPitchArea,
  EVIDENCE_CAPABILITIES,
  matchClockAtElapsed,
  type EvidenceCalculation,
  type SyntheticMatchEvidence,
} from '../../shared/src/evidence.js'
import {
  analyzeMatch,
  elapsedMatchMinute,
  formatMatchClock,
  TEAMS,
  type MatchEvent,
  type MatchClock,
  type MatchTeam,
} from '../../shared/src/match.js'
import { resolveDataset } from './datasets.js'
import {
  toDisplay,
  toSlotOpinion,
  type TeamNaming,
} from '../../shared/src/teamNaming.js'
import {
  BEFORE_GOAL_PHRASE,
  parseCountAssertion,
  type CountAssertion,
} from '../../shared/src/countAssertions.js'
import {
  InterpretationProviderError,
  type InterpretationProvider,
} from './providers/provider.js'
import { LocalInterpretationProvider } from './providers/local.js'
import {
  classifyOpinion,
  DEFENSIVE_SHAPE_PATTERN,
  topicLimitation,
} from '../../shared/src/opinionTopics.js'
import {
  goalBeforeHalfTimeAssertion,
  hasExplicitBuildUpPassingScope,
  normalizeKnownInterpretation,
  parseAnalysisRequest,
  parsePlayerResolutionRequest,
  parseResolvedPlayerRecheckRequest,
  InputValidationError,
  validateInterpretation,
} from './validation.js'
import { canonicalizeSupportedFootballOpinion } from '../../shared/src/localization.js'
import {
  signPlayerResolution,
  verifyPlayerResolution,
  type PlayerResolutionGrant,
} from './playerResolution.js'

function isUnsupportedBuildUpPassingScope(claim: InterpretedClaim): boolean {
  const passMetrics = new Set<ClaimMetric>([
    'pass-attempts',
    'pass-completions',
    'pass-completion-percentage',
  ])
  const metric = claim.meaning.comparison?.metric ?? claim.playerMetric
  return (
    hasExplicitBuildUpPassingScope(claim.text) &&
    claim.requiredEvidence.includes('build-up-phase') &&
    claim.requiredEvidence.includes('passing') &&
    (claim.intent === 'statistical-request' ||
      (claim.intent === 'factual-claim' &&
        claim.meaning.comparison !== null &&
        passMetrics.has(claim.meaning.comparison.metric)) ||
      (claim.playerMetric !== null && passMetrics.has(claim.playerMetric))) &&
    (metric === null || passMetrics.has(metric))
  )
}

const UNAVAILABLE_EVIDENCE: Partial<Record<EvidenceKind, string>> = {
  'shot-location':
    'Shot records have no pitch coordinates or zone, so whether a shot came from inside or outside the box is not recorded. Free-text event descriptions are not location data, and no other shot count is substituted.',
  'territorial-control':
    'The fixture includes selected event locations, but not continuous field-position, territory, or defensive-shape tracking.',
  'physical-measurements':
    'Running distance and other physical measurements are not recorded; this fixture has no physical-data or continuous-tracking source.',
}

function reference(
  event: MatchEvent,
  players: SyntheticMatchEvidence['players'],
): EvidenceReference {
  const shooter =
    event.type === 'shot' && event.playerId
      ? players.find(({ id }) => id === event.playerId)
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
  if (goalBeforeHalfTimeAssertion(claim)) {
    return 'Recorded first-half goal events'
  }
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
  if (goalBeforeHalfTimeAssertion(claim)) {
    return selectedEvents.filter(
      (event) =>
        event.type === 'shot' &&
        event.outcome === 'goal' &&
        event.clock.period === 1 &&
        (!claim.subject || event.team === claim.subject) &&
        (!claim.playerSubject || event.playerId === claim.playerSubject.id),
    )
  }
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

function countAssertionFor(claim: InterpretedClaim): CountAssertion | undefined {
  if (
    claim.intent !== 'factual-claim' ||
    !claim.subject ||
    claim.meaning.comparison ||
    claim.clarificationNeeds.length > 0
  ) {
    return undefined
  }
  const assertion = parseCountAssertion(
    claim.timePeriod.kind === 'before-event' ? claim.text.replace(BEFORE_GOAL_PHRASE, '').trim() : claim.text,
    claim.playerSubject,
  )
  return assertion?.team === claim.subject ? assertion : undefined
}

/** Numerator and denominator for a count assertion over the claim's own window. */
function assertionCounts(
  assertion: CountAssertion,
  events: MatchEvent[],
): { numerator: MatchEvent[]; denominator: MatchEvent[] } {
  const shots = events.filter(
    (event) => event.type === 'shot' && event.team === assertion.team &&
      (!assertion.player || event.playerId === assertion.player.id),
  )
  const metric = assertion.kind !== 'universal' ? assertion.metric : 'shots-on-target'
  return {
    numerator: shots.filter((event) => matchesMetric(event, metric)),
    denominator: shots,
  }
}

function assertionVerdict(
  assertion: CountAssertion,
  counts: ReturnType<typeof assertionCounts>,
): ClaimResult['assessment'] {
  const numerator = counts.numerator.length
  const denominator = counts.denominator.length
  if (assertion.kind !== 'universal') {
    const holds = assertion.kind === 'none' ? numerator === 0 : numerator > 0
    return holds ? 'supported' : 'contradicted'
  }
  // A universal claim over zero recorded attempts is not settled by the data.
  if (denominator === 0) return 'insufficient evidence for a firm conclusion'
  const holds =
    assertion.quantifier === 'every'
      ? numerator === denominator
      : numerator === 0
  return holds !== assertion.negated ? 'supported' : 'contradicted'
}

function assertionMetricLabel(metric: ClaimMetric): string {
  return metric === 'shots-on-target' ? 'shots on target' : metric.replaceAll('-', ' ')
}

function countAssertionAnswer(
  result: ClaimResult,
  assertion: CountAssertion,
  fan: boolean,
): string {
  const metric = assertion.kind !== 'universal' ? assertion.metric : 'shots-on-target'
  const trace = assertion.player
    ? result.playerCalculations.find((item) => item.playerId === assertion.player!.id && item.metric === metric)
    : result.calculations[0]
  const team = assertion.player?.name ?? assertion.team
  const n = trace?.numerator ?? 0
  const d = trace?.denominator ?? 0
  const lead =
    result.assessment === 'supported'
      ? 'Yes — '
      : result.assessment === 'contradicted'
        ? 'No — '
        : fan
          ? "The records can't settle this one: "
          : 'The records cannot settle this: '
  let body: string
  if (assertion.kind !== 'universal') {
    const label = metricName(assertion.metric, n)
    const verb = assertion.player ? 'has' : 'have'
    body = n === 0
      ? `${team} ${verb} no recorded ${label}${assertion.player ? '' : ` (0 of ${d} recorded shots)`}.`
      : `${team} ${verb} ${n} recorded ${label}${assertion.metric === 'shots' || assertion.player ? '' : ` from ${d} recorded shots`}.`
  } else if (d === 0) {
    body = `${team} have no recorded shots, so there is nothing to test “${assertion.quantifier === 'every' ? 'every' : 'none'} shot on target” against.`
  } else {
    const rate = `${n} of ${team}'s ${d} recorded shots ${n === 1 ? 'was' : 'were'} on target`
    body = assertion.quantifier === 'every'
      ? assertion.negated
        ? result.assessment === 'supported'
          ? `not every shot was on target: ${rate}.`
          : `every ${team} shot was on target (${rate}).`
        : result.assessment === 'supported'
          ? `every ${team} shot was on target (${rate}).`
          : `${rate}, so not every shot was.`
      : result.assessment === 'supported'
        ? `none of ${team}'s ${d} recorded shots was on target.`
        : `${rate}.`
  }
  const sentence = `${lead}${body}`
  const anchor = result.evidence.find((item) => item.role === 'anchor')?.reference
  const scope = anchor
    ? `recorded play strictly before ${anchor.team}'s goal at ${anchor.time}`
    : result.periodLabel
  return `${sentence} This counts recorded shot events over ${scope}; it says nothing about chance quality.`
}

function selectedPlayerEntities(claim: InterpretedClaim): PlayerEntityReference[] {
  const entities = [
    claim.playerSubject,
    claim.meaning.comparison?.opponentPlayer ?? null,
  ].filter((player): player is PlayerEntityReference => player !== null)
  return [...new Map(entities.map((player) => [player.id, player])).values()]
}

function playerWindowDuration(
  player: PlayerEntityReference,
  fixture: SyntheticMatchEvidence,
  advanced: EvidenceCalculation,
): {
  minutes: number
  denominator: number
  numeratorRecordIds: string[]
  denominatorRecordIds: string[]
  denominatorDescription: string
  durationWindow: NonNullable<PlayerCalculationTrace['durationWindow']>
} {
  const record = fixture.players.find(({ id }) => id === player.id)
  if (!record) throw new Error(`Player ${player.id} is not in the active fixture.`)
  const subs = fixture.substitutions.filter(({ team }) => team === player.team)
  const coverageStart = elapsedMatchMinute(fixture.coverage.start)
  const coverageEnd = elapsedMatchMinute(fixture.coverage.end)
  const windowStart = Math.max(advanced.startElapsed, coverageStart)
  const windowEnd = Math.max(windowStart, Math.min(advanced.endElapsed, coverageEnd))
  let entered = record.status === 'starter' ? coverageStart : Number.POSITIVE_INFINITY
  let left = Number.POSITIVE_INFINITY
  for (const sub of subs) {
    const at = elapsedMatchMinute(sub.clock)
    if (sub.playerOnId === player.id) entered = Math.min(entered, at)
    if (sub.playerOffId === player.id) left = Math.min(left, at)
  }
  const participationStart = Math.min(windowEnd, Math.max(windowStart, entered))
  const participationEnd = Math.max(
    participationStart,
    Math.min(windowEnd, left),
  )
  const minutes = Number(Math.max(0, participationEnd - participationStart).toFixed(1))
  const elapsedLabel = (elapsed: number) =>
    Number.isInteger(elapsed) ? String(elapsed) : elapsed.toFixed(1)
  const elapsedRange = (start: number, end: number) =>
    `elapsed interval [${elapsedLabel(start)}, ${elapsedLabel(end)})`
  const durationWindow = {
    recordedCoverageStart: formatMatchClock(fixture.coverage.start),
    recordedCoverageEnd: formatMatchClock(fixture.coverage.end),
    selectedWindowStart: formatMatchClock(matchClockAtElapsed(windowStart)),
    selectedWindowEnd: formatMatchClock(matchClockAtElapsed(windowEnd)),
    participationStart: formatMatchClock(matchClockAtElapsed(participationStart)),
    participationEnd: formatMatchClock(matchClockAtElapsed(participationEnd)),
  }
  const boundarySubstitutions = subs.filter(({ playerOnId, playerOffId, clock }) =>
    (playerOnId === player.id || playerOffId === player.id) &&
    elapsedMatchMinute(clock) >= windowStart &&
    elapsedMatchMinute(clock) <= windowEnd,
  )
  return {
    minutes,
    denominator: Number(Math.max(0, windowEnd - windowStart).toFixed(1)),
    numeratorRecordIds: boundarySubstitutions
      .filter(({ playerOnId, playerOffId, clock }) => {
        const at = elapsedMatchMinute(clock)
        return (playerOnId === player.id && at === participationStart) ||
          (playerOffId === player.id && at === participationEnd)
      })
      .map(({ id }) => id),
    denominatorRecordIds: boundarySubstitutions.map(({ id }) => id),
    denominatorDescription:
      `Recorded fixture coverage (match clock): ${durationWindow.recordedCoverageStart}–${durationWindow.recordedCoverageEnd} ` +
      `(${elapsedRange(coverageStart, coverageEnd)}). ` +
      `Selected analysis window (match clock): ${durationWindow.selectedWindowStart}–${durationWindow.selectedWindowEnd} ` +
      `(${elapsedRange(windowStart, windowEnd)}). ` +
      `${player.name}'s on-pitch overlap (match clock): ${durationWindow.participationStart}–${durationWindow.participationEnd} ` +
      `(${elapsedRange(participationStart, participationEnd)}). ` +
      `Elapsed clock calculation: ${elapsedLabel(participationEnd)} − ${elapsedLabel(participationStart)} = ${minutes} minutes; ` +
      'added time is included and the half-time break is excluded.',
    durationWindow,
  }
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
    const duration = playerWindowDuration(player, fixture, advanced)
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
      ['minutes-played', duration.minutes],
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
          'minutes-played',
          'recoveries',
          'pressure-observations',
        ],
    )
    const calculationsForPlayer: Array<{
      metric: PlayerCalculationTrace['metric']
      selected: Array<{ id: string }>
      denominator: Array<{ id: string }>
      value: number | null
      numerator?: number
      denominatorValue?: number
      numeratorRecordIds?: string[]
      denominatorRecordIds?: string[]
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
        metric: 'minutes-played',
        selected: duration.numeratorRecordIds.map((id) => ({ id })),
        denominator: duration.denominatorRecordIds.map((id) => ({ id })),
        numerator: duration.minutes,
        denominatorValue: duration.denominator,
        numeratorRecordIds: duration.numeratorRecordIds,
        denominatorRecordIds: duration.denominatorRecordIds,
        value: duration.minutes,
        denominatorDescription: duration.denominatorDescription,
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
    for (const {
      metric,
      selected,
      denominator,
      numerator,
      denominatorValue,
      numeratorRecordIds,
      denominatorRecordIds,
      value,
      denominatorDescription,
    } of calculationsForPlayer) {
      if (!calculationMetrics.has(metric)) continue
      calculations.push({
        playerId: player.id,
        playerName: player.name,
        team: player.team,
        metric,
        numerator: numerator ?? selected.length,
        denominator: denominatorValue ?? denominator.length,
        value,
        numeratorRecordIds: numeratorRecordIds ?? selected.map(({ id }) => id),
        denominatorRecordIds: denominatorRecordIds ?? denominator.map(({ id }) => id),
        denominatorDescription,
        ...(metric === 'minutes-played' ? { durationWindow: duration.durationWindow } : {}),
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
  roster: SyntheticMatchEvidence['players'],
  anchorEvent?: MatchEvent,
): ClaimEvidence[] {
  if (
    isUnsupportedBuildUpPassingScope(claim) ||
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

  const countAssertion = countAssertionFor(claim)
  if (countAssertion) {
    const counts = assertionCounts(countAssertion, events)
    const numeratorIds = new Set(counts.numerator.map(({ id }) => id))
    const numeratorSupports =
      countAssertion.kind !== 'universal'
        ? countAssertion.kind === 'some'
        : countAssertion.quantifier === 'every' && !countAssertion.negated
    for (const event of counts.denominator) {
      const inNumerator = numeratorIds.has(event.id)
      const role: ClaimEvidence['role'] =
        countAssertion.kind !== 'universal'
          ? inNumerator ? numeratorSupports ? 'supporting' : 'challenging' : 'context'
          : inNumerator === numeratorSupports ? 'supporting' : 'challenging'
      evidence.set(event.id, { role, reference: reference(event, roster) })
    }
    if (anchorEvent) evidence.set(anchorEvent.id, { role: 'anchor', reference: reference(anchorEvent, roster) })
    return [...evidence.values()]
  }

  const halfTimeAssertion = goalBeforeHalfTimeAssertion(claim)
  if (halfTimeAssertion) {
    for (const event of events) {
      if (
        event.type === 'shot' &&
        event.outcome === 'goal' &&
        event.clock.period === 1 &&
        (!claim.subject || event.team === claim.subject) &&
        (!claim.playerSubject || event.playerId === claim.playerSubject.id)
      ) {
        evidence.set(event.id, {
          role:
            halfTimeAssertion === 'scored' ? 'supporting' : 'challenging',
          reference: reference(event, roster),
        })
      }
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
        reference: reference(anchorEvent, roster),
      })
    }
    return [...evidence.values()]
  }

  for (const event of events) {
    const relevant =
      (wantsAttackingEvents && availableKinds.has('attacking-events')) ||
      requiredMetrics.some((metric) => matchesMetric(event, metric))
    if (!relevant) continue

    const halfTimeAssertion = goalBeforeHalfTimeAssertion(claim)
    let role: ClaimEvidence['role'] = halfTimeAssertion
      ? halfTimeAssertion === 'scored'
        ? 'supporting'
        : 'challenging'
      : 'context'
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
    evidence.set(event.id, { role, reference: reference(event, roster) })
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
      reference: reference(anchorEvent, roster),
    })
  }

  return [...evidence.values()]
}

function calculationTraces(
  claim: InterpretedClaim,
  advanced: EvidenceCalculation,
  events: MatchEvent[] = [],
): CalculationTrace[] {
  const countAssertion = countAssertionFor(claim)
  if (countAssertion && !countAssertion.player) {
    const counts = assertionCounts(countAssertion, events)
    const metric = countAssertion.kind !== 'universal' ? countAssertion.metric : 'shots-on-target'
    return [
      {
        team: countAssertion.team,
        metric,
        value: counts.numerator.length,
        numerator: counts.numerator.length,
        denominator: counts.denominator.length,
        numeratorRecordIds: counts.numerator.map(({ id }) => id),
        denominatorRecordIds: counts.denominator.map(({ id }) => id),
        denominatorDescription: `All ${counts.denominator.length} recorded ${countAssertion.team} shots in the claim's window; ${assertionMetricLabel(metric)} are the recorded shots whose outcome matches.`,
      },
    ]
  }
  if (
    isUnsupportedBuildUpPassingScope(claim) ||
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
            : claim.intent === 'statistical-request' &&
                claim.requiredEvidence.includes('passing') &&
                claim.subject
              ? [claim.subject]
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
      claim.intent === 'statistical-request' &&
      !claim.meaning.comparison &&
      claim.requiredEvidence.includes('passing')
    ) {
      const passes = advanced.passes.filter((pass) => pass.team === team)
      const completed = passes.filter((pass) => pass.outcome === 'complete')
      traces.push({
        team,
        metric: 'pass-completions',
        value: completed.length,
        numerator: completed.length,
        denominator: passes.length,
        numeratorRecordIds: completed.map(({ id }) => id),
        denominatorRecordIds: passes.map(({ id }) => id),
        denominatorDescription: `${completed.length} completed passes among ${passes.length} recorded attempts for ${team} in the claim's calculated period; any exclusive historical cutoff is applied.`,
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
    const runningDistance =
      claim.meaning.comparison?.metric === 'running-distance' ||
      claim.playerMetric === 'running-distance'
    if (
      !runningDistance &&
      claim.requiredEvidence.includes('physical-measurements') &&
      classifyOpinion(claim.text)?.topic === 'physical-condition'
    ) {
      return `${topicLimitation('physical-condition')} There is no physical-data or continuous-tracking source.`
    }
    return unavailable.length > 0
      ? unavailable.join(' ')
      : 'The requested metric is not recorded in this synthetic fixture.'
  }
  if (
    result === 'unavailable data' &&
    isUnsupportedBuildUpPassingScope(claim)
  ) {
    return unavailable.length > 0
      ? unavailable.join(' ')
      : 'Phase-scoped pass counts, rates, and comparisons are not available from the selected build-up annotations. General match totals are not substituted.'
  }
  if (claim.intent === 'unrecognized-language') {
    if (classifyOpinion(claim.text)?.topic === 'prediction') return topicLimitation('prediction')
    return 'The local interpreter cannot reliably identify the requested football evidence. No unrelated statistics or events were selected.'
  }
  const countAssertion = countAssertionFor(claim)
  if (countAssertion) {
    const zeroAttempts =
      countAssertion.kind === 'universal' &&
      result === 'insufficient evidence for a firm conclusion'
    return zeroAttempts
      ? `${countAssertion.team} have no recorded shots in this window, so a claim about all of their shots cannot be tested. Zero attempts is a recorded absence, not a verdict.`
      : `Judged only on recorded shot outcomes (goal and saved count as on target) for ${countAssertion.team}; a zero count means no such record exists, and nothing here measures chance quality or shot location.`
  }
  const halfTimeAssertion = goalBeforeHalfTimeAssertion(claim)
  if (halfTimeAssertion) {
    if (
      result === 'supported' ||
      result === 'contradicted'
    ) {
      const goalRecorded =
        (halfTimeAssertion === 'scored') === (result === 'supported')
      const recordedFact = goalRecorded
        ? `${claim.subject} have a recorded first-half goal`
        : `No ${claim.subject} first-half goal is recorded`
      const verdict = result === 'supported' ? 'supports' : 'contradicts'
      return `${recordedFact}; this ${verdict} the half-time scoring assertion. The conclusion is limited to recorded first-half goal events in this synthetic fixture and does not assess broader performance.`
    }
    return `The selected-time evidence does not settle whether ${claim.subject} will score before half-time; only recorded first-half goal events are considered.`
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
  const topic = claim.intent === 'subjective-judgement' && claim.meaning.category === 'performance-judgement'
    ? classifyOpinion(claim.text)?.topic
    : undefined
  if (topic && topic !== 'defensive-approach' && topic !== 'pressure-progression') {
    return claim.playerSubject
      ? `${topicLimitation(topic)} Only sparse synthetic actions are attributed to ${claim.playerSubject.name}; no overall player rating or ranking is inferred.`
      : topicLimitation(topic)
  }
  if (claim.playerSubject) {
    return `The fixture provides only sparse synthetic actions attributed to ${claim.playerSubject.name}; pass, shot, recovery, and selected pressure counts are not a complete performance measure. No overall player rating or ranking is inferred.`
  }
  if (
    claim.intent === 'subjective-judgement' &&
    claim.requiredEvidence.includes('possession') &&
    concernsPossessionOrControl(claim) &&
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
  selectedClock: MatchClock,
  allSelectedEvents: MatchEvent[],
  advanced: EvidenceCalculation,
  fixture: SyntheticMatchEvidence,
): ClaimResult {
  const evidenceEvents =
    goalBeforeHalfTimeAssertion(claim) !== undefined ||
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
  const unsupportedBuildUpPassing = isUnsupportedBuildUpPassingScope(claim)
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
      claim.intent !== 'unrecognized-language' &&
      !unsupportedBuildUpPassing &&
      goalBeforeHalfTimeAssertion(claim) === undefined
    ? playerResults(claim, advanced, scopedEvents, fixture)
    : { statistics: [], calculations: [] }
  const statistics: TeamStatistic[] = canRetrieveSubjectEvidence &&
    availableForIntent &&
    !unsupportedBuildUpPassing &&
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
          item.kind === 'passing' && unsupportedBuildUpPassing
            ? {
                ...item,
                available: false,
                detail:
                  'Phase-scoped pass counts, rates, and comparisons are not available from the selected build-up annotations. General match totals are not substituted.',
              }
            : item.kind === 'passing' && !advanced.passCoverageComplete
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
    (claim.subject === null &&
      claim.playerSubject === null &&
      claim.meaning.category !== 'coaching-question')
      ? 'clarification needed'
      : 'insufficient evidence for a firm conclusion'
  if (
    assessment !== 'clarification needed' &&
    unsupportedBuildUpPassing
  ) {
    assessment = 'unavailable data'
  } else if (assessment !== 'clarification needed' && claim.intent === 'statistical-request') {
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
    !unsupportedBuildUpPassing &&
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
  const halfTimeAssertion = goalBeforeHalfTimeAssertion(claim)
  if (halfTimeAssertion && claim.clarificationNeeds.length === 0) {
    const goalRecorded = evidenceEvents.some(
      (event) =>
        event.type === 'shot' &&
        event.outcome === 'goal' &&
        event.clock.period === 1,
    )
    if (goalRecorded) {
      assessment =
        halfTimeAssertion === 'scored' ? 'supported' : 'contradicted'
    } else if (selectedClock.period > 1) {
      assessment =
        halfTimeAssertion === 'scored' ? 'contradicted' : 'supported'
    }
  }

  const countAssertion = countAssertionFor(claim)
  if (countAssertion) {
    assessment = assertionVerdict(
      countAssertion,
      assertionCounts(countAssertion, scopedEvents),
    )
  }

  const context = topicContext(claim, advanced, scopedEvents)
  const withContextStatistics = context
    ? [
        ...statistics.filter(
          ({ team, metric }) =>
            !context.statistics.some((item) => item.team === team && item.metric === metric),
        ),
        ...context.statistics,
      ]
    : statistics

  return {
    claim,
    assessment,
    periodLabel: periodLabel(claim, selectedPeriodLabel, allSelectedEvents),
    statistics: withContextStatistics,
    playerStatistics: playerData.statistics,
    playerCalculations: playerData.calculations,
    evidenceAvailability: resolvedAvailability,
    evidence: [
      ...(canRetrieveSubjectEvidence
        ? evidenceForClaim(
            claim,
            assessment,
            scopedEvents,
            resolvedAvailability,
            advanced,
            fixture.players,
            anchorEvent,
          )
        : []),
      ...(context?.evidence ?? []),
    ],
    calculations: [
      ...(canRetrieveSubjectEvidence
        ? calculationTraces(claim, advanced, scopedEvents)
        : []),
      ...(context?.calculations ?? []),
    ],
    limitation: makeLimitation(claim, resolvedAvailability, assessment, advanced),
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
    'minutes-played': 'elapsed minute of participation in recorded coverage',
  }
  const pluralLabels: Partial<Record<ClaimMetric, string>> = {
    'shots-on-target': 'shots on target',
    'pressure-observations': 'selected pressure observations',
    'minutes-played': 'elapsed minutes of participation in recorded coverage',
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
        .map((metric) => {
          const value = get(metric)
          if (metric !== 'minutes-played' || typeof value !== 'number') {
            return formatCount(metric, value)
          }
          const durationTrace = result.playerCalculations.find(
            ({ playerId, metric: traceMetric }) =>
              playerId === player.id && traceMetric === 'minutes-played',
          )
          const window = durationTrace?.durationWindow
          return window
            ? `${value} elapsed minutes of participation in recorded coverage (${window.selectedWindowStart}–${window.selectedWindowEnd}; on-pitch ${window.participationStart}–${window.participationEnd}; added time included, half-time excluded)`
            : `${value} elapsed minutes of participation in recorded coverage`
        })
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
    return `${team} ${joinNaturally(values)}`
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
  if (typeof minutes === 'number' && minutes > 0) {
    const durationTrace = result.playerCalculations.find(
      ({ playerId, metric }) =>
        playerId === player.id && metric === 'minutes-played',
    )
    const window = durationTrace?.durationWindow
    contributions.push(
      window
        ? `was on the pitch for ${minutes} elapsed minutes in the selected recorded window ${window.selectedWindowStart}–${window.selectedWindowEnd} (on-pitch interval ${window.participationStart}–${window.participationEnd}; added time included, half-time excluded)`
        : `had ${minutes} elapsed minutes of participation in recorded coverage`,
    )
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
  selectedClock: MatchClock,
): string {
  const claim = result.claim
  if (claim.clarificationNeeds.length > 0) {
    return claim.clarificationNeeds.join(' ')
  }
  if (result.assessment === 'clarification needed') {
    return `Could you clarify who or what you mean by “${claim.text}”?`
  }
  if (result.assessment === 'unavailable data') return result.limitation
  if (claim.intent === 'unavailable-metric') return result.limitation
  if (claim.intent === 'unrecognized-language') return result.limitation
  if (claim.intent === 'coaching-question') return coachingSentence(result)
  const answerAssertion = countAssertionFor(claim)
  if (answerAssertion) return countAssertionAnswer(result, answerAssertion, false)
  const halfTimeAssertion = goalBeforeHalfTimeAssertion(claim)
  if (halfTimeAssertion) {
    const goal = events.find(
      (event) =>
        event.type === 'shot' &&
        event.outcome === 'goal' &&
        event.clock.period === 1 &&
        (!claim.subject || event.team === claim.subject) &&
        (!claim.playerSubject || event.playerId === claim.playerSubject.id),
    )
    if (goal) {
      const teamOrPlayer = claim.playerSubject?.name ?? goal.team
      const fact = `${teamOrPlayer} scored before half-time at ${formatMatchClock(goal.clock)}.`
      const conclusion = halfTimeAssertion === 'did-not-score'
        ? `No — ${teamOrPlayer} did score before half-time at ${formatMatchClock(goal.clock)}; this recorded goal contradicts the claim.`
        : fact
      return `${conclusion} This claim is checked against first-half goal events, independently of the selected analysis window.`
    }
    const subjectName = claim.playerSubject?.name ?? claim.subject ?? 'team'
    if (selectedClock.period === 1) {
      return `The selected match time is ${formatMatchClock(selectedClock)}; no ${subjectName} goal before half-time is recorded yet, so the final first-half claim cannot be established.`
    }
    return halfTimeAssertion === 'did-not-score'
      ? `Yes — no ${subjectName} goal before half-time is recorded. This claim is checked against first-half goal events, independently of the selected analysis window.`
      : `No — no ${subjectName} goal before half-time is recorded. This claim is checked against first-half goal events, independently of the selected analysis window.`
  }
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
      const comparisonScope = historicalScope(claim, events)
      return `${comparison}${limitation}${comparisonScope ? ` ${comparisonScope}` : ''}`
    }
  }
  if (claim.meaning.category === 'historical-circumstance') {
    const scope = historicalScope(claim, events)
    const conclusion =
      result.assessment === 'supported'
        ? `The recorded evidence supports the view that ${claim.text.replace(/[.!?]+$/, '')}.`
        : `The available evidence cannot establish whether ${claim.text.replace(/[.!?]+$/, '')}.`
    const isRunOfPlayJudgement =
      /against the run of play/i.test(claim.text) && claim.subject !== null
    const subjectPossession =
      isRunOfPlayJudgement
        ? result.calculations.find(
            ({ team, metric }) =>
              team === claim.subject && metric === 'possession-percentage',
          )
        : undefined
    const opponentPossession =
      isRunOfPlayJudgement
        ? result.calculations.find(
            ({ team, metric }) =>
              team !== claim.subject && metric === 'possession-percentage',
          )
        : undefined
    const possessionContext =
      subjectPossession &&
      subjectPossession.value !== null &&
      opponentPossession &&
      opponentPossession.value !== null
        ? ` Before the goal, ${subjectPossession.team} accounted for ${subjectPossession.value}% and ${opponentPossession.team} ${opponentPossession.value}% of recorded controlled-possession time (${subjectPossession.denominator} recorded minutes; contested and out-of-play intervals are excluded).`
        : ''
    const limitation = result.limitation.includes('territory') ||
      result.limitation.includes('chance quality')
      ? 'The fixture has no continuous territorial or chance-quality data.'
      : result.limitation
    return `${conclusion}${possessionContext} ${scope} ${limitation}`
  }
  if (
    claim.intent === 'subjective-judgement' &&
    claim.requiredEvidence.includes('possession') &&
    concernsPossessionOrControl(claim) &&
    claim.subject
  ) {
    const own =  result.statistics.find(({ team }) => team === claim.subject)?.value
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
  if (claim.playerSubject || claim.subject) {
    const reply = topicReply(result, fixture, events, advanced)
    if (reply) return reply
  }
  if (claim.playerSubject) {
    const endElapsed = claimEndElapsed(claim, events, advanced)
    const answer = broadPlayerSentence(result, fixture, endElapsed)
    return `${answer} These are sparse synthetic records, not a complete performance measure or overall rating.`
  }
  if (claim.intent === 'subjective-judgement') {
    const contextSentence = topicContextSentence(claim, advanced)
    if (contextSentence) {
      return `The available match events do not establish the broader judgement: “${claim.text}”. ${contextSentence}`
    }
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
  selectedClock: MatchClock,
): string {
  if (claims.length === 0) {
    return 'Enter an opinion to interpret its claims and retrieve relevant evidence from this synthetic fixture.'
  }

  const answers = claims.map((result) =>
    answerForClaim(result, fixture, events, advanced, selectedClock),
  )
  return `${answers.join(' ')}\n\nSelected period: ${selectedPeriodLabel}. This is a fictional match using real-player names; all performances and results are fictional.`
}

const possessionControlPattern = /possess|domina|in control|controll?ed|ran the (?:game|match)|bossed|outplay|had the ball/i
const defensiveShapePattern = new RegExp(
  `${/park(?:ed|ing) the bus|low block|sat (?:deep|back)|defen[cs]\w*|deep|compact|shape|back (?:five|four|three)/i.source}|${DEFENSIVE_SHAPE_PATTERN.source}`,
  'i',
)

function plural(count: number, noun: string): string {
  const suffix = /(s|sh|ch|x)$/.test(noun) ? 'es' : 's'
  return `${count} ${noun}${count === 1 ? '' : suffix}`
}

/**
 * Topic-specific recorded facts for a broad opinion about a player or team, followed by the
 * shared limitation for that class of opinion. Returns undefined when the claim is not a
 * classified broad opinion, so the existing wording applies.
 */
function topicReply(
  result: ClaimResult,
  fixture: SyntheticMatchEvidence,
  events: MatchEvent[],
  advanced: EvidenceCalculation,
): string | undefined {
  const claim = result.claim
  if (claim.intent !== 'subjective-judgement' || claim.meaning.category !== 'performance-judgement') {
    return undefined
  }
  const classification = classifyOpinion(claim.text)
  if (!classification) return undefined
  const { topic, negated } = classification
  const player = claim.playerSubject
  let facts: string | undefined
  if (player) {
    const endElapsed = claimEndElapsed(claim, events, advanced)
    const participation = playerParticipation(player, fixture, endElapsed)
    if (participation === 'not-yet-on-pitch' || participation === 'unused-substitute') {
      return broadPlayerSentence(result, fixture, endElapsed)
    }
    const values = new Map(result.playerStatistics.map(({ metric, value }) => [metric, value]))
    const num = (metric: PlayerStatistic['metric']) => {
      const value = values.get(metric)
      return typeof value === 'number' ? value : 0
    }
    const attempts = num('pass-attempts')
    const completions = num('pass-completions')
    if (topic === 'passing-quality') {
      facts = attempts === 0
        ? `${player.name} has no recorded pass attempts in this period.`
        : `${player.name} completed ${completions} of ${attempts} recorded passes (${Number(((completions / attempts) * 100).toFixed(1))}%); ${plural(attempts - completions, 'recorded pass')} did not reach the intended receiver.`
    } else if (topic === 'possession-losses') {
      const lost = advanced.turnovers.filter(({ playerId }) => playerId === player.id)
      const areas = lost.map(({ location }) => classifyPitchArea(location).replaceAll('-', ' '))
      facts = lost.length === 0
        ? `No turnovers are recorded against ${player.name} in this period (${plural(attempts, 'recorded pass attempt')}).`
        : `${player.name} lost possession ${plural(lost.length, 'time')} through recorded incomplete passes (${areas.join(', ')}), from ${plural(attempts, 'recorded pass attempt')}.`
    } else if (topic === 'attacking-output' || topic === 'finishing') {
      const shots = num('shots')
      facts = shots === 0
        ? `${player.name} has no recorded shots in this period.`
        : `${player.name} had ${plural(shots, 'recorded shot')}: ${num('shots-on-target')} on target and ${plural(num('goals'), 'goal')}.`
    } else if (topic === 'involvement') {
      const actions = attempts + num('shots') + num('recoveries') + num('pressure-observations')
      facts = `${broadPlayerSentence(result, fixture, endElapsed)} That is ${plural(actions, 'recorded action')} (passes, shots, recoveries and selected pressure observations).`
    } else {
      facts = broadPlayerSentence(result, fixture, endElapsed)
    }
  } else if (claim.subject) {
    const team = advanced.teams[claim.subject]
    if (topic === 'passing-quality') {
      facts = team.passCompletionPercentage === null
        ? `${claim.subject} has no recorded pass attempts in this period.`
        : `${claim.subject} completed ${team.completedPasses} of ${team.passAttempts} recorded passes (${team.passCompletionPercentage}%).`
    } else if (topic === 'possession-losses') {
      const losses = team.possessionLosses
      facts = `${claim.subject} recorded losses of possession: defensive third ${losses['defensive-third'] ?? 'unavailable'}, middle third ${losses['middle-third'] ?? 'unavailable'}, final third ${losses['final-third'] ?? 'unavailable'}.`
    } else if (topic === 'attacking-output' || topic === 'finishing' || topic === 'overall-performance' || topic === 'momentum') {
      facts = statisticsSentence(result)
    }
  }
  if (!player && (topic === 'defensive-approach' || topic === 'pressure-progression')) return undefined
  const parts = [facts, negated ? "Negating a take doesn't change what the records can show; they can't settle it either way." : undefined, topicLimitation(topic), topicContextSentence(claim, advanced) || undefined]
  if (player && (topic === 'overall-performance' || topic === 'involvement')) {
    parts.push(`For a specific count, ask “How many passes did ${player.name} complete?” or “How many shots did ${player.name} have?”`)
  }
  return parts.filter(Boolean).join(' ')
}

function concernsPossessionOrControl(claim: InterpretedClaim): boolean {
  return possessionControlPattern.test(claim.text) && !defensiveShapePattern.test(claim.text)
}

function concernsDefensiveShape(claim: InterpretedClaim): boolean {
  return defensiveShapePattern.test(claim.text)
}

type TopicContextKind = 'keeper' | 'possession-context' | 'pressure-sample'

/** Which recorded context (never a verdict) a broad team opinion may carry, from its shared topic class. */
function topicContextKind(claim: InterpretedClaim): TopicContextKind | undefined {
  if (
    claim.intent !== 'subjective-judgement' ||
    claim.meaning.category !== 'performance-judgement' ||
    !claim.subject ||
    claim.playerSubject ||
    claim.clarificationNeeds.length > 0 ||
    claim.timePeriod.kind !== 'selected'
  ) {
    return undefined
  }
  const topic = classifyOpinion(claim.text)?.topic
  if (topic === 'attacking-output' && /\btesting the (?:goal)?keeper\b/i.test(claim.text)) return 'keeper'
  if (topic === 'defensive-approach') return 'possession-context'
  if (topic === 'pressure-progression' && /\bpress(?:ed|ing)?\b/i.test(claim.text)) return 'pressure-sample'
  return undefined
}

function topicContext(
  claim: InterpretedClaim,
  advanced: EvidenceCalculation,
  scopedEvents: MatchEvent[],
): { statistics: TeamStatistic[]; evidence: ClaimEvidence[]; calculations: CalculationTrace[] } | undefined {
  const kind = topicContextKind(claim)
  if (!kind || !claim.subject) return undefined
  const team = claim.subject
  const none = { statistics: [], evidence: [], calculations: [] }
  if (kind === 'keeper') {
    return {
      ...none,
      statistics: [{
        team,
        metric: 'shots-on-target',
        value: statValue(team, 'shots-on-target', scopedEvents, advanced),
      }],
    }
  }
  if (kind === 'possession-context') {
    if (advanced.denominatorMinutes === 0 || !advanced.possessionCoverageComplete) return none
    return {
      statistics: TEAMS.map((side) => ({
        team: side,
        metric: 'possession-percentage' as const,
        value: advanced.teams[side].possessionPercentage,
      })),
      evidence: advanced.possessionIntervals
        .filter((interval) => interval.status === 'controlled' && interval.team)
        .map((interval) => ({
          role: 'context' as const,
          reference: {
            id: interval.id,
            time: `${formatMatchClock(interval.start)}–${formatMatchClock(interval.end)}`,
            team: interval.team!,
            description: `${interval.durationMinutes} recorded minutes of controlled possession (context only; not evidence of defensive shape).`,
          },
        })),
      calculations: calculationTraces(
        { ...claim, requiredEvidence: ['possession'] },
        advanced,
        scopedEvents,
      ),
    }
  }
  const observations = advanced.pressures.filter((pressure) => pressure.team === team)
  return {
    statistics: TEAMS.map((side) => ({
      team: side,
      metric: 'pressure-observations' as const,
      value: advanced.pressures.filter((pressure) => pressure.team === side).length,
    })),
    evidence: observations.map((pressure) => ({
      role: 'context' as const,
      reference: {
        id: pressure.id,
        time: formatMatchClock(pressure.clock),
        team: pressure.team,
        description: `Selected ${pressure.type.replaceAll('-', ' ')} observation by ${pressure.playerId}; pressure coverage is partial (context only).`,
      },
    })),
    calculations: [],
  }
}

/** Fan-facing sentence for that context, with its attribution and what it cannot show. */
function topicContextSentence(claim: InterpretedClaim, advanced: EvidenceCalculation): string {
  const kind = topicContextKind(claim)
  if (!kind || !claim.subject) return ''
  const team = claim.subject
  const opponent = TEAMS.find((side) => side !== team)!
  if (kind === 'keeper') {
    return '“Testing the keeper” is a qualitative judgement. Shots on target are a recorded count only; they don’t show how hard the keeper was tested.'
  }
  if (kind === 'possession-context') {
    const own = advanced.teams[team].possessionPercentage
    const other = advanced.teams[opponent].possessionPercentage
    const context = advanced.denominatorMinutes > 0 && advanced.possessionCoverageComplete && own !== null && other !== null
      ? ` For context only: ${team} had ${own}% of recorded controlled possession to ${opponent}'s ${other}% (contested and out-of-play minutes excluded). That does not support or contradict defensive shape.`
      : ''
    return `Nothing here records defensive shape or positioning.${context}`
  }
  const count = (side: MatchTeam) => advanced.pressures.filter((pressure) => pressure.team === side).length
  const own = count(team)
  const sample = own === 0
    ? `No selected pressure observations are recorded for ${team} in this window; with only a sample recorded, that doesn't show ${team} weren't pressing.`
    : `${team} have ${plural(own, 'selected pressure observation')} in this window (${opponent}: ${count(opponent)}).`
  return `${sample} Pressure is recorded only for selected possessions, so this is a partial sample: it doesn't show continuous pressing, how high it was, or its intensity.`
  }

  function fanScope(claim: InterpretedClaim, events: MatchEvent[]): string {
  if (claim.timePeriod.kind !== 'before-event') return ''
  const anchorId = claim.timePeriod.eventId
  const anchor = events.find(({ id }) => id === anchorId)
  if (!anchor) throw new Error('Validated historical event anchor was not found.')
  return `That counts play strictly before ${anchor.team}'s goal at ${formatMatchClock(anchor.clock)}, leaving the goal itself out.`
}

function fanComparison(result: ClaimResult): string | undefined {
  const metric = result.claim.meaning.comparison?.metric
  const [subject, opponent] = comparisonValues(result)
  if (!metric || !subject || !opponent) return undefined
  const lead =
    result.assessment === 'supported'
      ? 'Yes — '
      : result.assessment === 'contradicted'
        ? 'No — '
        : "The records can't settle this one: "
  if (subject.value === null || opponent.value === null) {
    return `${lead}${subject.name}'s ${metricName(metric)} ${subject.value === null ? "isn't" : 'is'} available${opponent.value === null ? ` and neither is ${opponent.name}'s` : `, and ${opponent.name}'s is ${formatCount(metric, opponent.value)}`}.`
  }
  if (metric === 'pass-completion-percentage') {
    return `${lead}${subject.name} completed ${subject.completions} of ${subject.attempts} passes (${subject.value}%) to ${opponent.name}'s ${opponent.completions} of ${opponent.attempts} (${opponent.value}%).`
  }
  if (metric === 'possession-percentage') {
    return `${lead}${subject.name} had ${subject.value}% of recorded possession to ${opponent.name}'s ${opponent.value}%.`
  }
  if (subject.value === opponent.value) {
    return `${lead}${subject.name} and ${opponent.name} are level on ${formatCount(metric, subject.value)} each.`
  }
  return `${lead}${subject.name} have ${formatCount(metric, subject.value)} to ${opponent.name}'s ${opponent.value}.`
}

/** Conversational, meaning-preserving Fan reply, built deterministically from the validated results. */
function fanAnswerForClaim(
  result: ClaimResult,
  fixture: SyntheticMatchEvidence,
  events: MatchEvent[],
  advanced: EvidenceCalculation,
  selectedClock: MatchClock,
  userWording?: string,
): string {
  const claim = result.claim
  const quote = (userWording ?? claim.text).replace(/[.!?]+$/, '')
  if (claim.clarificationNeeds.length > 0) return claim.clarificationNeeds.join(' ')
  if (result.assessment === 'clarification needed') {
    return `Quick check first — who or what do you mean by “${quote}”?`
  }
  if (result.assessment === 'unavailable data' || claim.intent === 'unavailable-metric') {
    return `I can't tell you that one. ${result.limitation}`
  }
  if (claim.intent === 'unrecognized-language') {
    if (classifyOpinion(claim.text)?.topic === 'prediction') {
      return `That's a prediction about what happens next, and the records only cover play up to ${formatMatchClock(selectedClock)}. I can check what has happened so far — try asking about shots, possession or passes up to now.`
    }
    return "I couldn't match that to something I can check in this match, and I haven't picked out unrelated figures instead. Try naming a team or player and what you want to know."
  }
  if (claim.intent === 'coaching-question') return coachingSentence(result)
  const fanAssertion = countAssertionFor(claim)
  if (fanAssertion) return countAssertionAnswer(result, fanAssertion, true)
  const halfTimeAssertion = goalBeforeHalfTimeAssertion(claim)
  if (halfTimeAssertion) {
    const goal = events.find(
      (event) =>
        event.type === 'shot' &&
        event.outcome === 'goal' &&
        event.clock.period === 1 &&
        (!claim.subject || event.team === claim.subject) &&
        (!claim.playerSubject || event.playerId === claim.playerSubject.id),
    )
    const who = claim.playerSubject?.name ?? claim.subject ?? 'The team'
    const basis = "That's judged on first-half goals, whichever window is selected."
    if (goal) {
      const when = formatMatchClock(goal.clock)
      return halfTimeAssertion === 'did-not-score'
        ? `No — ${who} did score before half-time, at ${when}. ${basis}`
        : `Yes — ${who} scored before half-time, at ${when}. ${basis}`
    }
    if (selectedClock.period === 1) {
      return `We're only at ${formatMatchClock(selectedClock)} and there's no ${who} goal in the first half yet, so the half-time claim can't be settled.`
    }
    return halfTimeAssertion === 'did-not-score'
      ? `Yes — there's no ${who} goal before half-time in the records. ${basis}`
      : `No — there's no ${who} goal before half-time in the records. ${basis}`
  }
  if (claim.intent === 'statistical-request') {
    const statistics = statisticsSentence(result) ?? result.limitation
    const limitation = passDataLimitation(result)
    const scope = fanScope(claim, events)
    return `${statistics}${limitation ? ` ${limitation}` : ''}${scope ? ` ${scope}` : ''}`
  }
  if (
    claim.meaning.category === 'historical-circumstance' &&
    claim.playerSubject &&
    !/against the run of play/i.test(claim.text)
  ) {
    const player = broadPlayerSentence(result, fixture, claimEndElapsed(claim, events, advanced))
    return `${player} ${fanScope(claim, events)} It's thin data, so it's no rating of ${claim.playerSubject.name}'s overall game.`.replace(/\s{2,}/g, ' ')
  }
  if (claim.intent === 'factual-claim' && claim.meaning.category === 'factual-comparison') {
    const comparison = fanComparison(result)
    if (comparison) {
      const note =
        claim.meaning.comparison?.metric === 'possession-percentage'
          ? " Possession only counts recorded controlled time, so it doesn't show territorial control or overall performance."
          : passDataLimitation(result)
            ? ` ${passDataLimitation(result)}`
            : ''
      const scope = fanScope(claim, events)
      return `${comparison}${note}${scope ? ` ${scope}` : ''}`
    }
  }
  if (claim.meaning.category === 'historical-circumstance') {
    const supported = result.assessment === 'supported'
    const isRunOfPlay = /against the run of play/i.test(claim.text) && claim.subject !== null
    const own = isRunOfPlay
      ? result.calculations.find(({ team, metric }) => team === claim.subject && metric === 'possession-percentage')
      : undefined
    const other = isRunOfPlay
      ? result.calculations.find(({ team, metric }) => team !== claim.subject && metric === 'possession-percentage')
      : undefined
    const possession =
      own && own.value !== null && other && other.value !== null
        ? ` Before the goal, ${own.team} had ${own.value}% of recorded possession to ${other.team}'s ${other.value}% (${own.denominator} recorded minutes of controlled play).`
        : ''
    const limitation = result.limitation.includes('territory') || result.limitation.includes('chance quality')
      ? "There's no continuous territorial or chance-quality data to go on."
      : result.limitation
    return `${supported ? `The records back that up: ${quote}.` : `The records can't settle whether ${quote}.`}${possession} ${fanScope(claim, events)} ${limitation}`.replace(/\s{2,}/g, ' ').trim()
  }
  if (
    claim.intent === 'subjective-judgement' &&
    claim.requiredEvidence.includes('possession') &&
    concernsPossessionOrControl(claim) &&
    claim.subject
  ) {
    const own = result.statistics.find(({ team }) => team === claim.subject)?.value
    const opponentStat = result.statistics.find(({ team }) => team !== claim.subject)
    const opponent = opponentStat?.value
    if (own !== undefined && own !== null && opponent !== undefined && opponent !== null) {
      const aspect = own > opponent
        ? 'That backs up the possession part of the take.'
        : own < opponent
          ? 'That goes against the possession part of the take.'
          : "They were level on possession."
      return `${claim.subject} had ${own}% of recorded possession to ${opponentStat?.team}'s ${opponent}%. ${aspect} Possession alone doesn't settle overall dominance.`
    }
  }
  if (claim.playerSubject || claim.subject) {
    const reply = topicReply(result, fixture, events, advanced)
    if (reply) return reply
  }
  if (claim.playerSubject) {
    const answer = broadPlayerSentence(result, fixture, claimEndElapsed(claim, events, advanced))
    return `${answer} That's sparse data, so it isn't a full read on ${claim.playerSubject.name}'s game.`
  }
  if (claim.intent === 'subjective-judgement') {
    const contextSentence = topicContextSentence(claim, advanced)
    if (contextSentence) {
      return `That's a bigger football opinion than the match events can settle: “${quote}”. ${contextSentence}`
    }
    const shape = concernsDefensiveShape(claim)
      ? " Nothing here records defensive shape or positioning, and possession share doesn't tell you how a side set up."
      : classifyOpinion(claim.text)?.topic === 'pressure-progression'
        ? ` ${topicLimitation('pressure-progression')}`
        : ''
    return `That's a bigger football opinion than the match events can settle: “${quote}”. I can only report what's recorded.${shape}`
  }
  if (result.assessment === 'insufficient evidence for a firm conclusion') {
    return `The records don't settle whether ${quote}. ${result.limitation}`
  }
  return answerForClaim(result, fixture, events, advanced, selectedClock)
}

function createFanReply(
  claims: ClaimResult[],
  fixture: SyntheticMatchEvidence,
  advanced: EvidenceCalculation,
  events: MatchEvent[],
  selectedClock: MatchClock,
  opinion = '',
): string {
  if (claims.length === 0) {
    return "I couldn't find a football claim in that. Try naming a team or player and what you want to know."
  }
  const original = opinion.trim()
  // Only the user's own words may be quoted back; a lone claim is the whole take.
  const wordingFor = (result: ClaimResult): string | undefined =>
    claims.length === 1 && original !== ''
      ? original
      : original.toLowerCase().includes(result.claim.text.trim().toLowerCase())
        ? result.claim.text
        : undefined
  return claimReplies(
    claims,
    fixture,
    advanced,
    events,
    selectedClock,
    wordingFor,
  ).join(' ')
}

function claimReplies(
  claims: ClaimResult[],
  fixture: SyntheticMatchEvidence,
  advanced: EvidenceCalculation,
  events: MatchEvent[],
  selectedClock: MatchClock,
  wordingFor: (result: ClaimResult) => string | undefined,
): string[] {
  return claims.map((result) =>
      fanAnswerForClaim(result, fixture, events, advanced, selectedClock, wordingFor(result)),
  )
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
      minutesInWindow: playerWindowDuration(player, fixture, advanced).minutes,
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
  fixtureOverride?: SyntheticMatchEvidence,
): Promise<AnalysisResponse> {
  if (
    typeof input === 'object' &&
    input !== null &&
    'action' in input &&
    input.action === 'resolve-player'
  ) {
    return resolvePlayerSelection(input)
  }
  if (
    typeof input === 'object' &&
    input !== null &&
    'action' in input &&
    input.action === 'recheck-resolved-player'
  ) {
    return recheckResolvedPlayer(input)
  }
  const parsed = parseAnalysisRequest(input)
  const dataset = resolveDataset(parsed.datasetId)
  const slotted = toSlotOpinion(parsed.opinion, dataset.naming)
  const request = { ...parsed, opinion: slotted.text }
  const response = await analyzeSlottedOpinion(
    request,
    dataset,
    Object.keys(slotted.foreign).length > 0 ? new LocalInterpretationProvider() : provider,
    fixtureOverride,
  )
  if (Object.keys(slotted.foreign).length > 0) {
    const teams = dataset.naming.teams
    const foreignMarkers = Object.keys(slotted.foreign).map((slot) => `__foreign_${slot}__`)
    const names = foreignMarkers.join(' and ')
    const fanReply = `${names} ${foreignMarkers.length === 1 ? 'is' : 'are'} not part of ${teams[0]} v ${teams[1]}. I have not attributed this opinion to either team or selected team-specific evidence.`
    const unsupported = {
      ...response,
      fanReply,
      summary: `${fanReply}\n\nSelected period: ${response.selectedPeriodLabel}. This is a fictional match using real-player names; all performances and results are fictional.`,
      claims: response.claims.map((result) => ({
        ...result,
        claim: {
          ...result.claim,
          subject: null,
          playerSubject: null,
          playerMetric: null,
          intent: 'unrecognized-language' as const,
          meaning: {
            category: 'other' as const,
            description: 'The opinion names a team outside this fixture.',
            comparison: null,
          },
          requiredEvidence: [],
          clarificationNeeds: [],
        },
        assessment: 'unrecognized language' as const,
        statistics: [],
        playerStatistics: [],
        playerCalculations: [],
        calculations: [],
        evidenceAvailability: [],
        evidence: [],
        limitation: 'The named team is not part of this fixture, so no team-specific evidence was selected.',
      })),
    }
    return toDisplay(unsupported, dataset.naming, slotted.foreign)
  }
  return toDisplay(
    addPlayerResolutionContinuation(
      response,
      parsed,
      response.claims.map(({ claim }) => claim),
      response.evidenceFoundation.players.map(({ id, name, team }) => ({
        id,
        name,
        team,
      })),
      dataset.naming,
      response.provider,
      [],
    ),
    dataset.naming,
  )
}

function normalizePlayerName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function mentionsAlias(text: string, alias: string): boolean {
  const normalizedText = normalizePlayerName(text)
  const normalizedAlias = normalizePlayerName(alias)
  const escaped = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(
    normalizedText,
  )
}

function playerCandidatesForClaim(
  claim: InterpretedClaim,
  opinion: string,
  players: PlayerResolutionOption[],
  naming: TeamNaming,
): PlayerResolutionOption[] {
  if (
    claim.intent !== 'statistical-request' ||
    claim.subject !== null ||
    claim.playerSubject !== null ||
    claim.meaning.category !== 'other' ||
    claim.meaning.comparison !== null ||
    claim.clarificationNeeds.length === 0 ||
    claim.playerMetric === null ||
    !claim.requiredEvidence.some((kind) =>
      ['passing', 'player-events', 'lineups'].includes(kind),
    )
  ) {
    return []
  }
  const canonicalOpinion = canonicalizeSupportedFootballOpinion(opinion)
  const groups = new Map<string, PlayerResolutionOption[]>()
  for (const player of players) {
    const firstName = player.name.trim().split(/\s+/u)[0]
    if (firstName.length < 3) continue
    const key = normalizePlayerName(firstName)
    groups.set(key, [...(groups.get(key) ?? []), player])
  }
  const matching = [...groups.entries()].filter(
    ([alias, candidates]) =>
      candidates.length > 1 &&
      mentionsAlias(canonicalOpinion, alias) &&
      mentionsAlias(claim.text, alias),
  )
  if (matching.length !== 1) return []
  const candidates = matching[0][1]
  if (
    candidates.some(
      (candidate) =>
        mentionsAlias(canonicalOpinion, candidate.name),
    )
  ) {
    return []
  }
  const teamSlots = [
    { canonical: 'Northbridge', aliases: [naming.teams[0], ...naming.aliases[0]] },
    { canonical: 'Eastport', aliases: [naming.teams[1], ...naming.aliases[1]] },
  ]
  const mentionedInOpinion = teamSlots.filter(({ canonical, aliases }) => {
    const names = [canonical, ...aliases]
    return names.some((name) => mentionsAlias(canonicalOpinion, name))
  })
  const explicitTeams = teamSlots.filter(({ canonical, aliases }) => {
    const names = [canonical, ...aliases]
    return (
      names.some((name) => mentionsAlias(claim.text, name))
    )
  })
  if (
    mentionedInOpinion.length === 1 &&
    (explicitTeams.length !== 1 ||
      explicitTeams[0].canonical !== mentionedInOpinion[0].canonical)
  ) {
    return []
  }
  if (explicitTeams.length === 1) {
    return candidates.filter(({ team }) => team === explicitTeams[0].canonical)
  }
  return candidates
}

function candidateSetsForClaims(
  claims: InterpretedClaim[],
  opinion: string,
  players: PlayerResolutionOption[],
  naming: TeamNaming,
): PlayerResolutionGrant['candidates'] {
  return claims.flatMap((claim) => {
    const candidates = playerCandidatesForClaim(claim, opinion, players, naming)
    return candidates.length > 1 ? [{ claimId: claim.id, players: candidates }] : []
  })
}

function addPlayerResolutionContinuation(
  response: AnalysisResponse,
  request: AnalysisRequest,
  claims: InterpretedClaim[],
  players: PlayerResolutionOption[],
  naming: TeamNaming,
  provider: 'local' | 'foundry',
  selectedPlayers: PlayerResolutionOption[],
): AnalysisResponse {
  const candidates = candidateSetsForClaims(claims, request.opinion, players, naming)
  if (candidates.length === 0 && selectedPlayers.length === 0) return response
  const continuation = signPlayerResolution({
    request,
    provider,
    claims,
    candidates,
    selectedPlayers,
  })
  return {
    ...response,
    claims: response.claims.map((result) => {
      const options = candidates.find(({ claimId }) => claimId === result.claim.id)
      return options ? { ...result, playerResolution: { continuation, candidates: options.players } } : result
    }),
    playerResolutionContinuation: continuation,
    ...(selectedPlayers.length > 0 ? { selectedPlayers } : {}),
  }
}

function validateGrant(
  grant: PlayerResolutionGrant,
  selectedClock = grant.request.selectedClock,
  period = grant.request.period,
) {
  const request = parseAnalysisRequest({
    ...grant.request,
    selectedClock,
    period,
  })
  const dataset = resolveDataset(request.datasetId)
  const slotted = toSlotOpinion(request.opinion, dataset.naming)
  if (Object.keys(slotted.foreign).length > 0) {
    throw new Error('Player clarification cannot resolve an opinion containing a foreign fixture team.')
  }
  const fixture = dataset.evidence
  const end = elapsedMatchMinute(request.selectedClock)
  const availableEvents = dataset.events.filter(
    (event) => elapsedMatchMinute(event.clock) <= end,
  )
  let claims: InterpretedClaim[]
  try {
    claims = validateInterpretation(
      { claims: grant.claims },
      availableEvents,
      fixture.players,
      { requireClaims: request.opinion.length > 0 },
    )
  } catch (error) {
    throw new InputValidationError(
      error instanceof Error ? error.message : 'Saved player clarification is invalid.',
    )
  }
  const players = fixture.players.map(({ id, name, team }) => ({ id, name, team }))
  const actualCandidates = candidateSetsForClaims(
    claims,
    request.opinion,
    players,
    dataset.naming,
  )
  if (JSON.stringify(actualCandidates) !== JSON.stringify(grant.candidates)) {
    throw new InputValidationError('Player clarification candidates do not match this fixture and opinion.')
  }
  for (const selected of grant.selectedPlayers) {
    const known = players.find(({ id }) => id === selected.id)
    if (
      !known ||
      known.name !== selected.name ||
      known.team !== selected.team
    ) {
      throw new InputValidationError('Previously selected player does not match this fixture.')
    }
  }
  return { request, dataset, fixture, slotted, availableEvents, claims, players }
}

function continuationProvider(name: 'local' | 'foundry'): InterpretationProvider {
  return {
    name,
    async interpret() {
      throw new Error('A player-resolution continuation must not invoke an interpreter.')
    },
  }
}

async function analyzeContinuation(
  grant: PlayerResolutionGrant,
  claims: InterpretedClaim[],
  request: AnalysisRequest,
  selectedPlayers: PlayerResolutionOption[],
): Promise<AnalysisResponse> {
  const dataset = resolveDataset(request.datasetId)
  const players = dataset.evidence.players.map(({ id, name, team }) => ({
    id,
    name,
    team,
  }))
  const validated = validateGrant(
    {
      ...grant,
      request,
      claims,
      candidates: candidateSetsForClaims(
        claims,
        request.opinion,
        players,
        dataset.naming,
      ),
      selectedPlayers,
    },
    request.selectedClock,
    request.period,
  )
  const response = await analyzeSlottedOpinion(
    { ...validated.request, opinion: validated.slotted.text },
    validated.dataset,
    continuationProvider(grant.provider),
    undefined,
    validated.claims,
  )
  return toDisplay(
    addPlayerResolutionContinuation(
      response,
      validated.request,
      validated.claims,
      validated.players,
      validated.dataset.naming,
      grant.provider,
      selectedPlayers,
    ),
    validated.dataset.naming,
  )
}

export async function resolvePlayerSelection(
  input: unknown,
  secret?: string,
): Promise<AnalysisResponse> {
  const request = parsePlayerResolutionRequest(input)
  const grant = verifyPlayerResolution(request.continuation, secret)
  const validated = validateGrant(grant)
  const candidateSet = grant.candidates.find(
    ({ claimId }) => claimId === request.claimId,
  )
  const claimIndex = validated.claims.findIndex(
    ({ id }) => id === request.claimId,
  )
  if (
    !candidateSet ||
    claimIndex < 0 ||
    !candidateSet.players.some(({ id }) => id === request.playerId)
  ) {
    throw new InputValidationError('Selected player is not a candidate for this clarification.')
  }
  const player = validated.players.find(({ id }) => id === request.playerId)
  if (!player) throw new InputValidationError('Selected player is not in this fixture.')
  const resolvedClaims = validated.claims.map((claim, index) =>
    index === claimIndex
      ? {
          ...claim,
          subject: player.team,
          playerSubject: player,
          clarificationNeeds: [],
        }
      : claim,
  )
  let checkedClaims: InterpretedClaim[]
  try {
    checkedClaims = validateInterpretation(
      { claims: resolvedClaims },
      validated.availableEvents,
      validated.fixture.players,
      { requireClaims: true },
    )
  } catch (error) {
    throw new InputValidationError(
      error instanceof Error ? error.message : 'Selected player claim is invalid.',
    )
  }
  const selectedPlayers = [
    ...grant.selectedPlayers.filter(
      ({ id }) => id !== player.id,
    ),
    player,
  ]
  return analyzeContinuation(
    grant,
    checkedClaims,
    validated.request,
    selectedPlayers,
  )
}

export async function recheckResolvedPlayer(
  input: unknown,
  secret?: string,
): Promise<AnalysisResponse> {
  const request = parseResolvedPlayerRecheckRequest(input)
  const grant = verifyPlayerResolution(request.continuation, secret)
  const validated = validateGrant(
    grant,
    request.selectedClock,
    request.period,
  )
  return analyzeContinuation(
    grant,
    validated.claims,
    validated.request,
    grant.selectedPlayers,
  )
}

async function analyzeSlottedOpinion(
  request: ReturnType<typeof parseAnalysisRequest>,
  dataset: ReturnType<typeof resolveDataset>,
  provider: InterpretationProvider,
  fixtureOverride?: SyntheticMatchEvidence,
  validatedClaims?: InterpretedClaim[],
): Promise<AnalysisResponse> {
  const fixture = fixtureOverride ?? dataset.evidence
  const matchEvents = dataset.events
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
  const interpreted = validatedClaims
    ? undefined
    : request.opinion
    ? await provider.interpret(request.opinion, {
        events: eventsThroughSelectedTime,
        selectedClock: request.selectedClock,
        selectedTime,
        period: request.period,
        capabilities: EVIDENCE_CAPABILITIES,
        players: fixture.players,
        inputLanguage: request.inputLanguage,
      })
    : { claims: [] }
  let claims: InterpretedClaim[]
  try {
    claims = validateInterpretation(
      validatedClaims ? { claims: validatedClaims } : normalizeKnownInterpretation(interpreted),
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
      request.selectedClock,
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
  const originalOpinion = request.opinion.trim()
  const replies = claimReplies(
    results,
    fixture,
    advanced,
    eventsThroughSelectedTime,
    request.selectedClock,
    (result) =>
      claims.length === 1 && originalOpinion !== ''
        ? originalOpinion
        : originalOpinion
            .toLowerCase()
            .includes(result.claim.text.trim().toLowerCase())
          ? result.claim.text
          : undefined,
  )
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
      request.selectedClock,
    ),
    fanReply: createFanReply(
      results,
      fixture,
      advanced,
      eventsThroughSelectedTime,
      request.selectedClock,
      request.opinion,
    ),
    selectedTime,
    selectedPeriodLabel,
    score: matchSoFar.score,
    periodStatistics,
    periodEvents: matchAnalysis.periodEvents.map((event) =>
      reference(event, fixture.players),
    ),
    evidenceFoundation: createEvidenceFoundation(
      advanced,
      selectedPeriodLabel,
      fixture,
      matchAnalysis.periodEvents,
    ),
    claims: results.map((result, index) => ({ ...result, reply: replies[index] })),
  }

  return response
}
