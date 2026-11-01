import type { ClaimResolution, ClaimResult } from './apiContracts.ts'
import { formatLocalizedMessage, type AppLanguage } from './localization.ts'
import { RESOLUTION_MESSAGES } from './resolutionLocale.ts'

/**
 * The structured resolution state of a claim. Responses saved before structured states existed
 * carry no `resolution`: choices are recovered from their signed continuation, and an unresolved
 * clarification is shown generically rather than guessed at.
 */
export function claimResolution(result: ClaimResult): ClaimResolution | undefined {
  if (result.playerResolution) {
    return { status: 'player-choice', players: result.playerResolution.candidates }
  }
  if (result.resolution) return result.resolution
  return result.assessment === 'clarification needed'
    ? { status: 'needs-clarification' }
    : undefined
}

/** Localized application guidance for an unresolved claim; never derived from provider prose. */
export function resolutionMessage(resolution: ClaimResolution, language: AppLanguage): string {
  const separator = language === 'ar' ? '، ' : ', '
  const players = (list: Array<{ name: string }>) => list.map(({ name }) => name).join(separator)
  switch (resolution.status) {
    case 'player-choice':
      return formatLocalizedMessage(RESOLUTION_MESSAGES.choice, { players: players(resolution.players) }, language)
    case 'player-not-in-fixture':
      return formatLocalizedMessage(RESOLUTION_MESSAGES.absent, { name: resolution.name }, language)
    case 'unsupported-wording':
      return formatLocalizedMessage(RESOLUTION_MESSAGES.unsupported, { players: players(resolution.players) }, language)
    case 'needs-clarification':
      return formatLocalizedMessage(RESOLUTION_MESSAGES.unclear, {}, language)
  }
}

/** True while any claim still awaits a choice or clarification; such replies are not shareable answers. */
export function hasUnresolvedClaims(claims: readonly ClaimResult[]): boolean {
  return claims.some((result) => claimResolution(result) !== undefined)
}
