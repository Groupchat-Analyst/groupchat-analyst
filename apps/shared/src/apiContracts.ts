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
  | 'possession-losses'
  | 'physical-measurements'
  | 'build-up-phase'
  | 'lineups'
  | 'shot-location'

/** Describes the claim's meaning, independently of its requested operation or time scope. */
export type ClaimMeaningCategory =
  | 'factual-comparison'
  | 'performance-judgement'
  | 'historical-circumstance'
  | 'coaching-question'
  | 'other'

/** Describes what the user wants done; historical scope must not change the operation. */
export type ClaimIntent =
  | 'statistical-request'
  | 'factual-claim'
  | 'subjective-judgement'
  | 'unavailable-metric'
  | 'coaching-question'
  | 'unrecognized-language'

export type ClaimMetric =
  | 'shots'
  | 'shots-on-target'
  | 'goals'
  | 'possession-percentage'
  | 'pass-attempts'
  | 'pass-completions'
  | 'pass-completion-percentage'
  | 'running-distance'
  | 'minutes-played'
  | 'recoveries'
  | 'pressure-observations'
export type ClaimOperator =
  | 'greater-than'
  | 'less-than'
  | 'equal'
  | 'greater-or-equal'
  | 'less-or-equal'
  | 'not-equal'
  | 'comparison-request'

export type PlayerEntityReference = {
  id: string
  name: string
  team: MatchTeam
}

