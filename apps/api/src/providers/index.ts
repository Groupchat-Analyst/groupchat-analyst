import type { InterpretationProvider } from './provider.js'
import { LocalInterpretationProvider } from './local.js'

export function createInterpretationProvider(
  environment: NodeJS.ProcessEnv,
): InterpretationProvider {
  const provider = environment.CLAIM_INTERPRETER_PROVIDER?.trim() || 'local'
  if (provider === 'local') return new LocalInterpretationProvider()
  throw new Error(
    `Unsupported public CLAIM_INTERPRETER_PROVIDER "${provider}". Public analysis must use local rules.`,
  )
}
