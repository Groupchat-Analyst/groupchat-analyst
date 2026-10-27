import {
  formatMatchClock,
  TEAMS,
  type MatchEvent,
  type MatchTeam,
} from '../../../shared/src/match.js'
import type {
  ClaimIntent,
  ClaimMeaningCategory,
  ClaimMetric,
  EvidenceKind,
  InterpretedClaim,
} from '../../../shared/src/apiContracts.js'
import type { PlayerEntityReference } from '../../../shared/src/apiContracts.js'
import { interpretClaim } from '../../../shared/src/interpretClaim.js'
import {
  BEFORE_GOAL_PHRASE as GOAL_PHRASE,
  mentionsShotLocation,
  parseCountAssertion,
  type CountAssertion,
} from '../../../shared/src/countAssertions.js'
import { classifyOpinion, evidenceForTopic } from '../../../shared/src/opinionTopics.js'
import { canonicalizeSupportedFootballOpinion } from '../../../shared/src/localization.js'
import type {
  InterpretationContext,
  InterpretationProvider,
} from './provider.js'

function splitOpinion(opinion: string): string[] {
  return opinion
    .trim()
    .split(/[;\n]+|(?<=[.!?])\s+/)
    .flatMap((sentence) =>
      sentence.split(/\s*,\s*(?=(?:Northbridge|Eastport)\b)/i),
    )
    .flatMap((part) =>
      isPassCompletionRequest(part)
        ? [part]
        : part.split(
            /\s+(?:and|but|however)\s+(?=(?:Northbridge|Eastport)\b(?!['’]s\b))/i,
          ),
    )
    .flatMap((part) =>
      part.split(
        /\s+(?:and|but|however)\s+(?=(?:were|was|are|is|felt|looked|seemed|played|deserved|became|remained)\b)/i,
      ),
    )
    .map((part) => part.trim().replace(/^[, ]+|[,.!?]+$/g, ''))
    .filter(Boolean)
}

type ParsedComparisonRequest = {
  subject: MatchTeam
  opponent: MatchTeam
  metric: ClaimMetric
  intent: ClaimIntent
  operator?: NonNullable<InterpretedClaim['meaning']['comparison']>['operator']
}

type ParsedSingleStatisticRequest = {
  subject: MatchTeam
  metric: ClaimMetric
}

function parsePassCompletionAssertion(
  text: string,
): ParsedComparisonRequest | undefined {
  const team = '(Northbridge|Eastport)'
  const assertion = new RegExp(
    `^\\s*(?<subject>${team})\\s+(?:completed|completes|had|has|have|recorded)\\s+(?:a\\s+)?(?<direction>higher|greater|better|lower|less)\\s+(?:pass(?:es)?\\s+completion\\s+(?:percentage|rate)|passing\\s+accuracy|percentage\\s+of\\s+(?:their\\s+)?passes)\\s+than\\s+(?<opponent>${team})\\s*[.!?]*\\s*$`,
    'i',
  ).exec(text)
  const subject = assertion?.groups?.subject
  const opponent = assertion?.groups?.opponent
  const direction = assertion?.groups?.direction?.toLowerCase()
  const resolvedSubject = subject
    ? TEAMS.find((candidate) => candidate.toLowerCase() === subject.toLowerCase())
    : undefined
  const resolvedOpponent = opponent
    ? TEAMS.find((candidate) => candidate.toLowerCase() === opponent.toLowerCase())
    : undefined
  if (!resolvedSubject || !resolvedOpponent || resolvedSubject === resolvedOpponent) {
    return undefined
  }

  return {
    subject: resolvedSubject,
    opponent: resolvedOpponent,
    metric: 'pass-completion-percentage',
    intent: 'factual-claim',
    operator: direction === 'lower' || direction === 'less'
      ? 'less-than'
      : 'greater-than',
  }

}

const COMPLETED_PASS_COUNT =
  /\b(?:pass completions|complet(?:e|ed|es)\s+(?:(?:more|fewer|less|as\s+many|the\s+same\s+number\s+of)\s+)?passes|(?:more|fewer|less|as\s+many|the\s+same\s+number\s+of)\s+completed\s+passes|completed\s+passes|pass completion counts?)\b/i

/** Team comparison of completed-pass counts (not attempts or completion percentage). */
function parseCompletedPassCount(text: string): ParsedComparisonRequest | undefined {
  if (!COMPLETED_PASS_COUNT.test(text)) return undefined
  const teams = orderedTeams(text)
  if (teams.length !== 2 || teams[0] === teams[1]) return undefined
  const asMany = /\b(?:as\s+many|the\s+same\s+number\s+of)\b/i.test(text)
  const negated = /\b(?:did\s+not|didn['’]t|not)\b/i.test(text)
  const operator = asMany
    ? negated ? 'not-equal' : 'equal'
    : comparisonOperator(text)
  if (!operator) return undefined
  return {
    subject: teams[0],
    opponent: teams[1],
    metric: 'pass-completions',
    intent: 'factual-claim',
    operator,
  }
}

function normalizeName(value: string): string {
  return value
    .replace(/[Øø]/g, (letter) => letter.toLowerCase() === 'ø' ? 'o' : 'O')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function mentionedPlayers(
  text: string,
  players: InterpretationContext['players'],
): PlayerEntityReference[] {
  const normalizedText = ` ${normalizeName(text).replace(/[’']/g, ' ')} `
  const spansOf = (name: string) => {
    const normalizedName = normalizeName(name)
    const escaped = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const expression = new RegExp(
      `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
      'gu',
    )
    return [...normalizedText.matchAll(expression)].map(({ index }) => ({
      start: index!,
      end: index! + normalizedName.length,
    }))
  }
  const fullNameSpans = players.flatMap((player) =>
    normalizeName(player.name).split(/\s+/).length > 1
      ? spansOf(player.name).map((span) => ({ playerId: player.id, ...span }))
      : [],
  )
  const coveredByAnotherFullName = (
    span: { start: number; end: number },
    playerId: string,
  ) =>
    fullNameSpans.some(
      (fullName) =>
        fullName.playerId !== playerId &&
        span.start >= fullName.start &&
        span.end <= fullName.end,
    )
  const strongMatches = players.filter((player) => {
    const parts = normalizeName(player.name).split(/\s+/)
    const fullNameMatches = spansOf(player.name)
    if (fullNameMatches.length > 0) return true
    const shortNameMatches = spansOf(parts[parts.length - 1])
    return shortNameMatches.some(
      (span) => !coveredByAnotherFullName(span, player.id),
    )
  })
  const stronglyResolvedFirstNames = new Set(
    strongMatches.map(({ name }) => normalizeName(name).split(/\s+/)[0]),
  )
  const firstNameMatches = players.filter((player) => {
    const firstName = normalizeName(player.name).split(/\s+/)[0]
    const firstNameMatches = spansOf(firstName)
    return (
      !stronglyResolvedFirstNames.has(firstName) &&
      firstNameMatches.some(
        (span) => !coveredByAnotherFullName(span, player.id),
      ) &&
      normalizeName(player.name).split(/\s+/).length > 1
    )
  })
  return [...strongMatches, ...firstNameMatches].map(({ id, name, team }) => ({
    id,
    name,
    team,
  }))
}

function playerComparisonMetric(text: string): ClaimMetric | undefined {
  if (/\b(?:running distance|ran\s+(?:farther|further)|covered\s+more\s+ground)\b/i.test(text)) {
    return 'running-distance'
  }
  if (COMPLETED_PASS_COUNT.test(text)) {
    return 'pass-completions'
  }
  if (/\b(?:pass(?:es)?\s+completion(?:\s+(?:percentage|rate))?|passing\s+accuracy|percentage\s+of\s+(?:(?:their|his|her)\s+)?passes|completion\s+rates?)\b/i.test(text)) {
    return 'pass-completion-percentage'
  }
  if (/\b(?:pass attempts|passes made|passes)\b/i.test(text)) {
    return 'pass-attempts'
  }
  if (/\bshots?\s+on\s+target\b/i.test(text)) return 'shots-on-target'
  if (/\bshots?\b/i.test(text)) return 'shots'
  if (/\bgoals?\b|\bscored\b/i.test(text)) return 'goals'
  if (/\brecover(?:y|ies)\b/i.test(text)) return 'recoveries'
  if (/\bpressures?\b|\bpressure observations?\b/i.test(text)) {
    return 'pressure-observations'
  }
  return undefined
}

function comparisonOperator(text: string): NonNullable<
  InterpretedClaim['meaning']['comparison']
>['operator'] | undefined {
  const operatorText = text.replace(/n['’]t\b/gi, ' not')
  const assertion = /\b(?:higher|greater|more|better|lower|less|fewer|worse|equal|same)\b/i.exec(operatorText)
  if (!assertion) return undefined
  const word = assertion[0].toLowerCase()
  const preceding = operatorText.slice(0, assertion.index + assertion[0].length)
  if (/\bno\s+more\b/i.test(preceding)) return 'less-or-equal'
  if (/\bno\s+(?:less|fewer)\b/i.test(preceding)) return 'greater-or-equal'
  const negated = /\bnot\b(?:\s+\w+){0,3}\s*$/i.test(
    operatorText.slice(0, assertion.index),
  )
  if (word === 'equal' || word === 'same') {
    return negated ? 'not-equal' : 'equal'
  }
  const lower = ['lower', 'less', 'fewer', 'worse'].includes(word)
  if (negated) return lower ? 'greater-or-equal' : 'less-or-equal'
  return lower ? 'less-than' : 'greater-than'
}

function playerMentionPosition(text: string, player: PlayerEntityReference): number {
  const normalizedText = normalizeName(text)
  const names = [player.name, player.name.split(/\s+/).at(-1) ?? player.name]
    .map(normalizeName)
    .sort((left, right) => right.length - left.length)
  const positions = names
    .map((name) => normalizedText.search(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)))
    .filter((position) => position >= 0)
  if (positions.length) return Math.min(...positions)
  const firstName = normalizeName(player.name).split(/\s+/)[0]
  return normalizedText.search(new RegExp(`\\b${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`))
}

function parsePlayerComparison(
  text: string,
  mentions: PlayerEntityReference[],
): ParsedComparisonRequest & {
  subjectPlayer: PlayerEntityReference
  opponentPlayer: PlayerEntityReference
} | undefined {
  if (mentions.length !== 2) {
    return undefined
  }
  if (playerMentionPosition(text, mentions[0]) === playerMentionPosition(text, mentions[1])) {
    return undefined
  }

  const metric = playerComparisonMetric(text)
  const operator = comparisonOperator(text)
  const request = /\b(?:compare|comparison|how\s+do\s+.+\s+compare|what\s+is\s+the\s+difference)\b/i.test(text)
  if (!metric || (!request && !operator)) return undefined
  const thanIndex = text.search(/\bthan\b/i)
  const orderedMentions = [...mentions].sort(
    (left, right) => playerMentionPosition(text, left) - playerMentionPosition(text, right),
  )
  const assertionMentions = thanIndex >= 0
    ? [
        ...mentions.filter((player) => playerMentionPosition(text, player) < thanIndex)
          .sort((left, right) => playerMentionPosition(text, left) - playerMentionPosition(text, right)),
        ...mentions.filter((player) => playerMentionPosition(text, player) > thanIndex)
          .sort((left, right) => playerMentionPosition(text, left) - playerMentionPosition(text, right)),
      ]
    : orderedMentions
  if (!request && (thanIndex < 0 || assertionMentions.length !== 2)) return undefined
  const subjectPlayer = assertionMentions[0]
  const opponentPlayer = assertionMentions[1]
  return {
    subject: subjectPlayer.team,
    opponent: opponentPlayer.team,
    subjectPlayer,
    opponentPlayer,
    metric,
    intent: metric === 'running-distance'
      ? 'unavailable-metric'
      : request
        ? 'statistical-request'
        : 'factual-claim',
    ...(metric !== 'running-distance'
      ? { operator: request ? 'comparison-request' : operator }
      : {}),
  }
}

function namedScorerInText(
  text: string,
  player: PlayerEntityReference,
): boolean {
  const normalized = normalizeName(text)
  const name = normalizeName(player.name)
  const surname = normalizeName(player.name.split(/\s+/).at(-1) ?? player.name)
  const names = [...new Set([name, surname])]
    .sort((left, right) => right.length - left.length)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  return new RegExp(
    `\\b(?:${names})['’]s\\s+goal\\b|\\b(?:${names})\\s+scored\\b|\\b(?:did|does|has|have)\\s+(?:${names})\\s+score\\b`,
  ).test(normalized)
}

function playerMetricRequest(
  text: string,
  hasPlayer: boolean,
): { metric: ClaimMetric; intent: ClaimIntent } | undefined {
  if (!hasPlayer) return undefined
  if (/\b(?:how\s+far|running\s+distance|distance\s+covered|how\s+much\s+ground)\b/i.test(text)) {
    return { metric: 'running-distance', intent: 'unavailable-metric' }
  }
  const request = /\bhow\s+many\s+(shots\s+on\s+target|shots|goals|pass attempts|pass completions|passes|recoveries|pressure observations|pressures)\b/i.exec(text) ??
    /(?:['’]s|\b(?:his|their))\s+(shots\s+on\s+target|shots|goals|pass attempts|pass completions|pass completion|passes|recoveries|pressure observations)\b/i.exec(text)
  const minutesRequest = /\bhow\s+many\s+minutes\b|\bhow\s+long\b/i.test(text)
  if (!request && minutesRequest) {
    return { metric: 'minutes-played', intent: 'statistical-request' }
  }
  if (!request) return undefined
  const phrase = request[1].toLowerCase()
  const metric: ClaimMetric =
    phrase === 'shots on target'
      ? 'shots-on-target'
      : phrase === 'goals'
        ? 'goals'
        : phrase === 'shots'
          ? 'shots'
          : phrase === 'recoveries'
            ? 'recoveries'
            : phrase === 'pressure observations' || phrase === 'pressures'
              ? 'pressure-observations'
              : phrase === 'passes' && /\bcomplete\b/i.test(text)
                ? 'pass-completions'
                : phrase === 'pass attempts' || phrase === 'passes'
                ? 'pass-attempts'
                : phrase === 'pass completion'
                  ? 'pass-completion-percentage'
                  : 'pass-completions'
  return { metric, intent: 'statistical-request' }
}

function parseSingleStatisticRequest(
  text: string,
): ParsedSingleStatisticRequest | undefined {
  const match =
    /^\s*how\s+many\s+(shots\s+on\s+target|shots|goals)\s+(?:did|does|do|has|have)\s+(Northbridge|Eastport)\b/i.exec(
      text,
    )
  if (!match) return undefined
  const subject = TEAMS.find(
    (team) => team.toLowerCase() === match[2].toLowerCase(),
  )
  if (!subject) return undefined
  const metricWord = match[1].toLowerCase().replace(/\s+/g, ' ')
  return {
    subject,
    metric:
      metricWord === 'shots on target'
        ? 'shots-on-target'
        : metricWord === 'goals'
          ? 'goals'
          : 'shots',
  }
}

function isPassCompletionRequest(text: string): boolean {
  return (
    /\b(?:compare|comparison|how\s+do|what\s+is\s+the\s+difference)\b/i.test(text) &&
    /\b(?:pass(?:es)?\s+completion|passing\s+accuracy|completion\s+rates?)\b/i.test(text) &&
    TEAMS.every((team) => new RegExp(`\\b${team}\\b`, 'i').test(text))
  )
}

function orderedTeams(text: string): MatchTeam[] {
  return [...text.matchAll(/\b(Northbridge|Eastport)\b/gi)]
    .map((match) => TEAMS.find((team) => team.toLowerCase() === match[1].toLowerCase()))
    .filter((team): team is MatchTeam => team !== undefined)
}

function parsePassCompletionRequest(text: string): ParsedComparisonRequest | undefined {
  if (!isPassCompletionRequest(text)) return undefined
  const [subject, opponent] = orderedTeams(text)
  if (!subject || !opponent || subject === opponent) return undefined
  return {
    subject,
    opponent,
    metric: 'pass-completion-percentage',
    intent: 'statistical-request',
  }
}

function parseRunningDistanceComparison(
  text: string,
): ParsedComparisonRequest | undefined {
  const teams = orderedTeams(text)
  if (
    teams.length !== 2 ||
    !/\b(?:ran\s+(?:more|less|farther|further)|running\s+distance|covered\s+(?:more|less|greater|further|farther)\s+(?:distance|ground)|distance\s+covered)\b/i.test(text)
  ) {
    return undefined
  }
  return {
    subject: teams[0],
    opponent: teams[1],
    metric: 'running-distance',
    intent: 'unavailable-metric',
  }
}

function meaningCategory(text: string): ClaimMeaningCategory {
  if (
    /\b(?:where|why)\b/i.test(text) &&
    /\b(?:los(?:e|ing)|turnover|build-up)\b/i.test(text)
  ) {
    return 'coaching-question'
  }
  if (/against the run of play/i.test(text)) return 'historical-circumstance'
  if (
    /\bscor(?:e|es|ed)\s+(?:before|by)\s+half[- ]time\b/i.test(text) ||
    /\bscor(?:e|es|ed)\b[^.]*\b(?:in|during)\s+the\s+first\s+half\b/i.test(text)
  ) {
    return 'historical-circumstance'
  }
  if (/\b(?:control(?:led)?|possession|dominat(?:ed|es)?|luck(?:y)?|deserv(?:ed)?|played|perform(?:ed|ance)?|comfortable|better|worse)\b/i.test(text)) {
    return 'performance-judgement'
  }
  if (/\b(?:shot|shots|goal|goals|pass|passes|scored|ran|further|farther|distance)\b/i.test(text)) {
    return 'factual-comparison'
  }
  return 'other'
}

function requiredEvidence(
  text: string,
  metric?: ClaimMetric,
): EvidenceKind[] {
  if (metric === 'possession-percentage') return ['possession']
  if (
    metric === 'pass-attempts' ||
    metric === 'pass-completions' ||
    metric === 'pass-completion-percentage'
  ) {
    return ['passing']
  }
  if (metric === 'running-distance') return ['physical-measurements']
  if (metric === 'minutes-played') return ['lineups']
  if (metric === 'recoveries' || metric === 'pressure-observations') {
    return ['player-events']
  }
  if (metric) return [metric]
  const evidence = new Set<EvidenceKind>()
  if (/\bpossession\b/i.test(text)) evidence.add('possession')
  if (/against the run of play/i.test(text)) {
    evidence.add('possession')
    evidence.add('territorial-control')
    evidence.add('attacking-events')
  }
  if (/\b(?:territory|territorial|pressure|pressing)\b/i.test(text)) {
    evidence.add('territorial-control')
  }
  if (/\bplayer\b/i.test(text)) evidence.add('player-events')
  if (/\b(?:recover(?:y|ies)|recovered)\b/i.test(text)) evidence.add('player-events')
  if (/\b(?:pass(?:es|ing)?|build-up)\b/i.test(text)) evidence.add('passing')
  if (/\b(?:los(?:e|ing)|turnover)\b/i.test(text)) {
    evidence.add('possession-losses')
    evidence.add('passing')
    if (/\bbuild-up\b/i.test(text)) evidence.add('build-up-phase')
  }
  if (/\b(?:shot|shots|shooting)\b/i.test(text)) evidence.add('shots')
  if (
    /\bgoal(?:s)?\b|\bscored\b/i.test(text) &&
    !/against the run of play/i.test(text)
  ) {
    evidence.add('goals')
  }
  if (/\b(?:ran\s+(?:farther|further)|running\s+distance|covered\s+more\s+ground)\b/i.test(text)) {
    evidence.add('physical-measurements')
  }
  if (evidence.size === 0) evidence.add('attacking-events')
  return [...evidence]
}

function findGoalAnchor(
  events: MatchEvent[],
  subject: MatchTeam | null,
  scorerId?: string,
): MatchEvent | undefined {
  return [...events]
    .reverse()
    .find(
      (event) =>
        event.type === 'shot' &&
        event.outcome === 'goal' &&
        (!subject || event.team === subject) &&
        (!scorerId || event.playerId === scorerId),
    )
}

function resolveSubject(
  text: string,
  parsedClaim: ReturnType<typeof interpretClaim>['claims'][number] | undefined,
): MatchTeam | null {
  if (parsedClaim?.kind === 'comparison' || parsedClaim?.kind === 'broad') {
    return parsedClaim.subject
  }

  const mentionedTeams = TEAMS.filter((team) =>
    new RegExp(`\\b${team}\\b`, 'i').test(text),
  )
  return mentionedTeams.length === 1 ? mentionedTeams[0] : null
}

function clarificationQuestion(text: string): string {
  const pronoun = /\b(them|they|their|he|she|him|her|his)\b/i.exec(text)?.[1]
  if (pronoun && /^(?:he|she|him|her|his)$/i.test(pronoun)) {
    return `Which player does “${pronoun.toLowerCase()}” refer to in this claim?`
  }
  if (pronoun) {
    return `Which team does “${pronoun.toLowerCase()}” refer to in this claim?`
  }
  return 'Which team is this claim about?'
}

type GoalReference =
  | { goal: MatchEvent }
  | { goal?: undefined; clarification: string }

function goalLabel(goal: MatchEvent): string {
  return `${goal.team} ${formatMatchClock(goal.clock)}`
}

/**
 * Resolves "before the goal" against goals recorded up to the selected time.
 * A bare "the goal" is accepted only when exactly one goal exists; otherwise the
 * user is asked which goal, rather than silently choosing one.
 */
function resolveReferencedGoal(
  text: string,
  events: MatchEvent[],
): GoalReference | undefined {
  const groups = GOAL_PHRASE.exec(text)?.groups
  if (!groups) return undefined
  const goals = events.filter(
    (event) => event.type === 'shot' && event.outcome === 'goal',
  )
  if (goals.length === 0) {
    return {
      clarification:
        'No goal is recorded at or before the selected match time, so “before the goal” has nothing to anchor to.',
    }
  }
  const which = groups.which?.toLowerCase().replace(/\s+/g, ' ')
  const noun = groups.noun.toLowerCase()
  if (which === 'first' || which === 'opening' || noun === 'opener') {
    return { goal: goals[0] }
  }
  if (which === 'last' || which === 'latest' || which === 'most recent') {
    return { goal: goals[goals.length - 1] }
  }
  if (/^equali[sz]er$/.test(noun)) {
    const score: Record<MatchTeam, number> = { Northbridge: 0, Eastport: 0 }
    const equalisers: MatchEvent[] = []
    for (const goal of goals) {
      const behind = score[goal.team] < score[goal.team === 'Northbridge' ? 'Eastport' : 'Northbridge']
      score[goal.team] += 1
      if (behind && score.Northbridge === score.Eastport) equalisers.push(goal)
    }
    if (equalisers.length === 1) return { goal: equalisers[0] }
    return {
      clarification: equalisers.length === 0
        ? 'No equaliser is recorded at or before the selected match time. Name the goal you mean, for example “before Eastport scored”.'
        : `Which equaliser do you mean: ${equalisers.map(goalLabel).join(' or ')}?`,
    }
  }
  if (goals.length === 1) return { goal: goals[0] }
  return {
    clarification: `Which goal do you mean by “before the goal”: ${goals.map(goalLabel).join(' or ')}? Name the scorer, for example “before Eastport scored”.`,
  }
}

const COUNT_EVIDENCE: Record<'shots' | 'shots-on-target' | 'goals', EvidenceKind> = {
  shots: 'shots',
  'shots-on-target': 'shots-on-target',
  goals: 'goals',
}

function describeAssertion(assertion: CountAssertion): string {
  if (assertion.kind !== 'universal') {
    const who = assertion.player?.name ?? assertion.team
    return `Whether ${who}'s recorded ${assertion.metric.replaceAll('-', ' ')} count is ${assertion.kind === 'none' ? 'zero' : 'greater than zero'} in the claim's evidence window.`
  }
  const quantifier = assertion.quantifier === 'every'
    ? assertion.negated
      ? 'not every'
      : 'every'
    : 'none of'
  return `Whether ${quantifier} one of ${assertion.team}'s recorded shots in the selected period was on target; evaluated against all of that team's recorded shots.`
}

/**
 * Single-team zero/universal count assertions and shot-position wording.
 * Shot records carry no coordinates or zone, so position wording is an explicit
 * unrecorded-data claim rather than a substitute shot count.
 */
function assertionClaimFromText(
  text: string,
  index: number,
  context: InterpretationContext,
  forcedPlayer?: PlayerEntityReference,
): InterpretedClaim | undefined {
  const players = forcedPlayer ? [forcedPlayer] : mentionedPlayers(text, context.players)
  const player = players.length === 1 ? players[0] : null
  const assertion = parseCountAssertion(text, player)
  const base = {
    id: `claim-${index + 1}`,
    playerSubject: null,
    playerMetric: null,
    text,
    timePeriod: { kind: 'selected' as const },
    historicalEventAnchor: null,
  }
  if (assertion) {
    return {
      ...base,
      subject: assertion.team,
      playerSubject: assertion.player ?? null,
      playerMetric: assertion.player && assertion.kind !== 'universal' ? assertion.metric : null,
      intent: 'factual-claim',
      meaning: {
        category: 'other',
        description: describeAssertion(assertion),
        comparison: null,
      },
      requiredEvidence:
        assertion.kind !== 'universal'
          ? [COUNT_EVIDENCE[assertion.metric]]
          : ['shots', 'shots-on-target'],
      clarificationNeeds: [],
    }
  }
  if (!mentionsShotLocation(text)) return undefined
  const teams = TEAMS.filter((team) =>
    new RegExp(`\\b${team}\\b`, 'i').test(text),
  )
  const subject = player?.team ?? (teams.length === 1 ? teams[0] : null)
  return {
    ...base,
    subject,
    playerSubject: player,
    intent: 'unavailable-metric',
    meaning: {
      category: 'other',
      description: 'Where shots were taken from (inside or outside the box) is not a recorded field.',
      comparison: null,
    },
    requiredEvidence: ['shot-location'],
    clarificationNeeds: subject ? [] : ['Which team’s shots do you mean?'],
  }
}

function claimFromText(
  text: string,
  index: number,
  context: InterpretationContext,
  forcedPlayer?: PlayerEntityReference,
): InterpretedClaim {
  const referencedGoal = resolveReferencedGoal(text, context.events)
  const assertionClaim = assertionClaimFromText(
    referencedGoal ? text.replace(GOAL_PHRASE, '').trim() : text,
    index,
    context,
    forcedPlayer,
  )
  if (assertionClaim) {
    return {
      ...assertionClaim,
      text,
      ...(referencedGoal?.goal ? {
        timePeriod: { kind: 'before-event', eventId: referencedGoal.goal.id },
        historicalEventAnchor: {
          eventId: referencedGoal.goal.id,
          relationship: `Goal by ${referencedGoal.goal.team} at ${formatMatchClock(referencedGoal.goal.clock)}`,
        },
      } : referencedGoal ? { clarificationNeeds: [referencedGoal.clarification] } : {}),
    }
  }
  const playerMentions = forcedPlayer
    ? [forcedPlayer]
    : mentionedPlayers(text, context.players)
  const playerComparison = parsePlayerComparison(text, playerMentions)
  const passRequest = parsePassCompletionRequest(text)
  const passAssertion = parsePassCompletionAssertion(text)
  const runningDistance = parseRunningDistanceComparison(text)
  const singleStatistic = parseSingleStatisticRequest(text)
  const completedPasses = playerComparison ? undefined : parseCompletedPassCount(text)
  const metricComparison = passRequest ?? passAssertion ?? completedPasses ?? runningDistance
  const parsedClaim = metricComparison || singleStatistic
    ? undefined
    : interpretClaim(text.replace(GOAL_PHRASE, '')).claims[0]
  const playerSubject = playerComparison?.subjectPlayer ??
    (playerMentions.length === 1 ? playerMentions[0] : null)
  const requestedPlayerMetric = playerComparison
    ? undefined
    : playerMetricRequest(text, playerSubject !== null || playerMentions.length > 1)
  const subject =
    playerSubject?.team ??
    metricComparison?.subject ??
    singleStatistic?.subject ??
    resolveSubject(text, parsedClaim)
  let comparison: InterpretedClaim['meaning']['comparison'] = null
  let category = playerComparison
    ? playerComparison.intent === 'unavailable-metric'
      ? 'other'
      : 'factual-comparison'
    : requestedPlayerMetric
      ? 'other'
    : singleStatistic
      ? 'other'
      : meaningCategory(text)
  let intent: ClaimIntent =
    playerComparison
      ? playerComparison.intent
      : requestedPlayerMetric
        ? requestedPlayerMetric.intent
      : singleStatistic
      ? 'statistical-request'
      : category === 'coaching-question'
      ? 'coaching-question'
      : category === 'performance-judgement'
        ? 'subjective-judgement'
        : category === 'historical-circumstance'
          ? 'factual-claim'
          : category === 'other'
            ? 'unrecognized-language'
            : 'factual-claim'
  let description = text
  let metric: ClaimMetric | undefined = requestedPlayerMetric?.metric
  if (playerComparison && playerComparison.intent === 'unavailable-metric') {
    metric = playerComparison.metric
    description = `Running distance for ${playerComparison.subjectPlayer.name} and ${playerComparison.opponentPlayer.name} is not recorded in this fixture; no distance comparison can be made.`
  } else if (playerComparison) {
    metric = playerComparison.metric
    comparison = {
      opponent: playerComparison.opponentPlayer.team,
      opponentPlayer: playerComparison.opponentPlayer,
      metric,
      operator: playerComparison.operator!,
    }
    const relation = {
      'greater-than': 'is greater than',
      'less-than': 'is less than',
      equal: 'equals',
      'greater-or-equal': 'is greater than or equal to',
      'less-or-equal': 'is less than or equal to',
      'not-equal': 'differs from',
      'comparison-request': 'is compared with',
    }[playerComparison.operator!]
    description = playerComparison.intent === 'statistical-request'
      ? `Compare ${playerComparison.subjectPlayer.name} and ${playerComparison.opponentPlayer.name} on recorded ${metric.replaceAll('-', ' ')} in the selected period.`
      : `Whether ${playerComparison.subjectPlayer.name}'s recorded ${metric.replaceAll('-', ' ')} value ${relation} ${playerComparison.opponentPlayer.name}'s.`
  } else if (requestedPlayerMetric) {
    const requestedPlayer = playerSubject?.name ?? 'the named player'
    description = requestedPlayerMetric.metric === 'running-distance'
      ? `Running distance for ${requestedPlayer} is not recorded in this fixture.`
      : `Report ${requestedPlayerMetric.metric.replaceAll('-', ' ')} for ${requestedPlayer} from selected synthetic records.`
  } else if (metricComparison) {
    metric = metricComparison.metric
    comparison = {
      opponent: metricComparison.opponent,
      opponentPlayer: null,
      metric,
      operator:
        passRequest
          ? 'comparison-request'
          : metricComparison.operator ?? 'greater-than',
    }
    category = 'factual-comparison'
    intent = metricComparison.intent
    description = passRequest
      ? 'Compare both teams’ recorded pass attempts, completions, and completion percentages in the selected period.'
      : completedPasses
        ? `${completedPasses.subject}'s recorded completed passes (a count, not attempts or completion percentage) compared with ${completedPasses.opponent}'s: ${completedPasses.operator}.`
      : passAssertion
        ? `${metricComparison.subject}'s recorded pass completion percentage is ${passAssertion.operator === 'less-than' ? 'lower' : 'higher'} than ${metricComparison.opponent}'s.`
        : `${metricComparison.subject} ran farther than ${metricComparison.opponent}; compare running distance.`
  } else if (singleStatistic) {
    metric = singleStatistic.metric
    description = `Report ${metric.replaceAll('-', ' ')} for ${singleStatistic.subject} in the selected period.`
  } else if (parsedClaim?.kind === 'comparison' && subject) {
    metric = parsedClaim.metric
    comparison = {
      opponent: parsedClaim.opponent,
      opponentPlayer: null,
      metric,
      operator: parsedClaim.comparison,
    }
    category = 'factual-comparison'
    intent = 'factual-claim'
    description = parsedClaim.summary
  }

  const topic =
    !comparison &&
    !playerComparison &&
    !singleStatistic &&
    !metricComparison &&
    !requestedPlayerMetric &&
    parsedClaim?.kind !== 'comparison' &&
    category !== 'coaching-question' &&
    category !== 'historical-circumstance'
      ? classifyOpinion(text)
      : undefined
  if (topic && topic.topic === 'physical-condition') {
    category = 'other'
    intent = 'unavailable-metric'
    description = `${playerSubject?.name ?? subject ?? 'The side'}'s physical condition (fitness, injury, exertion) is not recorded in this fixture.`
  } else if (topic && topic.topic !== 'prediction') {
    category = 'performance-judgement'
    intent = 'subjective-judgement'
    description = text
  } else if (topic) {
    category = 'other'
    intent = 'unrecognized-language'
    description = 'A prediction about what happens next cannot be checked against recorded events.'
  }

  if (
    !comparison &&
    !singleStatistic &&
    !metricComparison &&
    !requestedPlayerMetric &&
    category === 'factual-comparison'
  ) {
    category = 'other'
    intent = 'unrecognized-language'
    description = 'The local interpreter cannot reliably identify this football statistic or comparison.'
  }

  if (forcedPlayer) {
    description = `${description} (assessed separately for ${forcedPlayer.name}, ${forcedPlayer.team})`.slice(0, 300)
  }
  const categoryForText = category
  const namedScorer = /against the run of play/i.test(text) && playerSubject
    ? playerSubject
    : playerMentions.find((player) => namedScorerInText(text, player))
  const beforeGoalTeam = TEAMS.find((team) =>
    new RegExp(`\\bbefore\\s+${team}\\s+scored\\b`, 'i').test(text),
  )
  const hasHistoricalGoalScope =
    /against the run of play/i.test(text) ||
    /\bbefore\s+(?:Northbridge|Eastport)\s+scored\b/i.test(text) ||
    /\bbefore\s+(?:[\p{L}][\p{L}'’.-]*\s+){0,2}scored\b/iu.test(text)
  const anchorTeam = namedScorer?.team ?? beforeGoalTeam ?? subject
  const goalReference = referencedGoal
    ? referencedGoal.goal
    : hasHistoricalGoalScope
    ? findGoalAnchor(
        context.events,
        anchorTeam,
        namedScorer?.id,
      )
    : undefined
  if (/against the run of play/i.test(text)) {
    intent = 'factual-claim'
    category = 'historical-circumstance'
    description = namedScorer
      ? goalReference
        ? `Whether ${namedScorer.name}'s goal at ${formatMatchClock(goalReference.clock)} came against the run of play. Evidence is restricted to recorded match play strictly before that goal.`
        : `No goal by ${namedScorer.name} is recorded at or before the selected match time.`
      : `Whether ${anchorTeam ?? 'the scoring team'}'s goal at ${goalReference ? formatMatchClock(goalReference.clock) : 'the selected match time'} came against the run of play. Evidence is restricted to recorded match play strictly before that goal.`
  }
  const clarificationNeeds: string[] = []
  const comparisonPrompt =
    /\b(?:compare|comparison|than|versus|vs\.?)\b/i.test(text)
  const namedTeams = TEAMS.filter((team) => new RegExp(`\\b${team}\\b`, 'i').test(text))
  if (
    !comparison &&
    /\b(?:than|versus|vs\.?|compared\s+(?:with|to))\b/i.test(text) &&
    /\b(?:shots?|goals?|possession|passes|passing|completion|accuracy|recoveries|distance|minutes)\b/i.test(text) &&
    namedTeams.length < 2 &&
    playerMentions.length < 2
  ) {
    clarificationNeeds.push(
      'I cannot resolve both sides of this comparison. Which two teams or players from this fixture do you mean?',
    )
  }
  if (
    playerMentions.length > 1 &&
    !playerComparison &&
    !comparisonPrompt
  ) {
    clarificationNeeds.push(
      `Which player do you mean: ${playerMentions.map(({ name, team }) => `${name} (${team})`).join(' or ')}?`,
    )
  }
  if (
    playerMentions.length === 2 &&
    !playerComparison &&
    comparisonPrompt
  ) {
    clarificationNeeds.push(
      'I can identify both players, but cannot reliably determine which recorded metric this comparison requests.',
    )
  }
  if (!subject && category !== 'coaching-question' && playerMentions.length < 2) {
    clarificationNeeds.push(clarificationQuestion(text))
  }
  if (referencedGoal?.goal) {
    description = `${description} Counts recorded play strictly before the ${goalLabel(referencedGoal.goal)} goal, which is excluded.`
  } else if (referencedGoal) {
    clarificationNeeds.push(referencedGoal.clarification)
  }
  if (hasHistoricalGoalScope && !goalReference) {
    clarificationNeeds.push(
      namedScorer
        ? `No goal by ${namedScorer.name} is recorded at or before the selected match time to anchor this claim.`
        : 'No matching goal is recorded at or before the selected match time to anchor this historical claim.',
    )
  }
  if (
    /\blast\s+(?:10|ten)\s+minutes?\b/i.test(text) &&
    context.period !== 'last-10-minutes'
  ) {
    clarificationNeeds.push(
      'This question requests the last 10 minutes, but the selected evidence period is Match so far. Choose “Last 10 minutes” or rephrase the question.',
    )
  }
  if (
    /\bmatch\s+so\s+far\b/i.test(text) &&
    context.period !== 'match-so-far'
  ) {
    clarificationNeeds.push(
      'This question requests the match so far, but the selected evidence period is Last 10 minutes. Choose “Match so far” or rephrase the question.',
    )
  }

  const timePeriod: InterpretedClaim['timePeriod'] = goalReference
    ? { kind: 'before-event', eventId: goalReference.id }
    : { kind: 'selected' }

  return {
    id: `claim-${index + 1}`,
    subject,
    playerSubject,
    playerMetric: playerComparison
      ? null
      : requestedPlayerMetric?.metric ?? null,
    text,
    intent,
    meaning: {
      category: categoryForText,
      description,
      comparison,
    },
    requiredEvidence: topic && topic.topic !== 'prediction'
      ? evidenceForTopic(topic.topic, playerSubject !== null)
      : topic
        ? ['attacking-events']
      : requestedPlayerMetric
      ? requiredEvidence(text, requestedPlayerMetric.metric)
      : playerSubject &&
        /\b(?:how\s+did|how\s+has|performance|perform(?:ed)?)\b/i.test(text)
      ? ['player-events', 'passing', 'shots', 'goals']
      : playerSubject && metric
        ? requiredEvidence(text, metric)
        : playerMentions.length > 1 && !playerComparison
          ? []
          : requiredEvidence(text, metric),
    timePeriod,
    historicalEventAnchor: goalReference
      ? {
          eventId: goalReference.id,
          relationship: `Goal by ${goalReference.team} at ${formatMatchClock(goalReference.clock)}`,
        }
      : null,
    clarificationNeeds,
  }
}

export class LocalInterpretationProvider implements InterpretationProvider {
  readonly name = 'local' as const

  async interpret(
    opinion: string,
    context: InterpretationContext,
  ): Promise<unknown> {
    const locallyInterpretableOpinion = canonicalizeSupportedFootballOpinion(opinion)
    const claims = splitOpinion(locallyInterpretableOpinion).flatMap((text) => {
      const mentions = mentionedPlayers(text, context.players)
      const sharedJudgement =
        mentions.length >= 2 &&
        mentions.length <= 4 &&
        new Set(mentions.map((player) => playerMentionPosition(text, player))).size === mentions.length &&
        !/\b(?:compare|comparison|than|versus|vs\.?)\b/i.test(text) &&
        !parseCountAssertion(text) &&
        !mentionsShotLocation(text) &&
        classifyOpinion(text) !== undefined
      // One judgement about several named players is assessed separately for each.
      return sharedJudgement
        ? [...mentions]
            .sort((a, b) => playerMentionPosition(text, a) - playerMentionPosition(text, b))
            .map((player) => claimFromText(text, 0, context, player))
        : [claimFromText(text, 0, context)]
    })
    return {
      claims: claims.map((claim, index) => ({
        ...claim,
        id: `claim-${index + 1}`,
      })),
    }
  }
}
