import type { InterpretedClaim } from '../../../shared/src/apiContracts.js'
import type { SyntheticMatchEvidence } from '../../../shared/src/evidence.js'
import type { EvidenceCapability } from '../../../shared/src/evidence.js'
import type { AnalysisPeriod, MatchClock, MatchEvent, MatchTeam } from '../../../shared/src/match.js'

export type InterpretationContext = {
  teams: readonly MatchTeam[]
  events: MatchEvent[]
  selectedClock: MatchClock
  selectedTime: string
  period: AnalysisPeriod
  capabilities: EvidenceCapability[]
  players: SyntheticMatchEvidence['players']
  winningGoal?: {
    eventId: string
    sourcePlayerId: string
    scorerAliases: readonly string[]
  }
  goalScorers?: ReadonlyArray<{ eventId: string; sourcePlayerId: string; scorerAliases: readonly string[] }>
  inputLanguage?: 'en' | 'es' | 'fr' | 'de' | 'ar'
}

export type ProviderFailureCategory =
  | 'transport'
  | 'throttling'
  | 'refusal'
  | 'incomplete-output'
  | 'schema'
  | 'semantic-validation'

export class InterpretationProviderError extends Error {
  readonly category: ProviderFailureCategory

  constructor(category: ProviderFailureCategory, message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'InterpretationProviderError'
    this.category = category
  }
}

export interface InterpretationProvider {
  readonly name: 'local' | 'foundry'
  interpret(opinion: string, context: InterpretationContext): Promise<unknown>
  generatePunditReply?(facts: PunditFacts, onResponse?: (content: string) => void): Promise<unknown>
}

export type PunditFacts = {
  opinion: string
  window: string
  source: string
  scoreAtStart: { Arsenal: number; 'Leicester City': number }
  shotCounts: { Arsenal: number; 'Leicester City': number }
  shots: Array<{ id: string; time: string; team: string; playerId: number; playerName?: string; origin: { x: number; y: number }; outcome: string }>
  sequence: Array<{ id: string; time: string; description: string }>
  limitations: string[]
  verifiedPhrases: Array<{ token: string; text: string; eventIds: string[] }>
}

export type { InterpretedClaim }
