import type { InterpretedClaim } from '../../../shared/src/apiContracts.js'
import type { SyntheticMatchEvidence } from '../../../shared/src/evidence.js'
import type { EvidenceCapability } from '../../../shared/src/evidence.js'
import type { AnalysisPeriod, MatchClock, MatchEvent } from '../../../shared/src/match.js'

export type InterpretationContext = {
  events: MatchEvent[]
  selectedClock: MatchClock
  selectedTime: string
  period: AnalysisPeriod
  capabilities: EvidenceCapability[]
  players: SyntheticMatchEvidence['players']
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
}

export type { InterpretedClaim }
