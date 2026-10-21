import { TEAMS, type MatchTeam } from './match.ts'

export type ClaimMetric =
  | 'shots'
  | 'shots-on-target'
  | 'goals'
  | 'possession-percentage'
export type ClaimComparison =
  | 'greater-than'
  | 'less-than'
  | 'equal'
  | 'greater-or-equal'
  | 'less-or-equal'
  | 'not-equal'

export type ComparisonClaim = {
  kind: 'comparison'
  text: string
  subject: MatchTeam
  opponent: MatchTeam
  metric: ClaimMetric
  comparison: ClaimComparison
  summary: string
}

export type BroadClaim = {
  kind: 'broad'
  text: string
  subject: MatchTeam
}

export type ClarificationClaim = {
  kind: 'clarification'
  text: string
  message: string
}

export type InterpretedClaim = ComparisonClaim | BroadClaim | ClarificationClaim

export type ClaimInterpretation = {
  kind: 'claims'
  claims: InterpretedClaim[]
}

const teamPattern = TEAMS.map((team) => team.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .sort((first, second) => second.length - first.length)
  .join('|')

const comparisonPattern = new RegExp(
  `^(?<subject>${teamPattern})\\s+(?:(?<negation>did not|didn't)\\s+(?<negatedVerb>have|record|recorded|take|took|make|made|score|scored)\\s+(?<negatedOperator>more|fewer|less)\\s+(?<negatedMetric>shots on target|shots|goals|possession)\\s+than\\s+|(?<verb>had|have|has|recorded|took|made|scored)\\s+(?<operator>more|fewer|less|no more|no fewer|the same number of|same number of|as many)\\s+(?<metric>shots on target|shots|goals|possession)\\s+(?:than|as)\\s+)(?<opponent>${teamPattern})[.!?]*$`,
  'i',
)

const separators =
  /\s+(?:and|but|however)\s+|,\s*(?=(?:Northbridge|Eastport)\b)|[;\n]+|(?<=[.!?])\s+/i
const pronounAtStart = /^(?:they|them|their|it|this|that|he|she|we|you)\b/i

function teamFromMatch(value: string): MatchTeam | undefined {
  return TEAMS.find((team) => team.toLowerCase() === value.toLowerCase())
}

function findLeadingTeam(text: string): MatchTeam | undefined {
  return TEAMS.find((team) =>
    new RegExp(`^${team}\\b`, 'i').test(text),
  )
}

function parseComparison(
  text: string,
): ComparisonClaim | ClarificationClaim | undefined {
  const parsed = comparisonPattern.exec(text)
  if (!parsed?.groups) return undefined

  const {
    subject: matchedSubject,
    opponent: matchedOpponent,
    negation,
    negatedVerb,
    negatedOperator,
    negatedMetric,
    verb,
    operator,
    metric,
  } = parsed.groups
  const subject = teamFromMatch(matchedSubject)
  const opponent = teamFromMatch(matchedOpponent)
  if (!subject || !opponent) return undefined
  if (subject === opponent) {
    return {
      kind: 'clarification',
      text,
      message:
        'Please compare Northbridge with Eastport rather than comparing a team with itself.',
    }
  }

  const comparisonWord = negatedOperator ?? operator
  const metricWord = negatedMetric ?? metric
  const normalizedMetric = metricWord.toLowerCase()
  const goalClaim = normalizedMetric === 'goals'
  const claimVerb = negatedOperator ? negatedVerb : verb
  const normalizedVerb = claimVerb.toLowerCase()
  const usesGoalVerb = /^(?:score|scored)$/.test(normalizedVerb)
  const usesCountVerb = /^(?:have|has|had)$/.test(normalizedVerb)
  if (usesGoalVerb && !goalClaim) return undefined
  if (goalClaim && !usesGoalVerb && !usesCountVerb) return undefined
  if (!goalClaim && !usesCountVerb && normalizedMetric === 'possession') return undefined

  const comparison = getComparison(comparisonWord, Boolean(negation))
  const claimMetric: ClaimMetric =
    normalizedMetric === 'goals'
      ? 'goals'
      : normalizedMetric === 'shots on target'
        ? 'shots-on-target'
        : normalizedMetric === 'possession'
          ? 'possession-percentage'
          : 'shots'
  const metricLabel =
    claimMetric === 'shots-on-target'
      ? 'shots on target'
      : claimMetric === 'possession-percentage'
        ? 'possession'
        : claimMetric
  const comparisonText: Record<ClaimComparison, string> = {
    'greater-than': `more ${metricLabel} than ${opponent}`,
    'less-than': `fewer ${metricLabel} than ${opponent}`,
    equal: `the same number of ${metricLabel} as ${opponent}`,
    'greater-or-equal': `at least as many ${metricLabel} as ${opponent}`,
    'less-or-equal': `no more ${metricLabel} than ${opponent}`,
    'not-equal': `a different number of ${metricLabel} than ${opponent}`,
  }
  const subjectVerb = claimMetric === 'goals' ? 'scored' : 'had'

  return {
    kind: 'comparison',
    text,
    subject,
    opponent,
    metric: claimMetric,
    comparison,
    summary: `${subject} ${subjectVerb} ${comparisonText[comparison]}.`,
  }
}

function interpretPart(text: string): InterpretedClaim {
  const comparison = parseComparison(text)
  if (comparison) return comparison

  if (pronounAtStart.test(text)) {
    return {
      kind: 'clarification',
      text,
      message:
        'Please identify which team you mean. I cannot reliably resolve pronouns across separate claims.',
    }
  }

  const subject = findLeadingTeam(text)
  if (!subject) {
    return {
      kind: 'clarification',
      text,
      message:
        'Please identify the team this claim is about. This local prototype cannot reliably infer an unstated team or player.',
    }
  }

  return { kind: 'broad', text, subject }
}

export function interpretClaim(input: string): ClaimInterpretation {
  const claims = input
    .trim()
    .split(separators)
    .map((text) => text.trim().replace(/^[, ]+|[.!?]+$/g, ''))
    .filter(Boolean)
    .map(interpretPart)

  return { kind: 'claims', claims }
}

function getComparison(operator: string, negated: boolean): ClaimComparison {
  const normalized = operator.toLowerCase()
  if (
    normalized === 'the same number of' ||
    normalized === 'same number of' ||
    normalized === 'as many'
  ) {
    return 'equal'
  }
  if (normalized === 'no more') return 'less-or-equal'
  if (normalized === 'no fewer') return 'greater-or-equal'
  if (normalized === 'fewer' || normalized === 'less') {
    return negated ? 'greater-or-equal' : 'less-than'
  }
  return negated ? 'less-or-equal' : 'greater-than'
}
