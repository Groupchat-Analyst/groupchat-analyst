import type {
  AnalysisResponse,
  ClaimResult,
  EvidenceReference,
} from '../../shared/src/apiContracts'
import {
  elapsedMatchMinute,
  formatMatchClock,
  type MatchClock,
} from '../../shared/src/matchClock.ts'
import type { SubmissionContext } from './matchday.ts'
import {
  ASSESSMENT_LABELS,
  SYNTHETIC_LABEL,
  blocksToText,
  canonicalReply,
  describeEvidence,
  describePeriodLabel,
  eventLine,
  isRoutineLimitation,
  metricLabel,
  selectRelevantEvidence,
  type CardBlock,
} from './presentation.ts'

/** An answer exactly as the server returned it, with the question and scope it was asked at. */
export type AnswerSnapshot = Readonly<{
  id: number
  context: Readonly<SubmissionContext>
  analysis: Readonly<AnalysisResponse>
}>

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

export function createSnapshot(
  id: number,
  context: SubmissionContext,
  analysis: AnalysisResponse,
): AnswerSnapshot {
  return deepFreeze({
    id,
    context: structuredClone(context),
    analysis: structuredClone(analysis),
  })
}

export function isLaterClock(candidate: MatchClock, baseline: MatchClock): boolean {
  return elapsedMatchMinute(candidate) > elapsedMatchMinute(baseline)
}

const UNASSESSED: ReadonlyArray<ClaimResult['assessment']> = [
  'clarification needed',
  'unrecognized language',
  'unavailable data',
]

function isAssessed(result: ClaimResult): boolean {
  return !UNASSESSED.includes(result.assessment)
}

/** "Checked against" lines, derived only from the validated interpretation and the returned window. */
export function checkedAgainst(analysis: Pick<AnalysisResponse, 'claims'>): string[] {
  return analysis.claims.filter(isAssessed).map((result) => {
    const { claim } = result
    const comparison = claim.meaning.comparison
    const subject = claim.playerSubject?.name ?? claim.subject
    const target = comparison?.opponentPlayer?.name ?? comparison?.opponent
    const who = subject
      ? target && comparison?.operator !== undefined ? `${subject} vs ${target}` : subject
      : 'Both teams'
    const metrics = comparison
      ? [comparison.metric]
      : [...new Set([...result.statistics, ...result.playerStatistics].map(({ metric }) => metric))]
    const what = metrics.length > 0
      ? metrics.slice(0, 3).map(metricLabel).join(', ')
      : claim.meaning.description.replace(/[.!?]+$/, '').toLowerCase()
    return `${who} · ${what} · ${describePeriodLabel(result.periodLabel)}`
  })
}

type Figure = { entity: string; team: string; metric: string; value: number | null }

function figuresOf(result: ClaimResult): Figure[] {
  return [
    ...result.statistics.map(({ team, metric, value }) => ({ entity: team, team, metric, value })),
    ...result.playerStatistics.map(({ playerName, team, metric, value }) => ({
      entity: playerName,
      team,
      metric,
      value,
    })),
  ]
}

function claimKey(result: ClaimResult): string {
  const { claim } = result
  const comparison = claim.meaning.comparison
  return JSON.stringify([
    claim.subject,
    claim.playerSubject?.id ?? null,
    claim.playerMetric,
    claim.intent,
    claim.meaning.category,
    comparison && [
      comparison.opponent,
      comparison.opponentPlayer?.id ?? null,
      comparison.metric,
      comparison.operator,
    ],
    [...claim.requiredEvidence].sort(),
    claim.timePeriod.kind === 'before-event' ? claim.timePeriod.eventId : 'selected',
    // Prose is model-generated; it only distinguishes claims the structure cannot.
    comparison ? null : claim.text.trim().toLowerCase(),
  ])
}

const RATE_METRICS = new Set(['possession-percentage', 'pass-completion-percentage'])

export type FigureChange = {
  entity: string
  metric: string
  label: string
  before: number | null
  after: number | null
}

