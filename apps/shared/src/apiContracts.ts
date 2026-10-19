import type { AnalysisPeriod, MatchClock, MatchTeam } from './match.js'

export type EvidenceKind =
  | 'possession'
  | 'territorial-control'
  | 'shots'
  | 'shots-on-target'
  | 'goals'
  | 'attacking-events'
  | 'player-events'
  | 'passing'

export type ClaimMeaningCategory =
  | 'factual-comparison'
  | 'performance-judgement'
  | 'historical-circumstance'
  | 'other'

export type ClaimMetric = 'shots' | 'shots-on-target' | 'goals'
export type ClaimOperator =
  | 'greater-than'
  | 'less-than'
  | 'equal'
  | 'greater-or-equal'
  | 'less-or-equal'
  | 'not-equal'

export type InterpretedClaim = {
  id: string
  subject: MatchTeam | null
  text: string
  meaning: {
    category: ClaimMeaningCategory
    description: string
    comparison: {
      opponent: MatchTeam
      metric: ClaimMetric
      operator: ClaimOperator
    } | null
  }
  requiredEvidence: EvidenceKind[]
  timePeriod:
    | { kind: 'selected' }
    | { kind: 'before-event'; eventId: string }
  historicalEventAnchor: { eventId: string; relationship: string } | null
  clarificationNeeds: string[]
}

export type AnalysisRequest = {
  opinion: string
  selectedClock: MatchClock
  period: AnalysisPeriod
}

export type EvidenceReference = {
  id: string
  time: string
  team: MatchTeam
  description: string
}

export type EvidenceAvailability = {
  kind: EvidenceKind
  available: boolean
  detail: string
}

export type TeamStatistic = {
  team: MatchTeam
  metric: ClaimMetric
  value: number
}

export type ClaimEvidence = {
  role: 'supporting' | 'challenging' | 'context' | 'anchor'
  reference: EvidenceReference
}

export type ClaimResult = {
  claim: InterpretedClaim
  assessment:
    | 'supported'
    | 'contradicted'
    | 'insufficient evidence for a firm conclusion'
    | 'clarification needed'
  periodLabel: string
  statistics: TeamStatistic[]
  evidenceAvailability: EvidenceAvailability[]
  evidence: ClaimEvidence[]
  limitation: string
}

export type AnalysisResponse = {
  provider: 'local' | 'foundry'
  providerLabel: string
  summary: string
  selectedTime: string
  selectedPeriodLabel: string
  score: Record<MatchTeam, number>
  periodStatistics: Record<
    MatchTeam,
    { shots: number; shotsOnTarget: number; goals: number }
  >
  periodEvents: EvidenceReference[]
  claims: ClaimResult[]
}
