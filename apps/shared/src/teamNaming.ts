import { DATASET_CATALOG } from './datasetCatalog.ts'

/**
 * Every fixture stores its two sides in two fixed slots, internally named "Northbridge" (home,
 * IDs north-player-NN) and "Eastport" (away, IDs east-player-NN). A fixture with other teams
 * declares its display names and accepted aliases; the API translates the opinion into slot names
 * before interpretation and translates the complete response back, so calculations, record IDs
 * and the original fixtures stay untouched. Identity naming keeps the original team names.
 */
export const SLOT_TEAMS = ['Northbridge', 'Eastport'] as const

export type TeamNaming = {
  /** Home then away display names. */
  readonly teams: readonly [string, string]
  /** Accepted spellings for each side, including the display name. */
  readonly aliases: readonly [readonly string[], readonly string[]]
}

export const IDENTITY_NAMING: TeamNaming = {
  teams: SLOT_TEAMS,
  aliases: [['Northbridge'], ['Eastport']],
}

type ForeignTeams = Record<string, string>

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function isIdentityNaming(naming: TeamNaming): boolean {
  return naming.teams[0] === SLOT_TEAMS[0] && naming.teams[1] === SLOT_TEAMS[1]
}

export type SlottedOpinion = { text: string; foreign: ForeignTeams }

/**
 * Rewrites this fixture's aliases to slot names and marks aliases from other catalog fixtures.
 * One replacement pass gives longer current aliases priority and never re-reads inserted slot
 * names. Foreign spellings remain reversible, including when the selected fixture is Original.
 */
export function toSlotOpinion(opinion: string, naming: TeamNaming): SlottedOpinion {
  const currentAliases = new Map<string, number>()
  naming.aliases.forEach((aliases, slot) => {
    for (const name of [naming.teams[slot], ...aliases]) currentAliases.set(name.toLowerCase(), slot)
  })
  const names = [...new Set([
    ...naming.teams,
    ...naming.aliases.flat(),
    ...SLOT_TEAMS,
    ...DATASET_CATALOG.flatMap((entry) => [...entry.teams, ...entry.teamAliases.flat()]),
  ])].sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
  const foreign: ForeignTeams = {}
  const markers = new Map<string, string>()
  const text = opinion.replace(pattern, (match) => {
    const slot = currentAliases.get(match.toLowerCase())
    if (slot !== undefined) return SLOT_TEAMS[slot]
    let marker = markers.get(match)
    if (!marker) {
      const key = String(markers.size)
      foreign[key] = match
      marker = `__foreign_${key}__`
      markers.set(match, marker)
    }
    return marker
  })
  return { text, foreign }
}

function localizeText(value: string, naming: TeamNaming, foreign: ForeignTeams): string {
  return value
    .replace(/\b(Northbridge|Eastport)\b/g, (slot) =>
      slot === SLOT_TEAMS[0] ? naming.teams[0] : naming.teams[1],
    )
    .replace(/__foreign_(\d+)__/g, (marker, slot: string) =>
      foreign[slot] ?? marker,
    )
}

/** Deeply replaces slot names in string values and object keys with the fixture's display names. */
export function toDisplay<T>(value: T, naming: TeamNaming, foreign: ForeignTeams = {}): T {
  if (isIdentityNaming(naming) && Object.keys(foreign).length === 0) return value
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return localizeText(node, naming, foreign)
    if (Array.isArray(node)) return node.map(walk)
    if (node !== null && typeof node === 'object') {
      return Object.fromEntries(
        Object.entries(node).map(([key, item]) => [localizeText(key, naming, foreign), walk(item)]),
      )
    }
    return node
  }
  return walk(value) as T
}
