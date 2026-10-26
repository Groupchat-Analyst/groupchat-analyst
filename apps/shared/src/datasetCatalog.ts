import type { AnalysisPeriod, MatchClock } from './matchClock.ts'

export const BASELINE_DATASET_ID = 'northbridge-eastport-analysis-demo'
export const RETURN_DATASET_ID_PUBLIC = 'northbridge-eastport-return-demo'

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
]

export function findCatalogEntry(id: unknown): DatasetCatalogEntry | undefined {
  return typeof id === 'string'
    ? DATASET_CATALOG.find((entry) => entry.id === id)
    : undefined
}
