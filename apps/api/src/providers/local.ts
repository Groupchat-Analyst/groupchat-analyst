import {
  formatMatchClock,
  TEAMS,
  type MatchEvent,
  type MatchTeam,
} from '../../../shared/src/match.js'
import type {
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
    .split(
      /\s*,\s*(?=(?:Northbridge|Eastport)\b)|\s+(?:and|but|however)\s+(?=(?:Northbridge|Eastport)\b)|[;\n]+|(?<=[.!?])\s+/i,
    )
    .map((part) => part.trim().replace(/^[, ]+|[.!?]+$/g, ''))
    .filter(Boolean)
}

function meaningCategory(text: string): ClaimMeaningCategory {
  if (/against the run of play/i.test(text)) return 'historical-circumstance'
  if (/\b(?:control(?:led)?|possession|dominat(?:ed|es)?|luck(?:y)?|deserv(?:ed)?|played)\b/i.test(text)) {
    return 'performance-judgement'
  }
  return 'other'
}

function requiredEvidence(
  text: string,
  metric?: ClaimMetric,
): EvidenceKind[] {
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
  if (/\b(?:shot|shots|shooting)\b/i.test(text)) evidence.add('shots')
  if (
    /\bgoal(?:s)?\b|\bscored\b/i.test(text) &&
    !/against the run of play/i.test(text)
  ) {
    evidence.add('goals')
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
  const parsedClaim = interpretClaim(text).claims[0]
  const subject = resolveSubject(text, parsedClaim)
  let comparison: InterpretedClaim['meaning']['comparison'] = null
  let category = meaningCategory(text)
  let description = text
  let metric: ClaimMetric | undefined
  if (parsedClaim?.kind === 'comparison' && subject) {
    metric = parsedClaim.metric
    comparison = {
      opponent: parsedClaim.opponent,
      metric,
      operator: parsedClaim.comparison,
    }
    category = 'factual-comparison'
    description = parsedClaim.summary
  }

  const categoryForText = category
  const goalReference = /against the run of play/i.test(text)
    ? subject
      ? findGoalAnchor(context.events, subject)
      : undefined
    : undefined
  if (/against the run of play/i.test(text)) {
    description = `Whether ${subject ?? 'the scoring team'}'s goal at ${goalReference ? formatMatchClock(goalReference.clock) : 'the selected match time'} came against the run of play.`
  }
  const clarificationNeeds: string[] = []
  if (!subject) {
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
