import type { AnalysisPeriod, MatchClock } from './matchClock.ts'

export const BASELINE_DATASET_ID = 'northbridge-eastport-analysis-demo'
export const RETURN_DATASET_ID_PUBLIC = 'northbridge-eastport-return-demo'
export const WESTHAVEN_DATASET_ID_PUBLIC = 'westhaven-kingswell-demo'
export const REDMERE_DATASET_ID_PUBLIC = 'redmere-alderwick-demo'

export type DatasetMoment = { label: string; clock: MatchClock }

/** A prepared opinion. It only fills the draft and scope; the person submits it. */
export type DatasetExample = {
  id: string
  text: string
  clock: MatchClock
  period: AnalysisPeriod
  /** What kind of response to expect, shown beside the example. */
  shows: string
  expectedAssessment: string
}

export type DatasetCatalogEntry = {
  id: string
  version: string
  name: string
  /** Home and away display names, in that order. */
  teams: readonly [string, string]
  /** Accepted spellings for each side (display name first), used to read team names in opinions. */
  teamAliases: readonly [readonly string[], readonly string[]]
  /** Short, human description of what the match is like to explore. */
  scenario: string
  description: string
  fictional: true
  moments: DatasetMoment[]
  examples: DatasetExample[]
}

const second = (minute: number): MatchClock => ({ period: 2, minute })
const stoppage = (period: 1 | 2, minute: number, stoppageMinutes: number): MatchClock => ({ period, minute, stoppageMinutes })

/**
 * Metadata only, so the web client can list matches without bundling fixtures.
 * The API resolves these IDs to data through its own allowlist.
 */
