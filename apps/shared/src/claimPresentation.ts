import type { ClaimMetric, EvidenceKind } from './apiContracts.js'
import type { AnalysisPeriod, MatchClock, MatchTeam } from './match.js'
import type { OpinionTopic } from './opinionTopics.js'

/**
 * Language-free presentation descriptors for one claim result.
 *
 * The server fills them where the answer is decided, from structured values (entities, metric
 * ids, counts, MatchClock objects, record ids, availability kinds). They never contain
 * English sentences and are never derived from the legacy `reply`/`limitation` strings, which
 * remain only as raw/legacy fields. The only free text allowed is verbatim user wording
 * (`quote`, `foreignTeams`) and raw ids. A renderer chooses words per language from `code`,
 * `kind` and the numeric/clock fields.
 *
 * Absent `null` always means "not recorded / not calculable"; a recorded zero is `0`.
 * Clocks keep their period and stoppage (45+3' is period 1, minute 45, stoppageMinutes 3);
 * never compare minute numbers across periods.
 */
export type ClaimPresentation = {
  version: 1
  answer: AnswerFact
  /** Ordered, 1:1 with the decisions that produced the legacy limitation (plus typed answer-level notes). */
  limitations: LimitationFact[]
  scope: ScopeFact
  reason?: ReasonCode
}

export type EntityRef =
  | { kind: 'team'; team: MatchTeam }
  | { kind: 'player'; id: string; name: string; team: MatchTeam }

export type PitchArea = 'defensive-third' | 'middle-third' | 'final-third'

export type PresentationVerdict = 'supported' | 'contradicted' | 'unsettled'

/** Stable status/reason for unavailable, insufficient, unsupported or unresolved decisions. */
export type ReasonCode =
  | 'metric-not-recorded'
  | 'phase-scope-unavailable'
  | 'interpreter-unreliable'
  | 'prediction'
  | 'foreign-team'
  | 'needs-clarification'
  | 'player-not-in-fixture'
  | 'player-choice'
  | 'no-attempts'
  | 'coverage-incomplete'
  | 'not-yet-final'
  | 'player-not-yet-on-pitch'
  | 'player-unused-substitute'
  | 'sparse-player-records'
  | 'subjective-judgement'
  | 'no-relevant-events'
  | 'insufficient-evidence'

export type ScopeFact =
  | { kind: 'window'; period: AnalysisPeriod; through: MatchClock }
  | {
      kind: 'before-goal'
      anchorEventId: string
      anchorTeam: MatchTeam
      anchorClock: MatchClock
    }
  | { kind: 'first-half-goals'; through: MatchClock }

export type PossessionShares = {
  team: MatchTeam
  value: number
  opponent: MatchTeam
  opponentValue: number
}

export type PossessionAspect = 'supports' | 'challenges' | 'level'

export type PlayerContribution =
  | { code: 'goals' | 'shots-on-target' | 'shots' | 'recoveries' | 'pressure-observations'; count: number }
  | { code: 'passes'; completed: number; attempts: number }
  | {
      code: 'minutes'
      minutes: number
      /** Pre-formatted clock labels copied from the player calculation trace, when present. */
      window?: {
        selectedStart: string
        selectedEnd: string
        participationStart: string
        participationEnd: string
      }
    }

export type PlayerFacts = {
  player: EntityRef & { kind: 'player' }
  participation: 'not-yet-on-pitch' | 'unused-substitute' | 'participated'
  contributions: PlayerContribution[]
  /** True only for a participant with no attributed action in the window. */
  noRecordedActions: boolean
}

export type TopicFacts =
  /** Passing; any null means the figure is not recorded, ratePercent is null without attempts. */
  | { kind: 'passing'; attempts: number | null; completions: number | null; ratePercent: number | null }
  | { kind: 'player-possession-losses'; count: number; areas: PitchArea[]; attempts: number | null }
  | { kind: 'team-possession-losses'; areas: Array<{ area: PitchArea; count: number | null }> }
  | { kind: 'attacking'; shots: number | null; onTarget: number | null; goals: number | null }
  | { kind: 'involvement'; actions: number; playerFacts: PlayerFacts }
  | { kind: 'player-summary'; playerFacts: PlayerFacts }
  /** The team figures are in ClaimResult.statistics. */
  | { kind: 'statistics' }
  | { kind: 'none' }

export type TopicContext =
  | { kind: 'keeper' }
  | { kind: 'possession-context'; shares: PossessionShares | null }
  | { kind: 'pressure-sample'; team: MatchTeam; opponent: MatchTeam; observations: number; opponentObservations: number }

export type UnavailableMetric =
  | ClaimMetric
  | 'physical-condition'
  | 'shot-location'
  | 'territorial-control'
  | 'build-up-pass-scope'

