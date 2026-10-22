import type {
  AnalysisPeriod,
  MatchClock,
} from '../../shared/src/matchClock'
import { formatMatchClock } from '../../shared/src/matchClock.ts'
import type {
  AnalysisRequest,
  AnalysisResponse,
  MatchReplayResponse,
} from '../../shared/src/apiContracts'

export type SubmissionContext = {
  opinion: string
  selectedClock: MatchClock
  period: AnalysisPeriod
}

export function createSubmissionContext(
  opinion: string,
  selectedClock: MatchClock,
  period: AnalysisPeriod,
): SubmissionContext {
  return {
    opinion,
    selectedClock: { ...selectedClock },
    period,
  }
}

export function createAnalysisRequest(context: SubmissionContext): AnalysisRequest {
  return {
    opinion: context.opinion,
    selectedClock: { ...context.selectedClock },
    period: context.period,
  }
}

export function isSubmissionScopeCurrent(
  submitted: SubmissionContext,
  selectedClock: MatchClock,
  period: AnalysisPeriod,
): boolean {
  return (
    submitted.period === period &&
    submitted.selectedClock.period === selectedClock.period &&
    submitted.selectedClock.minute === selectedClock.minute &&
    (submitted.selectedClock.stoppageMinutes ?? 0) ===
      (selectedClock.stoppageMinutes ?? 0)
  )
}

export function isLatestRequest(requestId: number, latestRequestId: number): boolean {
  return requestId === latestRequestId
}

export function replayEventsAtOrBefore(
  frame: MatchReplayResponse,
  selectedTime: string,
): MatchReplayResponse['events'] {
  if (frame.selectedTime !== selectedTime) return []
  return frame.events
}

function localPeriodLabel(period: AnalysisPeriod): string {
  return period === 'match-so-far' ? 'Match so far' : 'Last 10 minutes'
}

export function buildShareCardText(
  context: SubmissionContext,
  analysis: AnalysisResponse,
): string {
  const evidence = analysis.claims.flatMap((result) =>
    result.evidence.map(
      ({ role, reference }) =>
        `${reference.time} · ${reference.team} — ${reference.description} (${reference.id}; ${role})`,
    ),
  )
  const limitations = analysis.claims.map(
    ({ claim, limitation }) => `${claim.text}: ${limitation}`,
  )
  const clarifications = analysis.claims.flatMap(({ claim }) =>
    claim.clarificationNeeds,
  )

  return [
    'GROUPCHAT ANALYST · FICTIONAL MATCH',
    `Take: ${context.opinion}`,
    `Match scope: ${formatMatchClock(context.selectedClock)} · ${localPeriodLabel(context.period)}`,
    '',
    'Reply:',
    analysis.summary,
    '',
    'Evidence:',
    ...(evidence.length > 0 ? evidence : ['No claim-specific event evidence returned.']),
    ...(clarifications.length > 0
      ? ['', 'Clarification:', ...clarifications]
      : []),
    '',
    'Limitations:',
    ...(limitations.length > 0
      ? limitations
      : ['The request was not interpreted as a supported claim.']),
    '',
    'Synthetic demonstration data · fictional match',
  ].join('\n')
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function wrapLine(value: string, limit = 78): string[] {
  const words = value.split(/\s+/)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const pieces =
      word.length <= limit
        ? [word]
        : word.match(new RegExp(`.{1,${limit}}`, 'g')) ?? [word]
    for (const piece of pieces) {
      if (line && `${line} ${piece}`.length > limit) {
        lines.push(line)
        line = piece
      } else {
        line = line ? `${line} ${piece}` : piece
      }
    }
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['']
}

export function createShareCardSvg(text: string): string {
  const lines = text.split('\n').flatMap((line) => wrapLine(line))
  const lineHeight = 25
  const height = Math.max(360, 120 + lines.length * lineHeight)
  const renderedLines = lines
    .map(
      (line, index) =>
        `<text x="64" y="${104 + index * lineHeight}" class="body">${xmlEscape(line)}</text>`,
    )
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}">
<rect width="1080" height="${height}" rx="36" fill="#0c110f"/>
<rect x="28" y="28" width="1024" height="${height - 56}" rx="28" fill="#171e19" stroke="#39453a" stroke-width="2"/>
<rect x="64" y="62" width="8" height="${height - 124}" rx="4" fill="#d4ff63"/>
<text x="96" y="82" class="brand">GROUPCHAT ANALYST</text>
${renderedLines.replaceAll('x="64"', 'x="96"')}
<style>
.brand{font:700 22px Arial,sans-serif;letter-spacing:3px;fill:#d4ff63}
.body{font:400 20px Arial,sans-serif;fill:#f2f5ee}
</style>
</svg>`
}
