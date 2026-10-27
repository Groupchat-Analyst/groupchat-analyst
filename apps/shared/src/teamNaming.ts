/**
 * Every fixture stores its two sides in two fixed slots, internally named "Northbridge" (home,
 * IDs north-player-NN) and "Eastport" (away, IDs east-player-NN). A fixture with other teams
 * declares its display names and accepted aliases; the API translates the opinion into slot names
 * before interpretation and translates the complete response back, so calculations, record IDs
 * and the original fixtures stay untouched. Identity naming (the original teams) is a no-op.
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

const FOREIGN = 'Foreignclub'

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function isIdentityNaming(naming: TeamNaming): boolean {
  return naming.teams[0] === SLOT_TEAMS[0] && naming.teams[1] === SLOT_TEAMS[1]
}

export type SlottedOpinion = { text: string; foreign: string | null }

/**
 * Rewrites team names in an opinion to slot names. A slot name that belongs to another fixture
 * (for example "Eastport" in a different match) is replaced by a placeholder so it cannot be read
 * as one of this fixture's teams.
 */
export function toSlotOpinion(opinion: string, naming: TeamNaming): SlottedOpinion {
  if (isIdentityNaming(naming)) return { text: opinion, foreign: null }
  let foreign: string | null = null
  let text = opinion.replace(/\b(Northbridge|Eastport)\b/gi, (match) => {
    foreign ??= match
    return FOREIGN
  })
  const entries = naming.aliases
    .flatMap((names, slot) => names.map((name) => ({ name, slot })))
    .sort((a, b) => b.name.length - a.name.length)
  for (const { name, slot } of entries) {
    text = text.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, 'giu'),
      `@@${slot}@@`,
    )
  }
  text = text.replace(/@@(\d)@@/g, (_, slot) => SLOT_TEAMS[Number(slot)])
  return { text, foreign }
}

function localizeText(value: string, naming: TeamNaming, foreign: string | null): string {
  return value
    .replace(/\bNorthbridge\b/g, naming.teams[0])
    .replace(/\bEastport\b/g, naming.teams[1])
    .replace(new RegExp(`\\b${FOREIGN}\\b`, 'g'), foreign ?? FOREIGN)
}

/** Deeply replaces slot names in string values and object keys with the fixture's display names. */
export function toDisplay<T>(value: T, naming: TeamNaming, foreign: string | null = null): T {
  if (isIdentityNaming(naming)) return value
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