export type CoachingTeamLosses = {
  team: MatchTeam
  areas: Array<{ area: PitchArea; count: number | null }>
  total: number
}

export type AnswerFact =
  | { code: 'unavailable-metric'; metric?: UnavailableMetric; evidenceKinds: EvidenceKind[] }
  | {
      code: 'unrecognized'
      reason: 'interpreter-unreliable' | 'prediction' | 'foreign-team'
      /** Selected time a prediction cannot look beyond. */
      through?: MatchClock
      /** Verbatim user wording of the team names outside the fixture. */
      foreignTeams?: string[]
    }
  | { code: 'clarification'; quote: string }
  | {
      code: 'count-assertion'
      verdict: PresentationVerdict
      form: 'some' | 'none' | 'every' | 'not-every' | 'none-on-target'
      subject: EntityRef
      metric: 'shots' | 'shots-on-target' | 'goals'
      /** Numerator from the calculation trace; null when no trace exists (not a recorded zero). */
      recorded: number | null
      /** Denominator (the subject's recorded shots); 0 is a recorded absence. */
      of: number | null
    }
  | {
      code: 'half-time'
      assertion: 'scored' | 'did-not-score'
      verdict: PresentationVerdict
      subject: EntityRef
      outcome: 'goal-recorded' | 'no-goal-recorded' | 'not-yet-final'
      goalClock?: MatchClock
      selectedClock: MatchClock
    }
  | {
      code: 'historical'
      verdict: 'supported' | 'unsettled'
      kind: 'run-of-play' | 'circumstance' | 'player'
      /** Verbatim claim text. */
      quote: string
      possession?: PossessionShares & { minutes: number }
      playerFacts?: PlayerFacts
    }
  | ({ code: 'possession-dominance'; aspect: PossessionAspect } & PossessionShares)
  | {
      code: 'topic'
      topic: OpinionTopic
      negated: boolean
      subject: EntityRef
      facts: TopicFacts
      context?: TopicContext
      suggestsSpecificCount: boolean
    }
  | ({ code: 'player-broad' } & PlayerFacts)
  | {
      code: 'subjective-unsettled'
      quote: string
      context?: TopicContext
      shape?: 'defensive-shape' | 'pressure-progression'
    }
  | { code: 'insufficient'; quote: string }
  | {
      code: 'coaching'
      phase: 'build-up-sample' | 'all-passes'
      /** True when no possession-loss calculation exists for the question. */
      none: boolean
      teams: CoachingTeamLosses[]
      total: number
    }
  /** Rendered by the existing structured formatters (statistics, comparison, player, resolution state). */
  | {
      code: 'structured-elsewhere'
      family: 'statistics' | 'factual-comparison' | 'player-performance' | 'resolution'
    }

export type LimitationFact =
  | { code: 'clarification-needed' }
  | { code: 'unavailable-evidence'; kind: EvidenceKind }
  | { code: 'metric-not-recorded' }
  | { code: 'physical-condition' }
  | { code: 'build-up-pass-scope-unavailable' }
  | { code: 'prediction' }
  | { code: 'interpreter-unreliable' }
  | { code: 'foreign-team' }
  | { code: 'zero-attempts-universal'; team: MatchTeam }
  | { code: 'count-judged-on-outcomes'; subject: EntityRef }
  | {
      code: 'halftime-supported' | 'halftime-contradicted'
      recordedGoal: boolean
      assertion: 'scored' | 'did-not-score'
      subject: EntityRef
    }
  | { code: 'halftime-unsettled'; subject: EntityRef }
  | { code: 'pass-statistics-descriptive' }
  | { code: 'pass-coverage-partial' }
  | { code: 'descriptive-statistics-only' }
  | { code: 'no-pass-attempts' }
  | {
      code: 'coaching-build-up-sample' | 'coaching-all-passes'
      /** Null means both teams. */
      subject: EntityRef | null
      areas: Array<{ area: PitchArea; count: number }>
      total: number
    }
  | { code: 'topic'; topic: OpinionTopic }
  | { code: 'player-sparse'; player: EntityRef & { kind: 'player' } }
  | ({ code: 'possession-share-limit'; aspect: PossessionAspect } & PossessionShares)
  | { code: 'missing-data-prevents-conclusion'; quote: string }
  | { code: 'context-only'; quote: string }
  | { code: 'no-relevant-events' }
  | { code: 'possession-calculation-limit' }
  | { code: 'comparison-generic' }
  | { code: 'territory-or-chance-quality-absent' }

export const ANSWER_CODES = [
  'unavailable-metric',
  'unrecognized',
  'clarification',
  'count-assertion',
  'half-time',
  'historical',
  'possession-dominance',
  'topic',
  'player-broad',
  'subjective-unsettled',
  'insufficient',
  'coaching',
  'structured-elsewhere',
] as const satisfies ReadonlyArray<AnswerFact['code']>
