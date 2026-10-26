import type { MatchTeam } from './match.ts'

export type CountMetric = 'shots' | 'shots-on-target' | 'goals'

/**
 * Single-team count assertions that the comparison grammar cannot express.
 * `none` asserts a zero count of a named metric; `universal` quantifies over a
 * team's recorded shots ("every shot was on target", "none ... on target").
 */
export type CountAssertion =
  | { kind: 'none'; team: MatchTeam; metric: CountMetric }
  | {
      kind: 'universal'
      team: MatchTeam
      quantifier: 'every' | 'none'
      negated: boolean
    }

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
    `^${team}\\s+(?:did|do|does|has|have|had)\\s+not\\s+(?<goal>score)(?:d)?(?:\\s+(?:any\\s+)?goals?)?${tail}`,
    'i',
  ),
]

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

export function parseCountAssertion(input: string): CountAssertion | undefined {
  const text = input.trim().replace(/n['’]t\b/gi, ' not').replace(/\s+/g, ' ')
  for (const pattern of zeroPatterns) {
    const groups = pattern.exec(text)?.groups
    if (!groups) continue
    return {
      kind: 'none',
      team: resolveTeam(groups.team),
      metric: groups.goal ? 'goals' : normalizeMetric(groups.metric),
    }
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