export type InterpretedClaim = {
  id: string
  subject: MatchTeam | null
  playerSubject: PlayerEntityReference | null
  playerMetric: ClaimMetric | null
  text: string
  intent: ClaimIntent
  meaning: {
    category: ClaimMeaningCategory
    description: string
    comparison: {
      opponent: MatchTeam
      opponentPlayer: PlayerEntityReference | null
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
  datasetId?: string
}

export type MatchReplayResponse = {
  datasetId?: string
  datasetVersion?: string
  selectedTime: string
  score: Record<MatchTeam, number>
  events: Array<{
    id: string
    time: string
    team: MatchTeam
    description: string
    type: 'shot' | 'other'
    outcome?: 'goal' | 'saved' | 'blocked' | 'off-target'
  }>
}

export type EvidenceReference = {
  id: string
  time: string
  team: MatchTeam | 'Shared play'
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
  value: number | null
}

export type CalculationTrace = {
  team: MatchTeam
  metric: ClaimMetric | 'possession-losses-by-area'
  area?: 'defensive-third' | 'middle-third' | 'final-third'
  value: number | null
  numerator: number
  denominator: number
  numeratorRecordIds: string[]
  denominatorRecordIds: string[]
  denominatorDescription: string
}

export type EvidenceFoundation = {
  dataset: {
    id: string
    version: string
    label: string
    source: string
    provenance: 'synthetic' | 'observed' | 'inferred' | 'modelled'
  }
  capabilities: Array<{
    id: string
    label: string
    status: 'available' | 'partial' | 'not-recorded'
    detail: string
  }>
  possessionDenominatorMinutes: number
  possessionCoverageComplete: boolean
  passCoverageComplete: boolean
  turnoverCoverageComplete: boolean
  missingCoveragePeriods: string[]
  excludedOutOfPlayMinutes: number
  contestedMinutes: number
  metricDefinitions: string[]
  teams: Record<
    MatchTeam,
    {
      possessionMinutes: number
      possessionPercentage: number | null
      passAttempts: number
      completedPasses: number
      passCompletionPercentage: number | null
      possessionLosses: Record<
        'defensive-third' | 'middle-third' | 'final-third',
        number | null
      >
      finalThirdEntries: number | null
    }
  >
  possessionIntervals: Array<{
    id: string
    team: MatchTeam | null
    status: 'controlled' | 'contested' | 'out-of-play'
    start: string
    end: string
    durationMinutes: number
    endReason?: string
    relatedEventIds: string[]
  }>
  passRecords: Array<{
    id: string
    possessionId: string
    team: MatchTeam
    playerId: string
    receiverId: string
    time: string
    start: { x: number; y: number }
    end: { x: number; y: number }
    outcome: 'complete' | 'incomplete'
    qualifiers: string[]
    provenance: 'synthetic' | 'observed' | 'inferred' | 'modelled'
  }>
  turnoverRecords: Array<{
    id: string
    possessionId: string
    team: MatchTeam
    playerId: string
    time: string
    location: { x: number; y: number }
    lostPassId: string
    recoveredBy: MatchTeam | null
    provenance: 'synthetic' | 'observed' | 'inferred' | 'modelled'
  }>
  passReferences: EvidenceReference[]
  turnoverReferences: EvidenceReference[]
  recoveryReferences: EvidenceReference[]
  pressureReferences: EvidenceReference[]
  players: Array<{
    id: string
    team: MatchTeam
    name: string
    status: 'starter' | 'substitute'
    participation: 'on-pitch' | 'participated' | 'unused-substitute' | 'not-yet-on-pitch'
    minutesInWindow: number
    selectedWindowActions: number
  }>
  substitutions: Array<{
    id: string
    team: MatchTeam
    time: string
    playerOnId: string
    playerOffId: string
  }>
  buildUpAnnotations: Array<{
    id: string
    version: string
    phase: 'build-up'
    team: MatchTeam
    possessionId: string
    passIds: string[]
    turnoverIds: string[]
    pressureIds: string[]
    coverage: 'selected-sample'
  }>
  buildUpCoverage: 'selected-sample'
  windowLabel: string
}

export type PlayerStatistic = {
  playerId: string
  playerName: string
  team: MatchTeam
  metric: ClaimMetric
  value: number | null
}

export type PlayerCalculationTrace = {
  playerId: string
  playerName: string
  team: MatchTeam
  metric:
    | 'pass-attempts'
    | 'pass-completions'
    | 'pass-completion-percentage'
    | 'shots'
    | 'shots-on-target'
    | 'goals'
    | 'minutes-played'
    | 'recoveries'
    | 'pressure-observations'
  numerator: number
  denominator: number
  value: number | null
  numeratorRecordIds: string[]
  denominatorRecordIds: string[]
  denominatorDescription: string
  durationWindow?: {
    recordedCoverageStart: string
    recordedCoverageEnd: string
    selectedWindowStart: string
    selectedWindowEnd: string
    participationStart: string
    participationEnd: string
  }
}

export type ClaimEvidence = {
  role: 'supporting' | 'challenging' | 'context' | 'calculation' | 'anchor'
  reference: EvidenceReference
}

export type ClaimResult = {
  claim: InterpretedClaim
  assessment:
    | 'supported'
    | 'contradicted'
    | 'insufficient evidence for a firm conclusion'
    | 'clarification needed'
    | 'statistics provided'
    | 'unavailable data'
    | 'unrecognized language'
  periodLabel: string
  statistics: TeamStatistic[]
  playerStatistics: PlayerStatistic[]
  playerCalculations: PlayerCalculationTrace[]
  calculations: CalculationTrace[]
  evidenceAvailability: EvidenceAvailability[]
  evidence: ClaimEvidence[]
  limitation: string
}

export type AnalysisResponse = {
  provider: 'local' | 'foundry'
  providerLabel: string
  summary: string
  /** Canonical conversational Fan reply: the answer only, without the scope and synthetic-data trailer. */
  fanReply?: string
  selectedTime: string
  selectedPeriodLabel: string
  score: Record<MatchTeam, number>
  periodStatistics: Record<
    MatchTeam,
    { shots: number; shotsOnTarget: number; goals: number }
  >
  periodEvents: EvidenceReference[]
  evidenceFoundation: EvidenceFoundation
  claims: ClaimResult[]
}
