import type {
  AnalysisResponse,
  ClaimEvidence,
  ClaimResult,
  EvidenceReference,
} from '../../shared/src/apiContracts'
import { findCatalogEntry } from '../../shared/src/datasetCatalog.ts'

type Roster = ReadonlyArray<{ id: string; name: string }>

/** Identifier shapes used by the authoritative records. Used by tests and guards, never to delete text. */
export const INTERNAL_ID_PATTERN =
  /\b(?:(?:north|east)-player-\d+|(?:event|pass|turnover|recovery|pressure|sequence|substitution)-\d+|buildup-v\d+-\d+)\b/

const NUMBER = String.raw`\d+(?:\.\d+)?`
const POINT = String.raw`\(${NUMBER}, ${NUMBER}\)`

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Turns an authoritative evidence description into football language.
 * Each rule is anchored to a known server phrase; the roster supplies names.
 */
export function describeEvidence(description: string, roster: Roster): string {
  let text = description
  for (const { id, name } of roster) {
    text = text.replace(new RegExp(`${escapeRegExp(name)} \\(${escapeRegExp(id)}\\)`, 'g'), name)
    text = text.replace(new RegExp(`\\b${escapeRegExp(id)}\\b`, 'g'), name)
  }
  text = text
    .replace(new RegExp(`,? from ${POINT} to ${POINT}(?=[.;])`, 'g'), '')
    .replace(new RegExp(` at ${POINT}(?=[.;])`, 'g'), '')
    .replace(/; linked pass pass-\d+(?=\.)/g, '')
    .replace(/\b(following|linked to) turnover-\d+/g, '$1 a recorded turnover')
  return text.replace(/\s+([.;])/g, '$1').replace(/\s{2,}/g, ' ').trim()
}

/** Removes the server's trailing "(event-07 Northbridge goal)" anchor annotation from a period label. */
export function describePeriodLabel(label: string): string {
  return label.replace(/\s*\(event-\d+[^)]*\)\s*$/, '').trim()
}

const METRIC_LABELS: Record<string, string> = {
  shots: 'shots',
  'shots-on-target': 'shots on target',
  goals: 'goals',
  'possession-percentage': '% possession',
  'pass-attempts': 'passes attempted',
  'pass-completions': 'passes completed',
  'pass-completion-percentage': '% pass completion',
  recoveries: 'recoveries',
  'pressure-observations': 'pressure observations',
  'running-distance': 'running distance',
  'minutes-played': 'minutes played',
}

export function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric.replaceAll('-', ' ')
}

export const ASSESSMENT_LABELS: Record<ClaimResult['assessment'], string> = {
  supported: 'Supported',
  contradicted: 'Contradicted',
  'insufficient evidence for a firm conclusion': 'Not enough evidence for a firm conclusion',
  'clarification needed': 'Needs clarification',
  'statistics provided': 'Statistics only, no verdict',
  'unavailable data': 'Data not recorded',
  'unrecognized language': 'Not understood',
}

function relevantTeams(result: ClaimResult): Set<string> {
  const { claim } = result
  const teams = new Set<string>()
  if (claim.subject) teams.add(claim.subject)
  if (claim.meaning.comparison) teams.add(claim.meaning.comparison.opponent)
  if (claim.playerSubject) teams.add(claim.playerSubject.team)
  if (claim.meaning.comparison?.opponentPlayer) {
    teams.add(claim.meaning.comparison.opponentPlayer.team)
  }
  return teams
}

/** Evidence about the claim's subject and comparison target only; the full list stays on the result. */
export function selectRelevantEvidence(
  result: ClaimResult,
  roster: Roster,
): ClaimEvidence[] {
  const teams = relevantTeams(result)
  const { playerSubject, meaning } = result.claim
  const byTeam =
    teams.size === 0
      ? result.evidence
      : result.evidence.filter(
          ({ reference }) =>
            reference.team === 'Shared play' || teams.has(reference.team),
        )
  if (playerSubject && !meaning.comparison?.opponentPlayer) {
    const own = byTeam.filter(({ reference }) =>
      describeEvidence(reference.description, roster).includes(playerSubject.name),
    )
    if (own.length > 0) return own
  }
  return byTeam
}

/** Server wording that only explains why a statistical request has no verdict; it carries no data limitation. */
export const GENERIC_STATISTICS_LIMITATION =
  'Descriptive statistics are provided from the recorded synthetic events; this request does not receive a supported/contradicted truth verdict.'

export function isGenericStatisticsLimitation(result: ClaimResult): boolean {
  return (
    result.assessment === 'statistics provided' &&
    result.limitation === GENERIC_STATISTICS_LIMITATION
  )
}

