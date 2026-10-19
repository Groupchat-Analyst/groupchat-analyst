import type { InterpretationProvider } from './provider.js'
import { createFoundryProvider } from './foundry.js'
import { LocalInterpretationProvider } from './local.js'

export function createInterpretationProvider(
  environment: NodeJS.ProcessEnv,
): InterpretationProvider {
  const provider = environment.CLAIM_INTERPRETER_PROVIDER?.trim() || 'local'
  if (provider === 'local') return new LocalInterpretationProvider()
  if (provider === 'foundry') return createFoundryProvider(environment)
  throw new Error(
    `Unsupported CLAIM_INTERPRETER_PROVIDER "${provider}". Use "local" or "foundry".`,
  )
}
