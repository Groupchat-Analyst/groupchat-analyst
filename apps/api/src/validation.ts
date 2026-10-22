import {
  getMatchTimeOptions,
  type AnalysisPeriod,
  type MatchEvent,
  type MatchClock,
} from '../../shared/src/match.js'
import type {
  AnalysisRequest,
  ClaimIntent,
  ClaimMeaningCategory,
  ClaimMetric,
  ClaimOperator,
  EvidenceKind,
  InterpretedClaim,
  PlayerEntityReference,
} from '../../shared/src/apiContracts.js'

const evidenceKinds: EvidenceKind[] = [
  'possession',
  'territorial-control',
  'shots',
  'shots-on-target',
  'goals',
  'attacking-events',
  'player-events',
  'passing',
  'possession-losses',
  'physical-measurements',
  'build-up-phase',
  'lineups',
]
const meaningCategories: ClaimMeaningCategory[] = [
  'factual-comparison',
  'performance-judgement',
  'historical-circumstance',
  'coaching-question',
  'other',
]
const claimIntents: ClaimIntent[] = [
  'statistical-request',
  'factual-claim',
  'subjective-judgement',
  'unavailable-metric',
  'coaching-question',
  'unrecognized-language',
]
const metrics: ClaimMetric[] = [
  'shots',
  'shots-on-target',
  'goals',
  'possession-percentage',
  'pass-attempts',
  'pass-completions',
  'pass-completion-percentage',
  'running-distance',
  'minutes-played',
  'recoveries',
  'pressure-observations',
]
const evidenceForMetric: Record<ClaimMetric, EvidenceKind> = {
  shots: 'shots',
  'shots-on-target': 'shots-on-target',
  goals: 'goals',
  'possession-percentage': 'possession',
  'pass-attempts': 'passing',
  'pass-completions': 'passing',
  'pass-completion-percentage': 'passing',
  'running-distance': 'physical-measurements',
  'minutes-played': 'lineups',
  recoveries: 'player-events',
  'pressure-observations': 'player-events',
}
// These team metrics have deterministic calculators. Other listed metrics are
// player-only until a team definition and calculation trace are implemented.
const teamComparisonMetrics = new Set<ClaimMetric>([
  'shots',
  'shots-on-target',
  'goals',
  'possession-percentage',
  'pass-attempts',
  'pass-completions',
  'pass-completion-percentage',
  'running-distance', // Supported as an explicit unavailable-data response.
])

const operators: ClaimOperator[] = [
  'greater-than',
  'less-than',
  'equal',
  'greater-or-equal',
  'less-or-equal',
  'not-equal',
  'comparison-request',
]

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InputValidationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  )
}

function isTeam(value: unknown): value is 'Northbridge' | 'Eastport' {
  return value === 'Northbridge' || value === 'Eastport'
}

function isClock(value: unknown): value is MatchClock {
  if (!isRecord(value)) return false
  const expectedKeys =
    value.stoppageMinutes === undefined
      ? ['period', 'minute']
      : ['period', 'minute', 'stoppageMinutes']
  if (!hasExactKeys(value, expectedKeys)) return false
  if (
    !Number.isInteger(value.period) ||
    !Number.isInteger(value.minute) ||
    (value.period !== 1 && value.period !== 2) ||
    typeof value.minute !== 'number'
  ) {
    return false
  }
  if (
    value.stoppageMinutes !== undefined &&
    (!Number.isInteger(value.stoppageMinutes) ||
      typeof value.stoppageMinutes !== 'number')
  ) {
    return false
  }

  return getMatchTimeOptions().some(
    (clock) =>
      clock.period === value.period &&
      clock.minute === value.minute &&
      clock.stoppageMinutes === value.stoppageMinutes,
  )
}