export type PairChange = {
  text: string
  before: ClaimResult['assessment']
  after: ClaimResult['assessment']
  beforeLabel: string
  afterLabel: string
  figures: FigureChange[]
  added: string[]
  removed: string[]
  /** Whether the listed record changes account for the change in the counted figures. */
  accounting: 'complete' | 'partial' | 'incomplete' | 'rate' | 'unchanged'
}

export type Comparison = {
  status: 'comparable' | 'different-interpretation' | 'not-comparable'
  earlierTime: string
  laterTime: string
  earlierWindow: string
  laterWindow: string
  headline: string
  /** Fan-facing sentences. */
  lines: string[]
  /** Comparison-specific qualifications, kept in every output. */
  caveats: string[]
  /** Material data qualifications from both snapshots; time-specific ones are labelled. */
  qualifications: string[]
  pairs: PairChange[]
}

const COUNT_EVIDENCE: Record<string, string> = {
  shots: 'shots',
  'shots-on-target': 'shots-on-target',
  goals: 'goals',
}

const COVERAGE_FLAGS: Array<[string, 'possessionCoverageComplete' | 'passCoverageComplete' | 'turnoverCoverageComplete', string]> = [
  ['possession', 'possessionCoverageComplete', 'Possession coverage is partial'],
  ['passing', 'passCoverageComplete', 'Pass coverage is partial'],
  ['possession-losses', 'turnoverCoverageComplete', 'Turnover coverage is partial'],
]

/** Material limitations one answer carries: clarification needs, data gaps and coverage warnings. */
function qualificationsOf(snapshot: AnswerSnapshot): string[] {
  const { analysis } = snapshot
  const roster = analysis.evidenceFoundation.players
  const found = new Set<string>()
  for (const result of analysis.claims) {
    for (const need of result.claim.clarificationNeeds) found.add(need)
    if (!isRoutineLimitation(result)) found.add(describeEvidence(result.limitation, roster))
    for (const item of result.evidenceAvailability) {
      if (!item.available) found.add(describeEvidence(item.detail, roster))
    }
    for (const [kind, flag, text] of COVERAGE_FLAGS) {
      if (result.claim.requiredEvidence.includes(kind as never) && !analysis.evidenceFoundation[flag]) {
        const missing = analysis.evidenceFoundation.missingCoveragePeriods
        found.add(missing.length > 0 ? `${text}: missing ${missing.join(', ')}.` : `${text}.`)
      }
    }
  }
  return [...found].filter(Boolean)
}

/** Qualifications from both snapshots. Identical ones are merged; others are labelled with their time. */
function combinedQualifications(
  earlier: AnswerSnapshot,
  later: AnswerSnapshot,
  earlierTime: string,
  laterTime: string,
): string[] {
  const before = qualificationsOf(earlier)
  const after = qualificationsOf(later)
  const both = before.filter((text) => after.includes(text))
  const sameTime = earlierTime === laterTime
  return [
    ...both,
    ...before.filter((text) => !both.includes(text)).map((text) => `At ${earlierTime}: ${text}`),
    ...after.filter((text) => !both.includes(text)).map((text) => (sameTime ? text : `At ${laterTime}: ${text}`)),
  ]
}

function datasetOf(snapshot: AnswerSnapshot): string {
  const { id, version } = snapshot.analysis.evidenceFoundation.dataset
  return `${id}@${version}`
}

const STATE_PHRASE: Record<ClaimResult['assessment'], [string, string]> = {
  supported: ['held up', 'holds up'],
  contradicted: ["didn't hold up", "doesn't hold up"],
  'insufficient evidence for a firm conclusion': [
    "couldn't be settled from the records",
    "can't be settled from the records",
  ],
  'statistics provided': ['had figures only', 'has figures only'],
  'clarification needed': ['needed clarifying', 'needs clarifying'],
  'unavailable data': ['had no recorded data', 'has no recorded data'],
  'unrecognized language': ["wasn't understood", "isn't understood"],
}

function sameWindowKind(a: SubmissionContext, b: SubmissionContext): boolean {
  return a.period === b.period
}

