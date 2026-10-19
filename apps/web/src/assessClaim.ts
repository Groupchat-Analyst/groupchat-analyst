import {
  formatMatchClock,
  type AnalysisPeriod,
  type MatchAnalysis,
  type MatchEvent,
  type MatchTeam,
} from './match.ts'
import type {
  ClaimComparison,
  ClaimMetric,
  BroadClaim,
  ComparisonClaim,
  ClarificationClaim,
  InterpretedClaim,
} from './interpretClaim.ts'

export type ClaimAssessmentStatus =
  | 'supported'
  | 'contradicted'
  | 'mixed'
  | 'insufficient evidence for a firm conclusion'

export type EventReference = {
  id: string
  time: string
  team: MatchTeam
  description: string
}

type AssessmentBase = {
  periodLabel: string
}

export type ComparisonAssessment = AssessmentBase & {
  kind: 'assessed'
  claim: ComparisonClaim
  status: ClaimAssessmentStatus
  subjectValue: number
  opponentValue: number
  metricLabel: string
  supportingEvidence: EventReference[]
  counterEvidence: EventReference[]
  allReferences: EventReference[]
  limitation: string
}

export type BroadAssessment = AssessmentBase & {
  kind: 'partial'
  claim: BroadClaim
  status: 'insufficient evidence for a firm conclusion'
  subjectStats: Record<Exclude<ClaimMetric, 'possession-percentage'>, number>
  otherTeamStats: Record<Exclude<ClaimMetric, 'possession-percentage'>, number>
  subjectEvidence: EventReference[]
  otherTeamEvidence: EventReference[]
  limitation: string
}

export type ClarificationAssessment = AssessmentBase & {
  kind: 'clarification'
  claim: ClarificationClaim
  message: string
  limitation: string
}

export type ClaimAssessment =
  | ComparisonAssessment
  | BroadAssessment
  | ClarificationAssessment

const METRIC_LABELS: Record<ClaimMetric, string> = {
  shots: 'shots',
  'shots-on-target': 'shots on target',
  goals: 'goals',
  'possession-percentage': 'possession',
}

function periodName(period: AnalysisPeriod, selectedTime: string): string {
  return period === 'match-so-far'
    ? `Match so far through ${selectedTime}`
    : `Last 10 minutes ending ${selectedTime}`
}

export function assessClaim(
  interpretation: { claims: InterpretedClaim[] },
  analysis: MatchAnalysis,
  period: AnalysisPeriod,
  selectedTime: string,
): ClaimAssessment[] {
  return interpretation.claims.map((claim) =>
    assessPart(claim, analysis, periodName(period, selectedTime)),
  )
}

function assessPart(
  claim: InterpretedClaim,
  analysis: MatchAnalysis,
  periodLabel: string,
): ClaimAssessment {
  if (claim.kind === 'clarification') {
    return {
      kind: 'clarification',
      claim,
      periodLabel,
      message: claim.message,
      limitation:
        'The local prototype cannot safely resolve this claim without more detail.',
    }
  }

  if (claim.kind === 'broad') {
    const allShots = analysis.periodEvents.filter(
      (event): event is Extract<MatchEvent, { type: 'shot' }> =>
        event.type === 'shot',
    )
    const otherTeam: MatchTeam =
      claim.subject === 'Northbridge' ? 'Eastport' : 'Northbridge'
    const subjectEvidence = allShots
      .filter((event) => event.team === claim.subject)
      .map(toReference)
    const otherTeamEvidence = allShots
      .filter((event) => event.team === otherTeam)
      .map(toReference)

    return {
      kind: 'partial',
      claim,
      periodLabel,
      status: 'insufficient evidence for a firm conclusion',
      subjectStats: metricStats(analysis, claim.subject),
      otherTeamStats: metricStats(analysis, otherTeam),
      subjectEvidence,
      otherTeamEvidence,
      limitation:
        'The claim is broader than a count of shots, shots on target, or goals. These are relevant match context, not proof that a team dominated, was lucky, deserved a result, or played well or badly. No criteria for judging that opinion were provided.',
    }
  }

  const { subject, opponent, metric, comparison } = claim
  const subjectValue = getMetricValue(metric, subject, analysis)
  const opponentValue = getMetricValue(metric, opponent, analysis)
  const allReferences = analysis.periodEvents
    .filter((event) => isRelevantEvent(event, metric))
    .map(toReference)

  if (allReferences.length === 0) {
    return {
      kind: 'assessed',
      claim,
      periodLabel,
      status: 'insufficient evidence for a firm conclusion',
      subjectValue,
      opponentValue,
      metricLabel: METRIC_LABELS[metric],
      supportingEvidence: [],
      counterEvidence: [],
      allReferences,
      limitation:
        'No recorded events of this type appear in the selected period, so there is no event evidence to assess the comparison.',
    }
  }

  const isSupported = compareValues(subjectValue, opponentValue, comparison)
  const supportingTeam = isSupported
    ? getSupportingTeam(comparison, subject, opponent)
    : null
  const supportingEvidence = isSupported
    ? supportingTeam
      ? allReferences.filter((reference) => reference.team === supportingTeam)
      : allReferences
    : []
  const counterEvidence = isSupported
    ? supportingTeam
      ? allReferences.filter((reference) => reference.team !== supportingTeam)
      : []
    : allReferences

  return {
    kind: 'assessed',
    claim,
    periodLabel,
    status: isSupported ? 'supported' : 'contradicted',
    subjectValue,
    opponentValue,
    metricLabel: METRIC_LABELS[metric],
    supportingEvidence,
    counterEvidence,
    allReferences,
    limitation:
      'This is a comparison of recorded events in a fictional match. It does not measure chance quality, overall performance, or real-match facts.',
  }
}

function metricStats(
  analysis: MatchAnalysis,
  team: MatchTeam,
): Record<Exclude<ClaimMetric, 'possession-percentage'>, number> {
  return {
    shots: analysis.shots[team].shots,
    'shots-on-target': analysis.shots[team].shotsOnTarget,
    goals: analysis.periodEvents.filter(
      (event) =>
        event.type === 'shot' && event.team === team && event.outcome === 'goal',
    ).length,
  }
}

function getMetricValue(
  metric: ClaimMetric,
  team: MatchTeam,
  analysis: MatchAnalysis,
): number {
  if (metric === 'possession-percentage') return Number.NaN
  if (metric === 'shots') return analysis.shots[team].shots
  if (metric === 'shots-on-target') return analysis.shots[team].shotsOnTarget
  return metricStats(analysis, team).goals
}

function isRelevantEvent(event: MatchEvent, metric: ClaimMetric): boolean {
  if (event.type !== 'shot') return false
  if (metric === 'possession-percentage') return false
  if (metric === 'shots') return true
  if (metric === 'goals') return event.outcome === 'goal'
  return event.outcome === 'goal' || event.outcome === 'saved'
}

function toReference(event: MatchEvent): EventReference {
  return {
    id: event.id,
    time: formatMatchClock(event.clock),
    team: event.team,
    description: event.description,
  }
}

function getSupportingTeam(
  comparison: ClaimComparison,
  subject: MatchTeam,
  opponent: MatchTeam,
): MatchTeam | null {
  if (comparison === 'greater-than') return subject
  if (comparison === 'less-than') return opponent
  return null
}

function compareValues(
  subject: number,
  opponent: number,
  comparison: ClaimComparison,
): boolean {
  switch (comparison) {
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

export function describePeriod(
  period: AnalysisPeriod,
  selectedTime: string,
): string {
  return periodName(period, selectedTime)
}
