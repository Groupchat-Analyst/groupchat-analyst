import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type {
  AnalysisRequest,
  InterpretedClaim,
  PlayerResolutionOption,
} from '../../shared/src/apiContracts.js'
import { InputValidationError } from './validation.js'

export type PlayerResolutionGrant = {
  request: AnalysisRequest
  provider: 'local' | 'foundry'
  claims: InterpretedClaim[]
  candidates: Array<{ claimId: string; players: PlayerResolutionOption[] }>
  selectedPlayers: PlayerResolutionOption[]
}

const developmentSecret = randomBytes(32).toString('base64url')
const signingKeyBytes = 32

function validateSigningKey(secret: string): string {
  const decoded = Buffer.from(secret, 'base64url')
  if (
    decoded.length !== signingKeyBytes ||
    decoded.toString('base64url') !== secret
  ) {
    throw new Error(
      'PLAYER_RESOLUTION_SIGNING_KEY must be 32 random bytes encoded as unpadded base64url.',
    )
  }
  return secret
}

export function playerResolutionSecret(): string {
  const configured = process.env.PLAYER_RESOLUTION_SIGNING_KEY
  if (configured !== undefined) return validateSigningKey(configured)
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Player clarification is unavailable until PLAYER_RESOLUTION_SIGNING_KEY is configured.',
    )
  }
  return developmentSecret
}

export function signPlayerResolution(
  grant: PlayerResolutionGrant,
  secret = playerResolutionSecret(),
): string {
  validateSigningKey(secret)
  const body = Buffer.from(JSON.stringify(grant)).toString('base64url')
  const signature = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${signature}`
}

export function verifyPlayerResolution(
  token: unknown,
  secret = playerResolutionSecret(),
): PlayerResolutionGrant {
  validateSigningKey(secret)
  if (typeof token !== 'string' || token.length > 100_000) {
    throw new InputValidationError('Player clarification token is invalid.')
  }
  const [body, encodedSignature, ...extra] = token.split('.')
  if (!body || !encodedSignature || extra.length > 0) {
    throw new InputValidationError('Player clarification token is invalid.')
  }
  const expected = createHmac('sha256', secret).update(body).digest()
  let actual: Buffer
  try {
    actual = Buffer.from(encodedSignature, 'base64url')
  } catch {
    throw new InputValidationError('Player clarification token is invalid.')
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new InputValidationError('Player clarification token is invalid.')
  }
  let value: unknown
  try {
    value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    throw new InputValidationError('Player clarification token is invalid.')
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('request' in value) ||
    !('provider' in value) ||
    !['local', 'foundry'].includes(String(value.provider)) ||
    !('claims' in value) ||
    !Array.isArray(value.claims) ||
    !('candidates' in value) ||
    !Array.isArray(value.candidates) ||
    !('selectedPlayers' in value) ||
    !Array.isArray(value.selectedPlayers)
  ) {
    throw new InputValidationError('Player clarification token is invalid.')
  }
  return value as PlayerResolutionGrant
}
