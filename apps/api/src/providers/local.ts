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
import { interpretClaim } from '../../../shared/src/interpretClaim.js'
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
    .map((part) => part.trim().replace(/^[, ]+|[.!?]+$/g, ''))
    .filter(Boolean)
}

type ParsedComparisonRequest = {
  subject: MatchTeam
  opponent: MatchTeam
  metric: ClaimMetric
  intent: ClaimIntent
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
    !/\b(?:ran\s+(?:farther|further)|running\s+distance|covered\s+more\s+ground)\b/i.test(text)
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
  if (/\bwhere\b/i.test(text) && /\b(?:los(?:e|ing)|turnover|build-up)\b/i.test(text)) {
    return 'coaching-question'
  }
  if (/against the run of play/i.test(text)) return 'historical-circumstance'
  if (/\b(?:control(?:led)?|possession|dominat(?:ed|es)?|luck(?:y)?|deserv(?:ed)?|played|comfortable|better|worse)\b/i.test(text)) {
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
): MatchEvent | undefined {
  return [...events]
    .reverse()
    .find(
      (event) =>
        event.type === 'shot' &&
        event.outcome === 'goal' &&
        (!subject || event.team === subject),
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
  const pronoun = /\b(them|they|their|he|she|him|her)\b/i.exec(text)?.[1]
  if (pronoun) {
    return `Which team does “${pronoun.toLowerCase()}” refer to in this claim?`
  }
  return 'Which team is this claim about?'
}

function claimFromText(
  text: string,
  index: number,
  context: InterpretationContext,
): InterpretedClaim {
  const passRequest = parsePassCompletionRequest(text)
  const runningDistance = parseRunningDistanceComparison(text)
  const metricComparison = passRequest ?? runningDistance
  const parsedClaim = passRequest || runningDistance
    ? undefined
    : interpretClaim(text).claims[0]
  const subject = metricComparison?.subject ?? resolveSubject(text, parsedClaim)
  let comparison: InterpretedClaim['meaning']['comparison'] = null
  let category = meaningCategory(text)
  let intent: ClaimIntent =
    category === 'coaching-question'
      ? 'coaching-question'
      : category === 'performance-judgement'
        ? 'subjective-judgement'
        : category === 'historical-circumstance'
          ? 'factual-claim'
          : category === 'other'
            ? 'unrecognized-language'
            : 'factual-claim'
  let description = text
  let metric: ClaimMetric | undefined
  if (metricComparison) {
    metric = metricComparison.metric
    comparison = {
      opponent: metricComparison.opponent,
      metric,
      operator: passRequest ? 'comparison-request' : 'greater-than',
    }
    category = 'factual-comparison'
    intent = metricComparison.intent
    description = passRequest
      ? 'Compare both teams’ recorded pass attempts, completions, and completion percentages in the selected period.'
      : `${metricComparison.subject} ran farther than ${metricComparison.opponent}; compare running distance.`
  } else if (parsedClaim?.kind === 'comparison' && subject) {
    metric = parsedClaim.metric
    comparison = {
      opponent: parsedClaim.opponent,
      metric,
      operator: parsedClaim.comparison,
    }
    category = 'factual-comparison'
    intent = 'factual-claim'
    description = parsedClaim.summary
  }

  const categoryForText = category
  const goalReference = /against the run of play/i.test(text)
    ? subject
      ? findGoalAnchor(context.events, subject)
      : undefined
    : undefined
  if (/against the run of play/i.test(text)) {
    intent = 'factual-claim'
    description = `Whether ${subject ?? 'the scoring team'}'s goal at ${goalReference ? formatMatchClock(goalReference.clock) : 'the selected match time'} came against the run of play. Evidence is restricted to recorded match play strictly before that goal.`
  }
  const clarificationNeeds: string[] = []
  if (!subject && category !== 'coaching-question') {
    clarificationNeeds.push(clarificationQuestion(text))
  }
  if (/against the run of play/i.test(text) && !goalReference) {
    clarificationNeeds.push(
      'No matching goal is recorded at or before the selected match time to anchor this historical claim.',
    )
  }

  const timePeriod: InterpretedClaim['timePeriod'] = goalReference
    ? { kind: 'before-event', eventId: goalReference.id }
    : { kind: 'selected' }

  return {
    id: `claim-${index + 1}`,
    subject,
    text,
    intent,
    meaning: {
      category: categoryForText,
      description,
      comparison,
    },
    requiredEvidence: requiredEvidence(text, metric),
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
    return {
      claims: splitOpinion(opinion).map((text, index) =>
        claimFromText(text, index, context),
      ),
    }
  }
}