export const DATASET_CATALOG: readonly DatasetCatalogEntry[] = [
  {
    id: BASELINE_DATASET_ID,
    version: '3.0.0',
    name: 'Original match',
    teams: ['Northbridge', 'Eastport'],
    teamAliases: [['Northbridge'], ['Eastport']],
    scenario: 'An equaliser at 58′ and a late Eastport lead. Try the shots-on-target opinion at 57′, then 58′.',
    description: 'Northbridge v Eastport — the verified demonstration fixture.',
    fictional: true,
    moments: [
      { label: '45+3′ · Northbridge goal', clock: stoppage(1, 45, 3) },
      { label: '57′ · before equaliser', clock: second(57) },
      { label: '58′ · equaliser', clock: second(58) },
      { label: '83′ · Eastport lead', clock: second(83) },
      { label: '90+4′ · full-time', clock: stoppage(2, 90, 4) },
    ],
    examples: [
      { id: 'saka-game', text: 'Saka has had a horrible game', clock: second(57), period: 'match-so-far', shows: 'Broad player opinion: his recorded contributions, no rating', expectedAssessment: 'insufficient evidence for a firm conclusion' },
      { id: 'shots-on-target', text: 'Eastport had more shots on target than Northbridge.', clock: second(57), period: 'match-so-far', shows: 'Factual claim that changes between 57′ and 58′', expectedAssessment: 'contradicted' },
      { id: 'bruno', text: 'How many passes did Bruno complete?', clock: second(58), period: 'match-so-far', shows: 'Ambiguous name: asks which Bruno', expectedAssessment: 'clarification needed' },
      { id: 'bus', text: 'Northbridge parked the bus', clock: second(57), period: 'match-so-far', shows: 'Tactical opinion the records cannot settle', expectedAssessment: 'insufficient evidence for a firm conclusion' },
      { id: 'distance', text: 'Northbridge covered more distance than Eastport', clock: second(57), period: 'match-so-far', shows: 'Physical data that is not recorded', expectedAssessment: 'unavailable data' },
    ],
  },
  {
    id: RETURN_DATASET_ID_PUBLIC,
    version: '1.0.0',
    name: 'Return match',
    teams: ['Northbridge', 'Eastport'],
    teamAliases: [['Northbridge'], ['Eastport']],
    scenario: 'Eastport keep the ball, Northbridge take the shots, and a stoppage-time Northbridge goal settles it.',
    description: 'Northbridge v Eastport — Eastport keep the ball, Northbridge take the shots.',
    fictional: true,
    moments: [
      { label: '26′ · Eastport goal', clock: { period: 1, minute: 26 } },
      { label: '57′ · Northbridge equalise', clock: second(57) },
      { label: '88′ · late Northbridge spell', clock: second(88) },
      { label: '90+2′ · Northbridge goal', clock: stoppage(2, 90, 2) },
      { label: '90+4′ · full-time', clock: stoppage(2, 90, 4) },
    ],
    examples: [
      { id: 'possession-vs-shots', text: 'Eastport had more possession than Northbridge but Northbridge had more shots', clock: stoppage(2, 90, 4), period: 'match-so-far', shows: 'Two claims: possession and shots can point different ways', expectedAssessment: 'supported' },
      { id: 'recent-spell', text: 'Northbridge had more possession than Eastport', clock: second(88), period: 'last-10-minutes', shows: 'Last-10-minutes window that differs from the whole match', expectedAssessment: 'supported' },
      { id: 'saka-game', text: 'Saka has had a horrible game', clock: second(60), period: 'match-so-far', shows: 'Broad player opinion: his recorded contributions, no rating', expectedAssessment: 'insufficient evidence for a firm conclusion' },
      { id: 'saka-passing', text: 'Saka’s passing has been poor', clock: second(70), period: 'match-so-far', shows: 'Passing evidence with no benchmark', expectedAssessment: 'insufficient evidence for a firm conclusion' },
      { id: 'sloppy', text: 'Northbridge are sloppy on the ball', clock: stoppage(2, 90, 4), period: 'match-so-far', shows: 'Recorded possession losses by pitch third', expectedAssessment: 'insufficient evidence for a firm conclusion' },
    ],
  },
  {
    id: WESTHAVEN_DATASET_ID_PUBLIC,
    version: '1.0.0',
    name: 'Goalless match',
    teams: ['Westhaven FC', 'Kingswell City'],
    teamAliases: [['Westhaven FC', 'Westhaven'], ['Kingswell City', 'Kingswell']],
    scenario: 'No goals. Westhaven take nine shots, Kingswell never test the keeper, then Kingswell hold the ball late on.',
    description: 'Westhaven FC v Kingswell City — a goalless match with a late change in possession.',
    fictional: true,
    moments: [
      { label: '45+3′ · half-time', clock: stoppage(1, 45, 3) },
      { label: '62′ · Westhaven substitution', clock: second(62) },
      { label: '80′ · late pressure', clock: second(80) },
      { label: '90+4′ · full-time', clock: stoppage(2, 90, 4) },
    ],
    examples: [
      { id: 'no-sot', text: 'Kingswell City had no shots on target.', clock: stoppage(2, 90, 4), period: 'match-so-far', shows: 'A zero-count claim on shots on target', expectedAssessment: 'supported' },
      { id: 'recent-possession', text: 'Westhaven FC had more possession than Kingswell City', clock: stoppage(2, 90, 4), period: 'last-10-minutes', shows: 'Last-10-minutes window that differs from the whole match', expectedAssessment: 'contradicted' },
      { id: 'haaland-passing', text: 'Haaland’s passing has been poor', clock: stoppage(2, 90, 4), period: 'match-so-far', shows: 'A player with shots but no recorded pass attempts', expectedAssessment: 'insufficient evidence for a firm conclusion' },
      { id: 'before-goal', text: 'Westhaven FC had no shots on target before the goal', clock: stoppage(2, 90, 4), period: 'match-so-far', shows: 'No goal is recorded, so the question has no anchor', expectedAssessment: 'clarification needed' },
      { id: 'pedro', text: 'How many passes did Pedro complete?', clock: second(62), period: 'match-so-far', shows: 'Ambiguous name: asks which Pedro', expectedAssessment: 'clarification needed' },
    ],
  },
  {
    id: REDMERE_DATASET_ID_PUBLIC,
    version: '1.0.0',
    name: 'Late winner',
    teams: ['Redmere FC', 'Alderwick United'],
    teamAliases: [['Redmere FC', 'Redmere'], ['Alderwick United', 'Alderwick']],
    scenario: 'Redmere lead, Alderwick equalise, then a 78′ substitute scores the winner at 88′.',
    description: 'Redmere FC v Alderwick United — a late substitution and a late winner.',
    fictional: true,
    moments: [
      { label: '33′ · Redmere goal', clock: { period: 1, minute: 33 } },
      { label: '61′ · Alderwick equalise', clock: second(61) },
      { label: '78′ · Alderwick substitution', clock: second(78) },
      { label: '88′ · Alderwick winner', clock: second(88) },
      { label: '90+4′ · full-time', clock: stoppage(2, 90, 4) },
    ],
    examples: [
      { id: 'abraham-scored', text: 'Abraham has scored', clock: second(88), period: 'match-so-far', shows: 'A substitute’s goal, which only exists from 88′', expectedAssessment: 'supported' },
      { id: 'every-shot', text: 'Every Alderwick United shot was on target', clock: stoppage(2, 90, 4), period: 'match-so-far', shows: 'A universal claim checked against every recorded shot', expectedAssessment: 'contradicted' },
      { id: 'before-goal', text: 'Redmere FC had no shots on target before the goal', clock: stoppage(2, 90, 4), period: 'match-so-far', shows: 'Three goals are recorded, so the question asks which one', expectedAssessment: 'clarification needed' },
      { id: 'shots', text: 'Redmere FC had more shots than Alderwick United', clock: stoppage(2, 90, 4), period: 'match-so-far', shows: 'A factual comparison that is supported on the full match', expectedAssessment: 'supported' },
      { id: 'jackson', text: 'Jackson has been poor', clock: second(75), period: 'match-so-far', shows: 'Broad player opinion: his recorded contributions, no rating', expectedAssessment: 'insufficient evidence for a firm conclusion' },
    ],
  },
]

export function findCatalogEntry(id: unknown): DatasetCatalogEntry | undefined {
  return typeof id === 'string'
    ? DATASET_CATALOG.find((entry) => entry.id === id)
    : undefined
}