function roleFiltered(result: ClaimResult, analysis: AnalysisResponse) {
  const roster = analysis.evidenceFoundation.players
  const relevant = selectRelevantEvidence(result, roster).filter(
    ({ role }) => role === 'supporting' || role === 'challenging' || role === 'anchor',
  )
  return relevant.map(({ reference }) => reference)
}

function pairChange(
  earlier: AnswerSnapshot,
  later: AnswerSnapshot,
  before: ClaimResult,
  after: ClaimResult,
): PairChange {
  const beforeRefs = roleFiltered(before, earlier.analysis)
  const afterRefs = roleFiltered(after, later.analysis)
  const beforeIds = new Set(beforeRefs.map(({ id }) => id))
  const afterIds = new Set(afterRefs.map(({ id }) => id))
  const added = afterRefs.filter(({ id }) => !beforeIds.has(id))
  const removed = beforeRefs.filter(({ id }) => !afterIds.has(id))

  const beforeFigures = figuresOf(before)
  const figures: FigureChange[] = figuresOf(after).map((figure) => ({
    entity: figure.entity,
    metric: figure.metric,
    label: metricLabel(figure.metric),
    before:
      beforeFigures.find(
        (item) => item.entity === figure.entity && item.metric === figure.metric,
      )?.value ?? null,
    after: figure.value,
  }))
  const moved = figures.filter((figure) => figure.before !== figure.after)
  const teamOf = (entity: string) =>
    figuresOf(after).find((item) => item.entity === entity)?.team
  const earlierRoster = earlier.analysis.evidenceFoundation.players
  const laterRoster = later.analysis.evidenceFoundation.players
  const attributed = (record: EvidenceReference, entity: string, roster: typeof laterRoster) =>
    record.team === teamOf(entity) &&
    (!roster.some(({ name }) => name === entity) ||
      describeEvidence(record.description, roster).includes(entity))
  const availabilityGap = [before, after].some((result) =>
    result.evidenceAvailability.some(({ available }) => !available),
  )
  let accounting: PairChange['accounting'] = 'unchanged'
  if (moved.length > 0) {
    if (moved.some(({ metric }) => RATE_METRICS.has(metric))) accounting = 'rate'
    else {
      const relevantMetric = (metric: string) =>
        COUNT_EVIDENCE[metric] !== undefined &&
        after.claim.requiredEvidence.includes(COUNT_EVIDENCE[metric] as never)
      const netMatches = moved.every(({ entity, metric, before: from, after: to }) => {
        if (from === null || to === null || !relevantMetric(metric)) return false
        const net =
          added.filter((record) => attributed(record, entity, laterRoster)).length -
          removed.filter((record) => attributed(record, entity, earlierRoster)).length
        return net === to - from
      })
      const everyRecordAttributed =
        added.every((record) => moved.some(({ entity }) => attributed(record, entity, laterRoster))) &&
        removed.every((record) => moved.some(({ entity }) => attributed(record, entity, earlierRoster)))
      if (availabilityGap) accounting = 'incomplete'
      else accounting = netMatches && everyRecordAttributed ? 'complete' : 'partial'
    }
  }
  return {
    text: after.claim.text,
    before: before.assessment,
    after: after.assessment,
    beforeLabel: ASSESSMENT_LABELS[before.assessment],
    afterLabel: ASSESSMENT_LABELS[after.assessment],
    figures,
    added: added.map((reference) => eventLine(reference, later.analysis.evidenceFoundation.players)),
    removed: removed.map((reference) =>
      eventLine(reference, earlier.analysis.evidenceFoundation.players),
    ),
    accounting,
  }
}

const trimStop = (text: string) => text.replace(/[.\s]+$/, '')

function figureSentence(pair: PairChange): string {
  const byMetric = new Map<string, FigureChange[]>()
  for (const figure of pair.figures) {
    byMetric.set(figure.label, [...(byMetric.get(figure.label) ?? []), figure])
  }
  return [...byMetric.entries()]
    .map(([label, items]) => {
      const parts = items.map(({ entity, before, after }) =>
        before === after ? `${entity} ${after ?? 'n/a'}` : `${entity} ${before ?? 'n/a'} → ${after ?? 'n/a'}`,
      )
      return `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${parts.join(', ')}.`
    })
    .join(' ')
}