const GENERIC_COMPARISON_LIMITATION =
  'This is a comparison of recorded events in the synthetic fixture, not a claim about chance quality or overall performance.'

/** Boilerplate that explains verdict mechanics rather than a data gap; it stays in the detailed reasoning. */
export function isRoutineLimitation(result: ClaimResult): boolean {
  return (
    isGenericStatisticsLimitation(result) ||
    ((result.assessment === 'supported' || result.assessment === 'contradicted') &&
      result.limitation === GENERIC_COMPARISON_LIMITATION)
  )
}

/** A broad tactical judgement whose required shape/positioning evidence is not recorded, so nothing recorded can establish or disprove it. */
export function isUnsupportedJudgement(result: ClaimResult): boolean {
  return (
    result.claim.intent === 'subjective-judgement' &&
    result.assessment === 'insufficient evidence for a firm conclusion' &&
    result.evidenceAvailability.some(
      ({ kind, available }) => kind === 'territorial-control' && !available,
    )
  )
}

export const CONTEXT_ONLY_LABEL = "Context only — can't establish defensive shape or positioning"

export type ShareCardClaim = {
  text: string
  /** Null for statistical requests, which have no verdict to show. */
  verdict: string | null
  /** Figures are background context, not evidence for the judgement. */
  contextOnly: boolean
  facts: string[]
  moments: string[]
  counter: string[]
  limitations: string[]
  omitted: number
}

export type ShareCardModel = {
  take: string
  scope: string
  answer: string
  claims: ShareCardClaim[]
  footer?: string
  extended: boolean
}

const MAX_EVENT_FACTS = 3
const MAX_COUNTER = 3
const EXTENDED_CLAIM_COUNT = 2
const EXTENDED_LINE_BUDGET = 22

export function eventLine(reference: EvidenceReference, roster: Roster): string {
  const description = describeEvidence(reference.description, roster)
  const named = reference.team === 'Shared play' || description.startsWith(reference.team)
  return `${reference.time} · ${named ? '' : `${reference.team}: `}${description}`
}

const SINGULAR: Record<string, string> = {
  goals: 'goal',
  shots: 'shot',
  recoveries: 'recovery',
  'shots on target': 'shot on target',
  'passes attempted': 'pass attempted',
  'passes completed': 'pass completed',
  'pressure observations': 'pressure observation',
}

function statLabel(metric: string, value: number): string {
  const label = metricLabel(metric)
  return value === 1 ? (SINGULAR[label] ?? label) : label
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ''))]
}

function claimSection(result: ClaimResult, roster: Roster): ShareCardClaim {
  const teams = relevantTeams(result)
  const evidence = selectRelevantEvidence(result, roster)

  const stats = result.statistics
    .filter((stat) => stat.value !== null && (teams.size === 0 || teams.has(stat.team)))
    .map((stat) => `${stat.team}: ${stat.value} ${statLabel(stat.metric, stat.value as number)}`)
  const playerStats = result.playerStatistics
    .filter((stat) => stat.value !== null)
    .map((stat) => `${stat.playerName}: ${stat.value} ${statLabel(stat.metric, stat.value as number)}`)

  const ranked = evidence.filter(({ role }) => role === 'anchor' || role === 'supporting')
  const context = evidence.filter(({ role }) => role === 'context' || role === 'calculation')
  const eventPool = ranked.length > 0 ? ranked : context
  const shown = eventPool.slice(-MAX_EVENT_FACTS)
  const challenging = evidence.filter(({ role }) => role === 'challenging')
  const shownCounter = challenging.slice(-MAX_COUNTER)

  const omitted =
    eventPool.length - shown.length + (challenging.length - shownCounter.length)

  return {
    text: result.claim.text,
    verdict:
      result.assessment === 'statistics provided'
        ? null
        : ASSESSMENT_LABELS[result.assessment],
    contextOnly: isUnsupportedJudgement(result),
    facts: [...stats, ...playerStats],
    moments: shown.map(({ reference }) => eventLine(reference, roster)),
    counter: shownCounter.map(({ reference }) => eventLine(reference, roster)),
    limitations: dedupe([
      ...result.claim.clarificationNeeds,
      ...(isRoutineLimitation(result)
        ? []
        : [describeEvidence(result.limitation, roster)]),
    ]),
    omitted,
  }
}

const SYNTHETIC_TRAILER = /\n\s*\n\s*Selected period:[^\n]*$/

/** The server summary without its trailing scope-and-disclaimer paragraph, which the card states once. */
export function summaryBody(summary: string): string {
  return summary.replace(SYNTHETIC_TRAILER, '').trim()
}