export function parseAnalysisRequest(value: unknown): AnalysisRequest {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['opinion', 'selectedClock', 'period'])
  ) {
    throw new InputValidationError(
      'Request must contain only opinion, selectedClock, and period.',
    )
  }
  if (typeof value.opinion !== 'string' || value.opinion.length > 2000) {
    throw new InputValidationError('Opinion must be text no longer than 2,000 characters.')
  }
  if (!isClock(value.selectedClock)) {
    throw new InputValidationError('Selected match time is invalid.')
  }
  if (
    value.period !== 'match-so-far' &&
    value.period !== 'last-10-minutes'
  ) {
    throw new InputValidationError('Selected evidence period is invalid.')
  }

  return {
    opinion: value.opinion.trim(),
    selectedClock: value.selectedClock,
    period: value.period as AnalysisPeriod,
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`)
  return value
}

function requireString(
  value: unknown,
  label: string,
  maxLength: number,
): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`${label} must be non-empty text of at most ${maxLength} characters.`)
  }
  return value.trim()
}

function requireStringArray(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 8 ||
    !value.every(
      (item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 240,
    )
  ) {
    throw new Error(`${label} must contain at most eight short text items.`)
  }
  return value.map((item) => item.trim())
}

export type GoalBeforeHalfTimeAssertion = 'scored' | 'did-not-score'

const halfTimeAssertionPattern =
  /^(Northbridge|Eastport)\s+(?:(?:did not|didn['’]t|never|has not|hasn['’]t|have not|haven['’]t|had not|hadn['’]t)\s+score(?:d)?(?:\s+(?:any\s+)?goals?)?|scored)\s+before half[- ]time[.!?]?$/i

export function goalBeforeHalfTimeAssertion(
  value: unknown,
  allowNormalization = false,
): GoalBeforeHalfTimeAssertion | undefined {
  if (!isRecord(value) || typeof value.text !== 'string') return undefined
  const match = halfTimeAssertionPattern.exec(value.text.trim())
  if (
    !match ||
    typeof value.subject !== 'string' ||
    value.subject.toLowerCase() !== match[1].toLowerCase()
  ) {
    return undefined
  }
  if (
    value.playerSubject !== null ||
    value.playerMetric !== null ||
    !Array.isArray(value.clarificationNeeds) ||
    value.clarificationNeeds.length !== 0 ||
    value.historicalEventAnchor !== null ||
    !Array.isArray(value.requiredEvidence) ||
    value.requiredEvidence.some(
      (kind) => kind !== 'goals' && kind !== 'attacking-events',
    ) ||
    !isRecord(value.meaning) ||
    value.meaning.comparison !== null ||
    !isRecord(value.timePeriod) ||
    value.timePeriod.kind !== 'selected'
  ) {
    return undefined
  }
  if (allowNormalization) {
    if (
      !['statistical-request', 'factual-claim'].includes(value.intent as string) ||
      !['historical-circumstance', 'other'].includes(
        value.meaning.category as string,
      )
    ) {
      return undefined
    }
  } else if (
    value.intent !== 'factual-claim' ||
    value.meaning.category !== 'historical-circumstance'
  ) {
    return undefined
  }
  return /^(?:Northbridge|Eastport)\s+(?:did not|didn['’]t|never|has not|hasn['’]t|have not|haven['’]t|had not|hadn['’]t)\s+score(?:d)?(?:\s+(?:any\s+)?goals?)?\s+before half[- ]time[.!?]?$/i.test(
    value.text.trim(),
  )
    ? 'did-not-score'
    : 'scored'
}

function hasAmbiguousHalfTimeScoringClaim(value: Record<string, unknown>): boolean {
  if (
    typeof value.text !== 'string' ||
    !['factual-claim', 'statistical-request', 'unrecognized-language'].includes(
      value.intent as string,
    ) ||
    !isRecord(value.meaning) ||
    !['historical-circumstance', 'other'].includes(
      value.meaning.category as string,
    ) ||
    value.meaning.comparison !== null ||
    value.playerSubject !== null ||
    value.playerMetric !== null ||
    value.historicalEventAnchor !== null ||
    !Array.isArray(value.requiredEvidence) ||
    value.requiredEvidence.some(
      (kind) => kind !== 'goals' && kind !== 'attacking-events',
    ) ||
    !Array.isArray(value.clarificationNeeds) ||
    value.clarificationNeeds.length !== 0 ||
    !isRecord(value.timePeriod) ||
    value.timePeriod.kind !== 'selected'
  ) {
    return false
  }
  const text = value.text.trim()
  const subject =
    value.subject === 'Northbridge' || value.subject === 'Eastport'
      ? value.subject
      : undefined
  if (!subject || goalBeforeHalfTimeAssertion(value, true)) return false
  return (
    new RegExp(`\\b${subject}\\b`, 'i').test(text) &&
    /(?:\b(?:score|scores|scored|scoring|goal|goals)\b.{0,80}\bbefore half[- ]time\b|\bbefore half[- ]time\b.{0,80}\b(?:score|scores|scored|scoring|goal|goals)\b)/i.test(
      text,
    )
  )
}

function isBuildUpLossLocationQuestion(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const asksForLocation =
    /^\s*(?:where\b|(?:locate|identify|show|map)\s+where\b|(?:which|what)\s+(?:areas?|parts?|zones?)\b)/i.test(
      value,
    )
  return (
    asksForLocation &&
    /\b(?:lose|loses|losing|lost)\s+(?:possession|the ball)\b/i.test(value) &&
    /\bbuild[- ]?up\b/i.test(value)
  )
}

export function hasExplicitBuildUpPassingScope(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const phaseScope =
    /\b(?:during|in|within|throughout)\s+(?:the\s+)?build[- ]?up(?:\s+phase)?\b|\bbuild[- ]?up(?:\s+phase)?\s+(?:passes?|passing|pass[- ]completion)\b/i
  const passingMetric =
    /\bpasses?\b|\bpassing\b|\bpass[- ]completion(?:\s+(?:rate|percentage|accuracy))?\b/i
  return phaseScope.test(value) && passingMetric.test(value)
}

export function normalizeKnownInterpretation(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.claims)) return value
  return {
    ...value,
    claims: value.claims.map((value) => {
      if (!isRecord(value)) return value
      const claim = { ...value }
      const meaning = isRecord(claim.meaning) ? { ...claim.meaning } : undefined
      if (!meaning) return claim

      const comparison = isRecord(meaning.comparison)
        ? meaning.comparison
        : undefined
      const explicitBuildUpPassingScope = hasExplicitBuildUpPassingScope(
        claim.text,
      )
      if (
        hasAmbiguousHalfTimeScoringClaim(claim)
      ) {
        claim.clarificationNeeds = [
          'Please rephrase whether the team scored or did not score before half-time.',
        ]
      }

      const comparisonMetric = comparison?.metric
      const comparisonOperator = comparison?.operator
      if (
        comparison &&
        typeof comparisonMetric === 'string' &&
        metrics.includes(comparisonMetric as ClaimMetric) &&
        operators.includes(comparisonOperator as ClaimOperator) &&
        ['statistical-request', 'factual-claim', 'unavailable-metric'].includes(
          claim.intent as string,
        ) &&
        meaning.category === 'factual-comparison' &&
        (claim.playerMetric === null ||
          claim.playerMetric === comparisonMetric)
      ) {
        const metric = comparisonMetric as ClaimMetric
        claim.playerMetric = null
        claim.requiredEvidence = [
          evidenceForMetric[metric],
          ...(explicitBuildUpPassingScope && evidenceForMetric[metric] === 'passing'
            ? ['build-up-phase']
            : []),
        ]
        if (claim.intent !== 'unavailable-metric') {
          claim.intent =
            comparisonOperator === 'comparison-request'
              ? 'statistical-request'
              : 'factual-claim'
        }
      }

      const requiredEvidence = Array.isArray(claim.requiredEvidence)
        ? claim.requiredEvidence
        : []
      if (
        explicitBuildUpPassingScope &&
        requiredEvidence.includes('passing') &&
        !requiredEvidence.includes('build-up-phase')
      ) {
        claim.requiredEvidence = [...requiredEvidence, 'build-up-phase']
      }
      if (
        comparison === undefined &&
        claim.playerMetric === null &&
        requiredEvidence.includes('build-up-phase') &&
        requiredEvidence.includes('possession-losses') &&
        claim.intent === 'statistical-request' &&
        meaning.category === 'other' &&
        isBuildUpLossLocationQuestion(claim.text)
      ) {
        claim.intent = 'coaching-question'
        meaning.category = 'coaching-question'
      }

      if (
        meaning.category === 'historical-circumstance' &&
        typeof claim.text === 'string' &&
        /against the run of play/i.test(claim.text) &&
        Object.hasOwn(claim, 'requiredEvidence')
      ) {
        claim.requiredEvidence = [
          'possession',
          'territorial-control',
          'attacking-events',
        ]
      }

      const metric =
        comparisonMetric ??
        (typeof claim.playerMetric === 'string' ? claim.playerMetric : undefined)
      if (
        claim.intent === 'unavailable-metric' &&
        metric === 'running-distance' &&
        Object.hasOwn(claim, 'requiredEvidence') &&
        Object.hasOwn(claim, 'timePeriod') &&
        Object.hasOwn(claim, 'historicalEventAnchor')
      ) {
        claim.requiredEvidence = ['physical-measurements']
        claim.timePeriod = { kind: 'selected' }
        claim.historicalEventAnchor = null
      }

      if (goalBeforeHalfTimeAssertion(claim, true)) {
        claim.intent = 'factual-claim'
        meaning.category = 'historical-circumstance'
        meaning.comparison = null
        claim.playerMetric = null
        claim.requiredEvidence = ['goals']
        claim.timePeriod = { kind: 'selected' }
        claim.historicalEventAnchor = null
      }

      claim.meaning = meaning
      return claim
    }),
  }
}

export function validateInterpretation(
  value: unknown,
  availableEvents: MatchEvent[],
  availablePlayers: Array<PlayerEntityReference> = [],
  options: { requireClaims?: boolean } = {},
): InterpretedClaim[] {
  const root = requireRecord(value, 'Interpretation')
  if (!hasExactKeys(root, ['claims']) || !Array.isArray(root.claims)) {
    throw new Error('Interpretation must contain only a claims array.')
  }
  if (root.claims.length > 8) {
    throw new Error('Interpretation may contain at most eight claims.')
  }
  if (options.requireClaims && root.claims.length === 0) {
    throw new Error('A non-empty opinion must produce at least one claim or clarification.')
  }
  const claimIds = new Set<string>()
  const eventIds = new Set(availableEvents.map((event) => event.id))
  const playersById = new Map(availablePlayers.map((player) => [player.id, player]))

  function parsePlayerReference(value: unknown, label: string): PlayerEntityReference | null {
    if (value === null) return null
    const raw = requireRecord(value, label)
    if (
      !hasExactKeys(raw, ['id', 'name', 'team']) ||
      typeof raw.id !== 'string' ||
      typeof raw.name !== 'string' ||
      !isTeam(raw.team)
    ) {
      throw new Error(`${label} is invalid.`)
    }
    const known = playersById.get(raw.id)
    if (!known || known.name !== raw.name || known.team !== raw.team) {
      throw new Error(`${label} does not match a player in the current fixture.`)
    }
    return { id: known.id, name: known.name, team: known.team }
  }

  return root.claims.map((value, index) => {
    const label = `Claim ${index + 1}`
    const claim = requireRecord(value, label)
    const claimKeys = [
      'id',
      'subject',
      'playerSubject',
      'playerMetric',
      'text',
      'intent',
      'meaning',
      'requiredEvidence',
      'timePeriod',
      'historicalEventAnchor',
      'clarificationNeeds',
    ]
    if (!hasExactKeys(claim, claimKeys)) {
      throw new Error(`${label} has missing or unexpected fields.`)
    }
    const id = requireString(claim.id, `${label} ID`, 64)
    if (claimIds.has(id)) {
      throw new Error(`${label} ID must be unique within an interpretation.`)
    }
    claimIds.add(id)
    const claimText = requireString(claim.text, `${label} text`, 500)

    const subject = claim.subject
    if (subject !== null && !isTeam(subject)) {
      throw new Error(`${label} has an invalid subject.`)
    }
    const playerSubject = parsePlayerReference(
      claim.playerSubject,
      `${label} player subject`,
    )
    if (playerSubject && subject !== playerSubject.team) {
      throw new Error(`${label} player subject must belong to its named team.`)
    }
    const playerMetric =
      claim.playerMetric === null
        ? null
        : metrics.includes(claim.playerMetric as ClaimMetric)
          ? (claim.playerMetric as ClaimMetric)
          : (() => {
              throw new Error(`${label} player metric is invalid.`)
            })()
    if (!claimIntents.includes(claim.intent as ClaimIntent)) {
      throw new Error(`${label} intent is invalid.`)
    }
    const meaning = requireRecord(claim.meaning, `${label} meaning`)
    if (
      !hasExactKeys(meaning, ['category', 'description', 'comparison']) ||
      !meaningCategories.includes(meaning.category as ClaimMeaningCategory)
    ) {
      throw new Error(`${label} meaning is invalid.`)
    }
    const comparisonValue = meaning.comparison
    let comparison: InterpretedClaim['meaning']['comparison'] = null
    if (comparisonValue !== null) {
      const rawComparison = requireRecord(comparisonValue, `${label} comparison`)
      if (
        !hasExactKeys(rawComparison, ['opponent', 'opponentPlayer', 'metric', 'operator']) ||
        !isTeam(rawComparison.opponent) ||
        !metrics.includes(rawComparison.metric as ClaimMetric) ||
        !operators.includes(rawComparison.operator as ClaimOperator)
      ) {
        throw new Error(`${label} comparison is invalid.`)
      }
      const opponentPlayer = parsePlayerReference(
        rawComparison.opponentPlayer,
        `${label} comparison player`,
      )
      if (subject === null || rawComparison.opponent === subject) {
        if (
          !playerSubject ||
          !opponentPlayer ||
          rawComparison.opponent !== opponentPlayer.team ||
          playerSubject.id === opponentPlayer.id
        ) {
          throw new Error(`${label} comparison must name two different teams or players.`)
        }
      }
      if (
        opponentPlayer &&
        (!playerSubject || rawComparison.opponent !== opponentPlayer.team)
      ) {
        throw new Error(`${label} comparison player must match the comparison team.`)
      }
      if (Boolean(playerSubject) !== Boolean(opponentPlayer)) {
        throw new Error(
          `${label} must compare two players or two teams; mixed player/team comparisons are not supported.`,
        )
      }
      comparison = {
        opponent: rawComparison.opponent,
        opponentPlayer,
        metric: rawComparison.metric as ClaimMetric,
        operator: rawComparison.operator as ClaimOperator,
      }
    }

    if (
      !Array.isArray(claim.requiredEvidence) ||
      claim.requiredEvidence.length > evidenceKinds.length ||
      !claim.requiredEvidence.every(
        (kind) => evidenceKinds.includes(kind as EvidenceKind),
      )
    ) {
      throw new Error(`${label} has invalid required evidence.`)
    }
    const requiredEvidence = [...new Set(claim.requiredEvidence as EvidenceKind[])]
    if (
      (comparison &&
        (meaning.category !== 'factual-comparison' ||
          !requiredEvidence.includes(evidenceForMetric[comparison.metric]))) ||
      (meaning.category === 'factual-comparison' && !comparison)
    ) {
      throw new Error(
        `${label} comparison must be factual and request its calculated metric.`,
      )
    }
    if (
      (claim.intent === 'statistical-request' &&
        (comparison
          ? comparison.operator !== 'comparison-request'
          : subject === null ||
            meaning.category !== 'other' ||
          !requiredEvidence.some((kind) =>
            ['shots', 'shots-on-target', 'goals', 'passing', 'player-events', 'lineups'].includes(kind),
          ))) ||
      (playerMetric !== null && playerSubject === null) ||
      (playerMetric !== null &&
        !requiredEvidence.includes(evidenceForMetric[playerMetric])) ||
      (comparison !== null && playerMetric !== null) ||
      (comparison?.operator === 'comparison-request' &&
        claim.intent !== 'statistical-request' &&
        claim.intent !== 'unavailable-metric') ||
      (claim.intent === 'unavailable-metric' &&
        !requiredEvidence.some((kind) =>
          ['physical-measurements', 'player-events'].includes(kind),
        ))
    ) {
      throw new Error(`${label} intent does not match its evidence request.`)
    }
    if (
      comparison &&
      !['factual-claim', 'statistical-request', 'unavailable-metric'].includes(
        claim.intent as string,
      )
    ) {
      throw new Error(`${label} comparison is incompatible with its declared intent.`)
    }
    if (comparison && !playerSubject && !teamComparisonMetrics.has(comparison.metric)) {
      throw new Error(`${label} metric does not have a supported team comparison calculator.`)
    }
    if (
      playerSubject &&
      (playerMetric === 'possession-percentage' ||
        comparison?.metric === 'possession-percentage')
    ) {
      throw new Error(`${label} possession percentage is defined for teams, not individual players.`)
    }
    const timePeriod = requireRecord(claim.timePeriod, `${label} time period`)
    let normalizedTimePeriod: InterpretedClaim['timePeriod']
    if (
      hasExactKeys(timePeriod, ['kind']) &&
      timePeriod.kind === 'selected'
    ) {
      normalizedTimePeriod = { kind: 'selected' }
    } else if (
      hasExactKeys(timePeriod, ['kind', 'eventId']) &&
      timePeriod.kind === 'selected' &&
      timePeriod.eventId === null
    ) {
      normalizedTimePeriod = { kind: 'selected' }
    } else if (
      hasExactKeys(timePeriod, ['kind', 'eventId']) &&
      timePeriod.kind === 'before-event' &&
      typeof timePeriod.eventId === 'string' &&
      eventIds.has(timePeriod.eventId)
    ) {
      normalizedTimePeriod = {
        kind: 'before-event',
        eventId: timePeriod.eventId,
      }
    } else {
      throw new Error(`${label} time period is invalid or references an unavailable event.`)
    }

    let historicalEventAnchor: InterpretedClaim['historicalEventAnchor'] = null
    if (claim.historicalEventAnchor !== null) {
      const anchor = requireRecord(
        claim.historicalEventAnchor,
        `${label} historical event anchor`,
      )
      if (
        !hasExactKeys(anchor, ['eventId', 'relationship']) ||
        typeof anchor.eventId !== 'string' ||
        !eventIds.has(anchor.eventId)
      ) {
        throw new Error(`${label} historical event anchor is invalid or unavailable.`)
      }
      historicalEventAnchor = {
        eventId: anchor.eventId,
        relationship: requireString(
          anchor.relationship,
          `${label} anchor relationship`,
          120,
        ),
      }
    }
    if (
      normalizedTimePeriod.kind === 'before-event' &&
      (!historicalEventAnchor ||
        historicalEventAnchor.eventId !== normalizedTimePeriod.eventId)
    ) {
      throw new Error(`${label} before-event period must use its historical anchor.`)
    }
    const clarificationNeeds = requireStringArray(
      claim.clarificationNeeds,
      `${label} clarification needs`,
    )
    if (historicalEventAnchor && normalizedTimePeriod.kind !== 'before-event') {
      throw new Error(`${label} historical anchor must use its exclusive before-event period.`)
    }
    if (
      meaning.category === 'historical-circumstance' &&
      clarificationNeeds.length === 0 &&
      normalizedTimePeriod.kind !== 'before-event' &&
      goalBeforeHalfTimeAssertion(claim) === undefined
    ) {
      throw new Error(`${label} historical circumstance requires an exclusive before-event period or clarification.`)
    }
    if (
      subject === null &&
      clarificationNeeds.length === 0 &&
      meaning.category !== 'coaching-question'
    ) {
      throw new Error(`${label} needs clarification when its subject is unknown.`)
    }
    if (normalizedTimePeriod.kind === 'before-event') {
      const anchorEvent = availableEvents.find(
        (event) => event.id === normalizedTimePeriod.eventId,
      )
      if (
        !anchorEvent ||
        anchorEvent.type !== 'shot' ||
        anchorEvent.outcome !== 'goal' ||
        (subject !== null && anchorEvent.team !== subject)
      ) {
        throw new Error(
          `${label} before-event period must anchor to a goal by its named subject.`,
        )
      }
      if (
        playerSubject &&
        meaning.category === 'historical-circumstance'
      ) {
        if (
          anchorEvent.type !== 'shot' ||
          anchorEvent.playerId !== playerSubject.id
        ) {
          throw new Error(
            `${label} historical anchor must be a goal scored by the named player.`,
          )
        }
      }
    }

    return {
      id,
      subject: subject as InterpretedClaim['subject'],
      playerSubject,
      playerMetric,
      text: claimText,
      intent: claim.intent as ClaimIntent,
      meaning: {
        category: meaning.category as ClaimMeaningCategory,
        description: requireString(
          meaning.description,
          `${label} meaning description`,
          300,
        ),
        comparison,
      },
      requiredEvidence,
      timePeriod: normalizedTimePeriod,
      historicalEventAnchor,
      clarificationNeeds,
    }
  })
}
