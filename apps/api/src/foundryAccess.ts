import { createHash, timingSafeEqual } from 'node:crypto'
import type { InterpretationProvider } from './providers/provider.js'
import { createFoundryProvider } from './providers/foundry.js'

export type FoundryAccessFailure =
  | 'foundry_not_configured'
  | 'foundry_access_denied'

export class FoundryAccessError extends Error {
  readonly code: FoundryAccessFailure

  constructor(code: FoundryAccessFailure) {
    super(
      code === 'foundry_access_denied'
        ? 'The judge access code was not accepted.'
        : 'Judge AI is not configured on this server. Use local rules instead.',
    )
    this.name = 'FoundryAccessError'
    this.code = code
  }
}

function configuredAccessCode(environment: NodeJS.ProcessEnv): string {
  const code = environment.FOUNDRY_JUDGE_ACCESS_CODE ?? ''
  if (
    environment.FOUNDRY_JUDGE_ENABLED?.trim().toLowerCase() !== 'true' ||
    !/^[A-Za-z0-9_-]{32,128}$/u.test(code)
  ) {
    throw new FoundryAccessError('foundry_not_configured')
  }
  return code
}

export function authorizeFoundryAccess(
  environment: NodeJS.ProcessEnv,
  candidate: string | null | undefined,
  createProvider = createFoundryProvider,
): InterpretationProvider {
  const expected = configuredAccessCode(environment)
  if (typeof candidate !== 'string' || candidate.length > 128) {
    throw new FoundryAccessError('foundry_access_denied')
  }
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest()
  const candidateDigest = createHash('sha256')
    .update(candidate, 'utf8')
    .digest()
  if (!timingSafeEqual(expectedDigest, candidateDigest)) {
    throw new FoundryAccessError('foundry_access_denied')
  }

  try {
    return createProvider(environment)
  } catch {
    throw new FoundryAccessError('foundry_not_configured')
  }
}
