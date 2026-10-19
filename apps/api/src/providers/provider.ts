import type { InterpretedClaim } from '../../../shared/src/apiContracts.js'
import type { EvidenceCapability } from '../../../shared/src/evidence.js'
import type { AnalysisPeriod, MatchClock, MatchEvent } from '../../../shared/src/match.js'

export type InterpretationContext = {
  events: MatchEvent[]
  selectedClock: MatchClock
  selectedTime: string
  period: AnalysisPeriod
  capabilities: EvidenceCapability[]
}

export interface InterpretationProvider {
  readonly name: 'local' | 'foundry'
  interpret(opinion: string, context: InterpretationContext): Promise<unknown>
}

export type { InterpretedClaim }