/** The canonical Fan reply: the server's conversational reply, or its summary when an older server sends none. */
export function canonicalReply(analysis: Pick<AnalysisResponse, 'fanReply' | 'summary'>): string {
  return analysis.fanReply ?? analysis.summary
}

export function buildShareCardModel(
  opinion: string,
  analysis: AnalysisResponse,
): ShareCardModel {
  const roster = analysis.evidenceFoundation.players
  const claims = analysis.claims.map((result) => claimSection(result, roster))
  const lines =
    claims.reduce(
      (total, claim) =>
        total +
        claim.facts.length +
        claim.moments.length +
        claim.counter.length +
        claim.limitations.length +
        2,
      0,
    )
  return {
    take: opinion,
    scope: describePeriodLabel(analysis.selectedPeriodLabel),
    answer: describeEvidence(
      analysis.fanReply ?? summaryBody(analysis.summary),
      roster,
    ),
    claims,
    footer: sourceFooter(analysis),
    extended: claims.length >= EXTENDED_CLAIM_COUNT || lines > EXTENDED_LINE_BUDGET,
  }
}

export type CardBlockKind =
  | 'brand'
  | 'notice'
  | 'take'
  | 'scope'
  | 'answer'
  | 'heading'
  | 'label'
  | 'bullet'
  | 'note'
  | 'footer'

export type CardBlock = { kind: CardBlockKind; text: string }

export const SYNTHETIC_LABEL = 'Synthetic data · fictional match'

/** Names the fixture and how the opinion was read, so a shared card makes sense outside the app. */
export function sourceFooter(analysis: AnalysisResponse): string {
  const dataset = analysis.evidenceFoundation.dataset
  const entry = findCatalogEntry(dataset?.id)
  const match = entry && dataset
    ? `${entry.teams[0]} v ${entry.teams[1]} · ${entry.name} v${dataset.version}`
    : null
  const reader = analysis.provider === 'local' ? 'read by local rules' : 'read by Foundry (server-side)'
  return [SYNTHETIC_LABEL, match, reader].filter(Boolean).join(' · ')
}

/** Single source of truth for the card: the on-screen card, copied text and exported image all use these blocks. */
export function shareCardBlocks(model: ShareCardModel): CardBlock[] {
  const blocks: CardBlock[] = [{ kind: 'brand', text: 'Groupchat Analyst' }]
  if (model.extended) {
    const count = model.claims.length
    blocks.push({
      kind: 'notice',
      text: `Extended card · ${count} ${count === 1 ? 'claim' : 'claims'}`,
    })
  }
  blocks.push(
    { kind: 'take', text: `“${model.take}”` },
    { kind: 'scope', text: model.scope },
    { kind: 'answer', text: model.answer },
  )
  model.claims.forEach((claim, index) => {
    if (model.claims.length > 1) {
      blocks.push({
        kind: 'heading',
        text: `${index + 1}. ${claim.text}${claim.verdict ? ` — ${claim.verdict}` : ''}`,
      })
    } else if (claim.verdict) {
      blocks.push({ kind: 'heading', text: `Verdict: ${claim.verdict}` })
    }
    if (claim.facts.length > 0) {
      blocks.push({ kind: 'label', text: claim.contextOnly ? CONTEXT_ONLY_LABEL : 'Key facts' })
    }
    for (const fact of claim.facts) blocks.push({ kind: 'bullet', text: fact })
    if (claim.moments.length > 0) {
      blocks.push({ kind: 'label', text: 'Selected recorded moments' })
    }
    for (const moment of claim.moments) blocks.push({ kind: 'bullet', text: moment })
    if (claim.counter.length > 0) blocks.push({ kind: 'label', text: 'Evidence against' })
    for (const item of claim.counter) blocks.push({ kind: 'bullet', text: item })
    if (claim.omitted > 0) {
      blocks.push({
        kind: 'note',
        text: `${claim.omitted} more recorded ${claim.omitted === 1 ? 'moment is' : 'moments are'} in the full record.`,
      })
    }
    for (const limitation of claim.limitations) {
      blocks.push({ kind: 'note', text: `Limitation: ${limitation}` })
    }
  })
  blocks.push({ kind: 'footer', text: model.footer ?? SYNTHETIC_LABEL })
  return blocks
}

export function blocksToText(blocks: CardBlock[]): string {
  return blocks
    .map(({ kind, text }) => {
      if (kind === 'bullet') return `• ${text}`
      if (kind === 'heading' || kind === 'label') return `\n${text}`
      if (kind === 'footer') return `\n${text}`
      return text
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

export function shareCardText(model: ShareCardModel): string {
  return blocksToText(shareCardBlocks(model))
}