const ACCOUNTING_CAVEAT: Record<PairChange['accounting'], string | null> = {
  complete: "The listed moments match the change in the count. That's a tally, not a reason: the records can't say why it happened.",
  unchanged: null,
  partial: "The records listed don't fully account for the change in these figures.",
  incomplete: "Some of the records behind these figures aren't fully recorded, so the ones listed may not be the whole story.",
  rate: "This is a rate or share, so the records listed don't add up to the change directly.",
}

function windowOf(snapshot: AnswerSnapshot): string {
  return describePeriodLabel(snapshot.analysis.selectedPeriodLabel)
}

/** Deterministic comparison of two returned answers. It never calls a model and never asserts a cause. */
export function compareSnapshots(earlier: AnswerSnapshot, later: AnswerSnapshot): Comparison {
  const earlierTime = formatMatchClock(earlier.context.selectedClock)
  const laterTime = formatMatchClock(later.context.selectedClock)
  const qualifications = combinedQualifications(earlier, later, earlierTime, laterTime)
  const base = {
    earlierTime,
    laterTime,
    earlierWindow: windowOf(earlier),
    laterWindow: windowOf(later),
    pairs: [] as PairChange[],
    qualifications,
  }
  const a = earlier.analysis.claims
  const b = later.analysis.claims
  if (datasetOf(earlier) !== datasetOf(later)) {
    const [first, second] = [earlier, later].map((snapshot) => {
      const { label, version } = snapshot.analysis.evidenceFoundation.dataset
      return `${label.split('.')[0]} (version ${version})`
    })
    return {
      ...base,
      status: 'not-comparable',
      headline: "These two checks used different match data, so I'm not lining them up.",
      lines: [`Here are the two answers separately: the ${earlierTime} check and the ${laterTime} check.`],
      caveats: [`The ${earlierTime} check used ${first}; the ${laterTime} check used ${second}. Figures from different data can't be compared like for like.`],
    }
  }
  if (a.length === 0 || a.length !== b.length || a.some((result, i) => claimKey(result) !== claimKey(b[i]))) {
    return {
      ...base,
      status: 'different-interpretation',
      headline: `The two checks read this take differently, so I'm not comparing them directly.`,
      lines: [`Here are the two answers separately: the ${earlierTime} check and the ${laterTime} check.`],
      caveats: ['The interpreted claims differ, so no like-for-like change is reported.'],
    }
  }
  if (!sameWindowKind(earlier.context, later.context) || a.some((r, i) => !isAssessed(r) || !isAssessed(b[i]))) {
    return {
      ...base,
      status: 'not-comparable',
      headline: "I can't line these two checks up like for like.",
      lines: [`Here are the two answers separately: the ${earlierTime} check and the ${laterTime} check.`],
      caveats: [
        sameWindowKind(earlier.context, later.context)
          ? 'At least one check could not be assessed, so there is nothing to compare.'
          : 'The checks used different evidence periods.',
      ],
    }
  }

  const pairs = a.map((result, index) => pairChange(earlier, later, result, b[index]))
  const lines: string[] = []
  const caveats: string[] = []
  const multiple = pairs.length > 1
  for (const pair of pairs) {
    const [, nowPhrase] = STATE_PHRASE[pair.after]
    const [thenPhrase] = STATE_PHRASE[pair.before]
    const prefix = multiple ? `“${pair.text}” — ` : ''
    const verdict =
      pair.before === pair.after
        ? `${prefix}Same call at both times: it ${nowPhrase}.`
        : `${prefix}That's changed: at ${earlierTime} it ${thenPhrase}; at ${laterTime} it ${nowPhrase}.`
    lines.push(verdict)
    const figures = figureSentence(pair)
    if (figures) lines.push(figures)
    if (pair.added.length > 0) lines.push(`New in the records: ${pair.added.map(trimStop).join('; ')}.`)
    if (pair.removed.length > 0) lines.push(`No longer in the window: ${pair.removed.map(trimStop).join('; ')}.`)
    const caveat = ACCOUNTING_CAVEAT[pair.accounting]
    if (caveat) caveats.push(multiple ? `${caveat} (“${pair.text}”)` : caveat)
  }
  if (earlier.context.period === 'last-10-minutes') {
    caveats.push(
      `Rolling windows: ${base.earlierWindow} against ${base.laterWindow}, so earlier moments can drop out.`,
    )
  }
  const headline = multiple
    ? `${pairs.length} claims rechecked: here's how each one moved.`
    : lines[0]
  return {
    ...base,
    status: 'comparable',
    headline,
    lines: multiple ? lines : lines.slice(1),
    caveats,
    pairs,
  }
}

