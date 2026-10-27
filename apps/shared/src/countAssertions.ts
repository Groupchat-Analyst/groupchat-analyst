import type { MatchTeam } from './match.ts'
import type { PlayerEntityReference } from './apiContracts.ts'

export type CountMetric = 'shots' | 'shots-on-target' | 'goals'

/**
 * Entity count assertions that the comparison grammar cannot express.
 * `none` asserts zero; `some` asserts a recorded goal; `universal` quantifies over a
 * team's recorded shots ("every shot was on target", "none ... on target").
 */
export type CountAssertion = (
  | { kind: 'none' | 'some'; team: MatchTeam; metric: CountMetric }
  | {
      kind: 'universal'
      team: MatchTeam
      quantifier: 'every' | 'none'
      negated: boolean
    }
) & { player?: PlayerEntityReference }

const team = '(?<team>Northbridge|Eastport)'
const metricWord = '(?<metric>shots?\\s+on\\s+target|shots?|goals?)'
const tail = '(?:\\s+(?:so\\s+far|yet|at\\s+all))?\\s*[.!?]*$'
const verbs = 'have|had|has|record|recorded|register|registered|create|created|take|taken|took|make|made|manage|managed'

const zeroPatterns = [
  new RegExp(`^${team}\\s+(?:${verbs})\\s+(?:no|zero|0)\\s+${metricWord}${tail}`, 'i'),
  new RegExp(
    `^${team}\\s+(?:did|do|does|has|have|had)\\s+not\\s+(?:${verbs})\\s+(?:(?:any|a|even\\s+a|a\\s+single|one)\\s+)?${metricWord}${tail}`,
    'i',
  ),
  new RegExp(
    `^${team}\\s+(?:did|do|does|has|have|had)\\s+not\\s+(?<goal>score)(?:d)?(?:\\s+(?:(?:any|a|a\\s+single)\\s+)?goals?)?${tail}`,
    'i',
  ),
  new RegExp(`^${team}\\s+(?:(?:has|have|had)\\s+)?never\\s+(?<goal>score)d?${tail}`, 'i'),
]

const scoringPattern = new RegExp(
  `^${team}\\s+(?:(?:has|have|had)\\s+)?scored(?:\\s+(?:a\\s+)?goal)?${tail}`,
  'i',
)

export const BEFORE_GOAL_PHRASE =
  /\s*\b(?:just\s+)?before\s+(?:the|that)\s+(?<which>first|opening|last|latest|most\s+recent)?\s*(?<noun>goal|opener|equali[sz]er)\b/i

const everyPatterns = [
  new RegExp(
    `^(?<not>not\\s+)?(?:every|each|all)(?:\\s+of)?\\s+${team}(?:['’]s)?\\s+shots?\\s+(?:was|were|has\\s+been|have\\s+been|had\\s+been)\\s+on\\s+target\\s*[.!?]*$`,
    'i',
  ),
  new RegExp(
    `^${team}(?:['’]s)?\\s+shots\\s+(?:were|have\\s+been)\\s+(?<not>not\\s+)?all\\s+on\\s+target\\s*[.!?]*$`,
    'i',
  ),
]

const nonePatterns = [
  new RegExp(
    `^(?:every|each|all)(?:\\s+of)?\\s+${team}(?:['’]s)?\\s+shots?\\s+(?:was|were|has\\s+been|have\\s+been|had\\s+been)\\s+not\\s+on\\s+target\\s*[.!?]*$`,
    'i',
  ),
  new RegExp(
    `^(?:none|not\\s+one|not\\s+a\\s+single\\s+one)\\s+of\\s+${team}(?:['’]s)?\\s+shots\\s+(?:was|were|has\\s+been|have\\s+been)\\s+on\\s+target\\s*[.!?]*$`,
    'i',
  ),
  new RegExp(
    `^no\\s+${team}\\s+shot\\s+(?:was|has\\s+been)\\s+on\\s+target\\s*[.!?]*$`,
    'i',
  ),
]

function resolveTeam(value: string): MatchTeam {
  return value.toLowerCase() === 'northbridge' ? 'Northbridge' : 'Eastport'
}

function normalizeMetric(value: string): CountMetric {
  const word = value.toLowerCase().replace(/\s+/g, ' ')
  if (word.startsWith('goal')) return 'goals'
  return word.includes('on target') ? 'shots-on-target' : 'shots'
}

export function parseCountAssertion(
  input: string,
  resolvedPlayer?: PlayerEntityReference | null,
): CountAssertion | undefined {
  const normalize = (value: string) => value.replace(/[Øø]/g, 'o')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  let text = normalize(input.trim()).replace(/n['’]t\b/gi, ' not').replace(/\s+/g, ' ')
  let player: PlayerEntityReference | undefined
  if (resolvedPlayer) {
    const name = normalize(resolvedPlayer.name)
    const parts = name.split(/\s+/)
    for (const alias of [name, parts.at(-1)!, parts[0]]) {
      if (text.toLowerCase().startsWith(`${alias.toLowerCase()} `)) {
        text = resolvedPlayer.team + text.slice(alias.length)
        player = resolvedPlayer
        break
      }
    }
  }
  for (const pattern of zeroPatterns) {
    const groups = pattern.exec(text)?.groups
    if (!groups) continue
    return {
      kind: 'none',
      team: resolveTeam(groups.team),
      metric: groups.goal ? 'goals' : normalizeMetric(groups.metric),
      ...(player ? { player } : {}),
    }
  }
  const scored = scoringPattern.exec(text)?.groups
  if (scored) {
    return { kind: 'some', team: resolveTeam(scored.team), metric: 'goals', ...(player ? { player } : {}) }
  }
  for (const pattern of everyPatterns) {
    const groups = pattern.exec(text)?.groups
    if (!groups) continue
    return {
      kind: 'universal',
      team: resolveTeam(groups.team),
      quantifier: 'every',
      negated: Boolean(groups.not),
    }
  }
  for (const pattern of nonePatterns) {
    const groups = pattern.exec(text)?.groups
    if (!groups) continue
    return {
      kind: 'universal',
      team: resolveTeam(groups.team),
      quantifier: 'none',
      negated: false,
    }
  }
  return undefined
}

const shotWord = '(?:shots?|efforts?|strikes?|attempts?|goals?|scor(?:ed|es?))'
const shotLocationPattern = new RegExp(
  `\\b${shotWord}\\b[^.!?]*?\\b(?:outside|inside|within)\\s+(?:the\\s+)?(?:penalty\\s+)?(?:box|area)\\b|\\b${shotWord}\\b[^.!?]*?\\bfrom\\s+(?:distance|range|long\\s+range|close\\s+range|the\\s+edge\\s+of\\s+the\\s+(?:box|area)|the\\s+(?:left|right|centre|center)\\b)|\\blong[- ]range\\s+(?:shots?|efforts?|strikes?|goals?)\\b`,
  'i',
)

/** Shot-position wording; shot records carry no coordinates or zone, so this can only be answered as unrecorded. */
export function mentionsShotLocation(text: string): boolean {
  return shotLocationPattern.test(text)
}