export type ChangeCard = { blocks: CardBlock[]; extended: boolean }

const EXTENDED_LINES = 20

/** The "what changed" card. Blocks drive the preview, copied text and exported image alike. */
export function buildChangeCard(
  take: string,
  _earlier: AnswerSnapshot,
  _later: AnswerSnapshot,
  comparison: Comparison,
): ChangeCard | null {
  if (comparison.status !== 'comparable') return null
  const blocks: CardBlock[] = [{ kind: 'brand', text: 'Groupchat Analyst' }]
  const extended = comparison.pairs.length > 1
  if (extended) blocks.push({ kind: 'notice', text: `Extended card · ${comparison.pairs.length} claims` })
  blocks.push(
    { kind: 'take', text: `“${take}”` },
    {
      kind: 'scope',
      text: `Checked at ${comparison.earlierTime}, then again at ${comparison.laterTime}`,
    },
    { kind: 'answer', text: comparison.headline },
  )
  comparison.pairs.forEach((pair, index) => {
    if (comparison.pairs.length > 1) {
      blocks.push({ kind: 'heading', text: `${index + 1}. ${pair.text}` })
    }
    blocks.push(
      { kind: 'bullet', text: `${comparison.earlierTime} (${comparison.earlierWindow}): ${pair.beforeLabel}` },
      { kind: 'bullet', text: `${comparison.laterTime} (${comparison.laterWindow}): ${pair.afterLabel}` },
    )
    if (pair.figures.length > 0) {
      blocks.push({ kind: 'label', text: 'Decisive figures' })
      for (const sentence of figureSentence(pair).split(/(?<=\.) /)) {
        blocks.push({ kind: 'bullet', text: sentence })
      }
    }
    if (pair.added.length > 0) {
      blocks.push({ kind: 'label', text: 'New recorded moments' })
      for (const line of pair.added) blocks.push({ kind: 'bullet', text: trimStop(line) })
    }
    if (pair.removed.length > 0) {
      blocks.push({ kind: 'label', text: 'No longer in the window' })
      for (const line of pair.removed) blocks.push({ kind: 'bullet', text: trimStop(line) })
    }
  })
  for (const caveat of comparison.caveats) blocks.push({ kind: 'note', text: `Note: ${caveat}` })
  for (const text of comparison.qualifications) blocks.push({ kind: 'note', text: `Limitation: ${text}` })
  blocks.push({ kind: 'footer', text: SYNTHETIC_LABEL })
  return { blocks, extended: extended || blocks.length > EXTENDED_LINES }
}

export function changeCardText(card: ChangeCard): string {
  return blocksToText(card.blocks)
}

/** What each snapshot says, for display beside a comparison that cannot be reduced to one line. */
export function snapshotReply(snapshot: AnswerSnapshot): string {
  return canonicalReply(snapshot.analysis)
}

/** Whether a pass map is a relevant explanation for any claim in the answer. */
export function needsPassMap(analysis: Pick<AnalysisResponse, 'claims'>): boolean {
  return analysis.claims.some(({ claim }) =>
    claim.requiredEvidence.some((kind) =>
      kind === 'passing' || kind === 'possession-losses' || kind === 'build-up-phase'),
  )
}
