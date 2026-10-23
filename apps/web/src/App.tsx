import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react'
import type {
  AnalysisResponse,
  ClaimResult,
  EvidenceReference,
} from '../../shared/src/apiContracts'
import {
  formatMatchClock,
  getMatchTimeOptions,
  TEAMS,
  type AnalysisPeriod,
  type MatchClock,
} from '../../shared/src/matchClock'
import { MatchHeader, type KeyMoment } from './MatchHeader'
import { PassMap } from './PassMap'
import {
  createAnalysisRequest,
  createSubmissionContext,
  isLatestRequest,
  isSubmissionScopeCurrent,
  type SubmissionContext,
} from './matchday'
import {
  buildShareCardModel,
  describeEvidence,
  describePeriodLabel,
  isGenericStatisticsLimitation,
  shareCardBlocks,
  shareCardText,
  type ShareCardModel,
} from './presentation'
import { createShareCardImage, svgToPngBlob } from './shareCardImage'
import { fetchReplayFrame } from './replayApi'
import { clockKey, ReplayController } from './replayController'
import { getQuestionSuggestions } from './suggestions'
import './App.css'
import './matchday.css'

const MATCH_TIME_OPTIONS = getMatchTimeOptions()
const REPLAY_DWELL_MS = 900
const INITIAL_MATCH_TIME: MatchClock = {
  period: 2,
  minute: 57,
}

const KEY_MOMENTS: KeyMoment[] = [
  { label: '45+3′ · Northbridge goal', clock: { period: 1, minute: 45, stoppageMinutes: 3 } },
  { label: '57′ · before equaliser', clock: { period: 2, minute: 57 } },
  { label: '58′ · equaliser', clock: { period: 2, minute: 58 } },
  { label: '83′ · Eastport lead', clock: { period: 2, minute: 83 } },
  { label: '90+4′ · full-time', clock: { period: 2, minute: 90, stoppageMinutes: 4 } },
]

function isAnalysisResponse(value: unknown): value is AnalysisResponse {
  if (typeof value !== 'object' || value === null) return false
  const foundation =
    'evidenceFoundation' in value &&
    typeof value.evidenceFoundation === 'object' &&
    value.evidenceFoundation !== null
      ? value.evidenceFoundation
      : null
  return (
    'provider' in value &&
    (value.provider === 'local' || value.provider === 'foundry') &&
    'claims' in value &&
    Array.isArray(value.claims) &&
    'periodEvents' in value &&
    Array.isArray(value.periodEvents) &&
    'score' in value &&
    typeof value.score === 'object' &&
    value.score !== null &&
    foundation !== null &&
    'passRecords' in foundation &&
    Array.isArray(foundation.passRecords) &&
    'turnoverRecords' in foundation &&
    Array.isArray(foundation.turnoverRecords) &&
    'buildUpAnnotations' in foundation &&
    Array.isArray(foundation.buildUpAnnotations) &&
    'players' in foundation &&
    Array.isArray(foundation.players) &&
    value.claims.every(
      (claim) =>
        typeof claim === 'object' &&
        claim !== null &&
        'calculations' in claim &&
        Array.isArray(claim.calculations) &&
        'playerStatistics' in claim &&
        Array.isArray(claim.playerStatistics) &&
        'playerCalculations' in claim &&
        Array.isArray(claim.playerCalculations),
    )
  )
}

type Roster = AnalysisResponse['evidenceFoundation']['players']

function referenceList(references: EvidenceReference[], roster: Roster) {
  if (references.length === 0) {
    return <p className="empty-evidence">No matching event references in this section.</p>
  }

  return (
    <>
      <ul className="claim-reference-list">
        {references.map((reference) => (
          <li key={reference.id}>
            <span className="reference-time">{reference.time}</span>
            <span className="reference-description">
              <strong>{reference.team}</strong>
              <span>{describeEvidence(reference.description, roster)}</span>
            </span>
          </li>
        ))}
      </ul>
      <TechnicalRecord references={references} />
    </>
  )
}

function TechnicalRecord({ references }: { references: EvidenceReference[] }) {
  return (
    <details className="technical-record">
      <summary>Technical record · IDs and original wording</summary>
      <ul>
        {references.map((reference) => (
          <li key={reference.id}><code>{reference.id}</code> · {reference.time} · {reference.team} · {reference.description}</li>
        ))}
      </ul>
    </details>
  )
}

function metricLabel(metric: string): string {
  if (metric === 'shots-on-target') return 'shots on target'
  if (metric === 'possession-percentage') return 'possession'
  if (metric === 'pass-completion-percentage') return 'pass completion'
  if (metric === 'pass-attempts') return 'pass attempts'
  if (metric === 'pass-completions') return 'pass completions'
  if (metric === 'minutes-played') return 'selected-window minutes'
  if (metric === 'recoveries') return 'recorded recoveries'
  if (metric === 'pressure-observations') return 'selected pressure observations'
  return metric
}

function evidenceLabel(kind: string): string {
  return kind.replaceAll('-', ' ')
}

function ClaimCard({
  result,
  index,
  roster,
}: {
  result: ClaimResult
  index: number
  roster: Roster
}) {
  const claim = result.claim
  const titleId = `claim-result-${index}`
  return (
    <article className="claim-result" aria-labelledby={titleId}>
      <h3 className="claim-number" id={titleId}>
        Claim {index + 1}
      </h3>
      <p className="claim-display">{claim.text}</p>
      <div className="assessment-summary">
        <span
          className={`assessment-badge ${result.assessment.replaceAll(' ', '-')}`}
        >
          {result.assessment}
        </span>
        {result.statistics.length > 0 && (
          <div className="broad-stats">
            {result.statistics.map((statistic) => (
              <p key={`${statistic.team}-${statistic.metric}`}>
                <strong>{statistic.team}</strong>
                <span>
                  {statistic.value === null
                    ? 'Not available'
                    : `${statistic.value}${statistic.metric.includes('percentage') ? '%' : ''}`}{' '}
                  {metricLabel(statistic.metric)}
                </span>
              </p>
            ))}
          </div>
        )}
        {result.playerStatistics.length > 0 && (
          <div className="broad-stats" aria-label="Player statistics">
            {result.playerStatistics.map((statistic) => (
              <p key={`${statistic.playerId}-${statistic.metric}`}>
                <strong>{statistic.playerName}</strong>
                <span>
                  {statistic.value === null
                    ? 'Not available'
                    : `${statistic.value}${statistic.metric.includes('percentage') ? '%' : ''}`}{' '}
                  {metricLabel(statistic.metric)}
                </span>
              </p>
            ))}
          </div>
        )}
        {claim.clarificationNeeds.length > 0 && (
          <div className="clarification-panel" role="status">
            <strong>Clarification needed</strong>
            {claim.clarificationNeeds.map((need) => (
              <p key={need}>{need}</p>
            ))}
          </div>
        )}
      </div>
      <p className="assessment-limitation">
        <strong>Limitations:</strong> {result.limitation}
      </p>

      <details className="claim-evidence-details">
        <summary>View evidence</summary>
        <div className="claim-understanding">
          <p><span>Subject</span><strong>{claim.playerSubject?.name ?? claim.subject ?? 'Needs clarification'}</strong></p>
          <p><span>What we understood</span><strong>{claim.meaning.description}</strong></p>
          <p><span>Request type</span><strong>{claim.intent.replaceAll('-', ' ')}</strong></p>
          <p><span>Selected period</span><strong>{describePeriodLabel(result.periodLabel)}</strong></p>
          {claim.historicalEventAnchor && <p><span>Historical anchor</span><strong>{claim.historicalEventAnchor.relationship}</strong></p>}
        </div>
      {claim.clarificationNeeds.length === 0 && (
        <>
          <section className="evidence-group" aria-label="Required evidence availability">
            <h3>Evidence needs</h3>
            <ul className="availability-list">
              {result.evidenceAvailability.map((item) => (
                <li key={item.kind} className={item.available ? 'available' : 'unavailable'}>
                  <strong>
                    {evidenceLabel(item.kind)} · {item.available ? 'available' : 'not recorded'}
                  </strong>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="evidence-group claim-evidence-group">
            {claim.intent === 'statistical-request' ? (
              <div>
                <h3>Statistic request answered from the selected records</h3>
                <p className="evidence-group-summary">
                  The list below contains the relevant attributed records. Calculation denominators are available in the expandable trace.
                </p>
              </div>
            ) : claim.intent === 'subjective-judgement' ? (
              <p className="evidence-group-summary">
                These recorded events provide context, not a complete performance measure or verdict on the broader judgement.
              </p>
            ) : claim.intent === 'coaching-question' ? (
              <div>
                <h3>Recorded turnover locations and linked passes</h3>
                <p className="evidence-group-summary">
                  {claim.requiredEvidence.includes('build-up-phase')
                    ? 'These turnovers come only from the explicitly linked, partial build-up sample. Associated records do not establish tactical causes.'
                    : 'These are all-pass turnovers. Associated records do not establish tactical causes.'}
                </p>
              </div>
            ) : claim.intent === 'unavailable-metric' ||
                claim.intent === 'unrecognized-language' ? (
              <div>
                <h3>No matching recorded evidence</h3>
                <p className="evidence-group-summary">
                  No unrelated event lists or statistics are substituted for this request.
                </p>
              </div>
            ) : claim.meaning.category === 'factual-comparison' ? (
              <p className="evidence-group-summary">
                Each record below is labelled as supporting, challenging, contextual, calculation evidence, or a historical anchor.
              </p>
            ) : (
              <div>
                <h3>Relevant retrieved events</h3>
                <p className="evidence-group-summary">
                  These fixture events provide context for this opinion; they do not prove a subjective assessment.
                </p>
              </div>
            )}
            <section>
              <h3>All {result.evidence.length} claim evidence references</h3>
              <ul className="claim-reference-list">
                {result.evidence.map(({ role, reference }) => (
                  <li key={`${role}-${reference.id}`}>
                    <span className="reference-time">{reference.time}</span>
                    <span className="reference-description">
                      <strong>{reference.team} · {role}</strong>
                      <span>{describeEvidence(reference.description, roster)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <TechnicalRecord references={result.evidence.map(({ reference }) => reference)} />
            </section>
          {result.calculations.length > 0 || result.playerCalculations.length > 0 ? (
            <details className="calculation-traces">
              <summary>How this was calculated</summary>
              {[...result.calculations].map((trace) => (
                <section key={`${trace.team}-${trace.metric}-${trace.area ?? ''}`}>
                  <h4>{trace.team}{trace.area ? ` · ${trace.area.replaceAll('-', ' ')}` : ''}</h4>
                  <p>{trace.metric === 'possession-losses-by-area'
                    ? `${trace.value ?? 'Not available'} turnovers`
                    : `${trace.numerator}/${trace.denominator}${trace.metric.includes('percentage') ? ` (${trace.value === null ? 'rate not available' : `${trace.value}%`})` : ''}`}</p>
                  <p>{trace.denominatorDescription}</p>
                  <details className="technical-record"><summary>Technical record · IDs</summary>
                    <p>Numerator IDs: {trace.numeratorRecordIds.join(', ') || 'none'}</p>
                    <p>Denominator IDs: {trace.denominatorRecordIds.join(', ') || 'none'}</p>
                  </details>
                </section>
              ))}
              {result.playerCalculations.map((trace) => (
                <section key={`${trace.playerId}-${trace.metric}`}>
                  <h4>{trace.playerName} · {trace.metric.replaceAll('-', ' ')}</h4>
                  <p>
                    {trace.metric === 'pass-completion-percentage'
                      ? `${trace.numerator}/${trace.denominator} (${trace.value === null ? 'rate not available' : `${trace.value}%`})`
                      : trace.metric === 'pass-completions'
                        ? `${trace.numerator} completions among ${trace.denominator} attempts`
                        : `${trace.value ?? trace.numerator} ${metricLabel(trace.metric)}`}
                  </p>
                  <p>{trace.denominatorDescription}</p>
                  <details className="technical-record"><summary>Technical record · IDs</summary>
                    <p>Numerator IDs: {trace.numeratorRecordIds.join(', ') || 'none'}</p>
                    <p>Denominator IDs: {trace.denominatorRecordIds.join(', ') || 'none'}</p>
                  </details>
                </section>
              ))}
            </details>
          ) : null}
          </section>
        </>
      )}
      </details>
    </article>
  )
}

function EvidenceFoundationPanel({
  foundation,
}: {
  foundation: AnalysisResponse['evidenceFoundation']
}) {
  const roster = foundation.players
  const nameOf = (id: string) => roster.find((player) => player.id === id)?.name ?? 'Unrecorded player'
  return (
    <details className="evidence-foundation">
      <summary className="foundation-summary">
        <div>
          <p className="card-kicker">SOURCE & COVERAGE</p>
          <h2 id="evidence-foundation-title">Match data & coverage</h2>
        </div>
        <span className="synthetic-badge"><span aria-hidden="true" />Synthetic fixture</span>
      </summary>
      <div className="foundation-content">
      <p className="evidence-group-summary">
        {foundation.dataset.label} · version {foundation.dataset.version}. Possession percentages use only recorded controlled-possession minutes;
        contested play and time out of play are excluded.
      </p>
      <div className="advanced-team-grid">
        {TEAMS.map((team) => {
          const metrics = foundation.teams[team]
          const lossValues = Object.values(metrics.possessionLosses)
          const lossCount = lossValues.some((value) => value === null)
            ? null
            : lossValues.reduce<number>(
                (total, value) => total + (value ?? 0),
                0,
              )
          return (
            <article className="advanced-team-card" key={team}>
              <h3>{team}</h3>
              <p>
                <strong>
                  {metrics.possessionPercentage === null
                    ? 'Not available'
                    : `${metrics.possessionPercentage}%`}
                </strong>
                <span>possession · {metrics.possessionMinutes} minutes</span>
              </p>
              <p>
                <strong>
                  {metrics.passCompletionPercentage === null
                    ? 'Not available'
                    : `${metrics.passCompletionPercentage}%`}
                </strong>
                <span>
                  passes complete · {metrics.completedPasses}/{metrics.passAttempts}
                </span>
              </p>
              <p><strong>{lossCount ?? 'Not available'}</strong><span>recorded pass turnovers</span></p>
              <p><strong>{metrics.finalThirdEntries ?? 'Not available'}</strong><span>final-third entries</span></p>
              <ul className="loss-area-list">
                {Object.entries(metrics.possessionLosses).map(([area, count]) => (
                  <li key={area}>{area.replaceAll('-', ' ')}: {count ?? 'not available'}</li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>
      <p className="evidence-denominator">
        {foundation.possessionDenominatorMinutes} controlled minutes in the denominator ·{' '}
        {foundation.excludedOutOfPlayMinutes} out-of-play minutes excluded ·{' '}
        {foundation.contestedMinutes} contested minutes excluded
        {!foundation.possessionCoverageComplete &&
          ` · incomplete coverage: ${foundation.missingCoveragePeriods.join(', ')}`}
      </p>
      <details className="all-evidence">
        <summary>Data dictionary, coverage, possession sequences, passes and turnovers</summary>
        <p><strong>Source:</strong> {foundation.dataset.source}. Provenance: synthetic. Window: {foundation.windowLabel}.</p>
        <ul className="availability-list">
          {foundation.capabilities.map((capability) => (
            <li key={capability.id} className={capability.status === 'not-recorded' ? 'unavailable' : 'available'}>
              <strong>{capability.label} · {capability.status}</strong>
              <span>{capability.detail}</span>
            </li>
          ))}
        </ul>
        <ul className="metric-definitions">
          {foundation.metricDefinitions.map((definition) => <li key={definition}>{definition}</li>)}
        </ul>
        <h3>Possession sequences</h3>
        <ul className="interval-list">
          {foundation.possessionIntervals.map((interval, index) => (
            <li key={interval.id}>
              <strong>Sequence {index + 1} · {interval.team ?? 'Shared play'} · {interval.status}</strong>
              <span>{interval.start}–{interval.end} · {interval.durationMinutes} minutes{interval.endReason ? ` · ended by ${interval.endReason}` : ''}</span>
            </li>
          ))}
        </ul>
        <h3>Timestamped passes ({foundation.passReferences.length})</h3>
        {referenceList(foundation.passReferences, roster)}
        <details className="all-references technical-record">
          <summary>Technical record · raw pass records with IDs, locations and outcomes</summary>
          <ul className="interval-list">
            {foundation.passRecords.map((pass) => (
              <li key={pass.id}>
                <strong>{pass.id} · {pass.team} · {pass.time} · {pass.outcome}</strong>
                <span>
                  {pass.playerId} → {pass.receiverId} · possession {pass.possessionId} · ({pass.start.x}, {pass.start.y}) to ({pass.end.x}, {pass.end.y}) · {pass.provenance}
                </span>
              </li>
            ))}
          </ul>
        </details>
        <h3>Recorded turnovers ({foundation.turnoverReferences.length})</h3>
        {referenceList(foundation.turnoverReferences, roster)}
        <details className="all-references technical-record">
          <summary>Technical record · raw turnover records and linked pass IDs</summary>
          <ul className="interval-list">
            {foundation.turnoverRecords.map((turnover) => (
              <li key={turnover.id}>
                <strong>{turnover.id} · {turnover.team} · {turnover.time}</strong>
                <span>
                  lost by {turnover.playerId} · pass {turnover.lostPassId} · possession {turnover.possessionId} · ({turnover.location.x}, {turnover.location.y}) · recovered by {turnover.recoveredBy ?? 'not recorded'} · {turnover.provenance}
                </span>
              </li>
            ))}
          </ul>
        </details>
        <h3>Recoveries ({foundation.recoveryReferences.length})</h3>
        {referenceList(foundation.recoveryReferences, roster)}
        <h3>Selected pressure records ({foundation.pressureReferences.length})</h3>
        {referenceList(foundation.pressureReferences, roster)}
        <details className="all-references technical-record">
          <summary>Technical record · build-up annotations (partial selected sample)</summary>
          <ul className="interval-list">
            {foundation.buildUpAnnotations.map((annotation) => (
              <li key={annotation.id}>
                <strong>{annotation.id} · v{annotation.version} · {annotation.phase} · {annotation.team} · {annotation.possessionId}</strong>
                <span>Passes: {annotation.passIds.join(', ') || 'none'} · turnovers: {annotation.turnoverIds.join(', ') || 'none'} · pressure: {annotation.pressureIds.join(', ') || 'none'}</span>
              </li>
            ))}
          </ul>
        </details>
        <h3>Substitutions recorded by selected time ({foundation.substitutions.length})</h3>
        <ul className="interval-list">
          {foundation.substitutions.map((substitution) => (
            <li key={substitution.id}>
              <strong>{substitution.team} · {substitution.time}</strong>
              <span>{nameOf(substitution.playerOnId)} on for {nameOf(substitution.playerOffId)}</span>
            </li>
          ))}
        </ul>
      </details>
      <details className="all-references">
        <summary>View fictional matchday squads and participation</summary>
        {TEAMS.map((team) => (
          <section key={team}>
            <h3>{team} · starting XI</h3>
            <ol className="interval-list">
              {foundation.players
                .filter((player) => player.team === team && player.status === 'starter')
                .map((player) => (
                  <li key={player.id}>
                    <strong>{player.name} · {player.participation.replaceAll('-', ' ')}</strong>
                    <span>{player.minutesInWindow} selected-window minutes · {player.selectedWindowActions} recorded actions</span>
                  </li>
                ))}
            </ol>
            <h3>{team} · substitutes</h3>
            <ol className="interval-list">
              {foundation.players
                .filter((player) => player.team === team && player.status === 'substitute')
                .map((player) => (
                  <li key={player.id}>
                    <strong>{player.name} · {player.participation.replaceAll('-', ' ')}</strong>
                    <span>{player.minutesInWindow} selected-window minutes · {player.selectedWindowActions} recorded actions</span>
                  </li>
                ))}
            </ol>
          </section>
        ))}
      </details>
      </div>
    </details>
  )
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function App() {
  const replay = useMemo(
    () =>
      new ReplayController(MATCH_TIME_OPTIONS, INITIAL_MATCH_TIME, fetchReplayFrame, {
        dwellMs: REPLAY_DWELL_MS,
      }),
    [],
  )
  const replaySnapshot = useSyncExternalStore(
    replay.subscribe,
    replay.getSnapshot,
    replay.getSnapshot,
  )
  const selectedClock = replaySnapshot.requested
  const [period, setPeriod] = useState<AnalysisPeriod>('match-so-far')
  const [opinion, setOpinion] = useState('')
  const [submittedRequest, setSubmittedRequest] = useState<{
    id: number
    context: SubmissionContext
  } | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [shareMessage, setShareMessage] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [view, setView] = useState<'fan' | 'analyst'>('fan')
  const analysisRequestId = useRef(0)
  const answerRef = useRef<HTMLElement>(null)
  const isLoadingSubmit = isLoading && submittedRequest !== null
  const submittedContext = submittedRequest?.context
  const submittedOpinion = submittedContext?.opinion ?? ''
  const hasMovedSinceAnswer = Boolean(
    submittedContext &&
      !isSubmissionScopeCurrent(submittedContext, selectedClock, period),
  )
  const hasUnresolvedSubject = Boolean(analysis?.claims.some(({ claim, assessment }) =>
    claim.subject === null && assessment === 'clarification needed'))
  const periodName = period === 'match-so-far' ? 'Match so far' : 'Last 10 minutes'
  const isSeeking =
    replaySnapshot.status === 'loading' &&
    (replaySnapshot.displayedClock === null ||
      clockKey(replaySnapshot.displayedClock) !== clockKey(selectedClock))
  const suggestions = getQuestionSuggestions(selectedClock)
  const shareModel = useMemo<ShareCardModel | null>(
    () => (analysis && submittedContext ? buildShareCardModel(submittedContext.opinion, analysis) : null),
    [analysis, submittedContext],
  )
  useEffect(() => {
    replay.start()
    return () => replay.dispose()
  }, [replay])

  useEffect(() => {
    if (!submittedRequest) return
    const controller = new AbortController()
    const requestId = submittedRequest.id
    const request = createAnalysisRequest(submittedRequest.context)
    async function loadAnalysis() {
      setIsLoading(true)
      setRequestError('')
      setAnalysis(null)
      setCopyMessage('')
      setShareMessage('')
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(request),
          signal: controller.signal,
        })
        const responseText = await response.text()
        let payload: unknown
        if (responseText) {
          try { payload = JSON.parse(responseText) }
          catch { if (response.ok) throw new Error('The analysis service returned an unreadable answer.') }
        }
        if (!response.ok) {
          const message = typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
            ? payload.error : `The analysis service is unavailable (HTTP ${response.status}).`
          throw new Error(message)
        }
        if (!isAnalysisResponse(payload)) throw new Error('The analysis service returned an incomplete answer.')
        if (isLatestRequest(requestId, analysisRequestId.current)) setAnalysis(payload)
      } catch (error) {
        if (
          !controller.signal.aborted &&
          isLatestRequest(requestId, analysisRequestId.current)
        ) {
          setRequestError(error instanceof Error ? error.message : 'The analysis service could not be reached.')
        }
      } finally {
        if (
          !controller.signal.aborted &&
          isLatestRequest(requestId, analysisRequestId.current)
        ) {
          setIsLoading(false)
        }
      }
    }
    void loadAnalysis()
    return () => controller.abort()
  }, [submittedRequest])

  const [answerBelowFold, setAnswerBelowFold] = useState(false)

  useEffect(() => {
    const node = answerRef.current
    if (!analysis || !node) {
      setAnswerBelowFold(false)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const viewportBottom = entry.rootBounds?.bottom ?? window.innerHeight
        setAnswerBelowFold(!entry.isIntersecting && entry.boundingClientRect.top >= viewportBottom)
      },
      { threshold: 0.1 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [analysis])

  function showAnswer() {
    const node = answerRef.current
    if (!node) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    node.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    node.focus({ preventScroll: true })
  }

  function selectClock(value: string) {
    const nextClock = MATCH_TIME_OPTIONS.find((clock) => clockKey(clock) === value)
    if (nextClock) replay.seek(nextClock)
  }

  function fillQuestion(text: string) {
    setOpinion(text)
    document.getElementById('opinion-input')?.focus()
  }

  function submitOpinion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSeeking) return
    const trimmedOpinion = opinion.trim()
    if (!trimmedOpinion) return
    const id = ++analysisRequestId.current
    setAnalysis(null)
    setRequestError('')
    setSubmittedRequest({
      id,
      context: createSubmissionContext(trimmedOpinion, selectedClock, period),
    })
  }

  function retryAnalysis() {
    if (!submittedContext) return
    const id = ++analysisRequestId.current
    setSubmittedRequest({ id, context: submittedContext })
  }

  async function copyAssessment() {
    if (!analysis) return
    try {
      await navigator.clipboard.writeText(analysis.summary)
      setCopyMessage('Reply copied.')
    } catch {
      setCopyMessage('Select the reply above and copy it manually.')
    }
  }

  async function copyShareCard() {
    if (!shareModel) return
    try {
      await navigator.clipboard.writeText(shareCardText(shareModel))
      setShareMessage('Card text copied.')
    } catch {
      setShareMessage('Clipboard access is unavailable. Select the card text above and copy it manually.')
    }
  }

  async function downloadShareCard() {
    if (!shareModel) return
    const image = createShareCardImage(shareModel)
    const save = (blob: Blob, extension: string) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `groupchat-analyst-card.${extension}`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    try {
      save(await svgToPngBlob(image, 2), 'png')
      setShareMessage(shareModel.extended ? 'Extended card image downloaded.' : 'Card image downloaded.')
    } catch {
      try {
        save(new Blob([image.svg], { type: 'image/svg+xml;charset=utf-8' }), 'svg')
        setShareMessage('Card image downloaded as SVG.')
      } catch {
        setShareMessage('Image download is unavailable. Copy the card text instead.')
      }
    }
  }

  const claimBreakdown = analysis && (
    <div className="claim-result-list">
      {analysis.claims.map((result, index) => <ClaimCard key={result.claim.id} result={result} index={index} roster={analysis.evidenceFoundation.players} />)}
    </div>
  )

  return (
    <main className="page-shell analyst-shell" id="main-content">
      <a className="skip-link" href="#opinion-input">Skip to your take</a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Groupchat Analyst home">
          <span className="brand-mark" aria-hidden="true">g<span>.</span></span>
          <span>Groupchat<span className="brand-light">Analyst</span></span>
        </a>
        <span className="demo-label"><span aria-hidden="true" />Synthetic demo</span>
      </header>

      <section className="analysis-page" aria-labelledby="page-title">
        <div className="page-intro">
          <h1 id="page-title">Big takes? <span>Bring the receipts.</span></h1>
          <p className="intro-description"><span className="intro-long">Drop your football take. Check it against the match. Get the receipts.</span><span className="intro-short">Football takes. Match evidence.</span></p>
        </div>

        <div className="workspace-grid">
          <div className="match-column">
            <MatchHeader
              timeline={MATCH_TIME_OPTIONS}
              snapshot={replaySnapshot}
              keyMoments={KEY_MOMENTS}
              dwellMs={REPLAY_DWELL_MS}
              onSeek={(clock) => replay.seek(clock)}
              onStep={(direction) => replay.step(direction)}
              onPlay={() => replay.play()}
              onPause={() => replay.pause()}
              onRetry={() => replay.retry()}
            />
          </div>
          <div className="conversation-column">
            <form className="opinion-form" onSubmit={submitOpinion}>
              <label className="opinion-label" htmlFor="opinion-input">What’s your take?</label>
              <textarea
                id="opinion-input" value={opinion} onChange={(event) => setOpinion(event.currentTarget.value)}
                placeholder="Ask about this moment, e.g. How many shots did Eastport have?"
                rows={3} required aria-describedby="input-hint"
              />
              <div className="composer-bottom">
                <div className="scope-summary">
                  <span>Asking about <strong>{formatMatchClock(selectedClock)}</strong> · {periodName}</span>
                  <details className="context-controls">
                    <summary>Change</summary>
                    <div className="analysis-controls">
                      <label className="time-control" htmlFor="match-time">
                        <span className="control-label">Match time</span>
                        <select id="match-time" value={clockKey(selectedClock)} onChange={(event) => selectClock(event.currentTarget.value)}>
                          <optgroup label="First half">{MATCH_TIME_OPTIONS.filter((clock) => clock.period === 1).map((clock) => <option key={clockKey(clock)} value={clockKey(clock)}>{formatMatchClock(clock)}</option>)}</optgroup>
                          <optgroup label="Second half">{MATCH_TIME_OPTIONS.filter((clock) => clock.period === 2).map((clock) => <option key={clockKey(clock)} value={clockKey(clock)}>{formatMatchClock(clock)}</option>)}</optgroup>
                        </select>
                      </label>
                      <fieldset className="period-control">
                        <legend className="control-label">Evidence period</legend>
                        <div className="period-options">
                          <button className={period === 'match-so-far' ? 'selected' : ''} type="button" aria-pressed={period === 'match-so-far'} onClick={() => setPeriod('match-so-far')}>Match so far</button>
                          <button className={period === 'last-10-minutes' ? 'selected' : ''} type="button" aria-pressed={period === 'last-10-minutes'} onClick={() => setPeriod('last-10-minutes')}>Last 10 minutes</button>
                        </div>
                      </fieldset>
                    </div>
                  </details>
                </div>
                <button className="check-button" type="submit" disabled={isLoadingSubmit || isSeeking}>
                  {isLoadingSubmit ? 'Checking…' : isSeeking ? 'Moving…' : 'Check this moment'}<ArrowIcon />
                </button>
              </div>
              <div className="suggestions" role="group" aria-label="Suggested questions">
                <span>Try asking</span>
                {suggestions.map((question) => (
                  <button key={question.id} type="button" onClick={() => fillQuestion(question.text)}>{question.text}</button>
                ))}
              </div>
              <p className="input-hint" id="input-hint">Synthetic match: every performance and result is invented.</p>
            </form>

            <div className="answer-region" aria-live="polite" aria-busy={isLoadingSubmit}>
              {isLoadingSubmit && submittedOpinion && <p className="loading-state"><span className="loading-dot" aria-hidden="true" />Checking the submitted match moment…</p>}
              {requestError && (
                <div className="api-error" role="alert">
                  <strong>We couldn’t check that take.</strong><p>{requestError}</p>
                  <button className="secondary-button" type="button" onClick={retryAnalysis}>Try again</button>
                </div>
              )}
              {analysis && submittedContext && (
                <section className="claim-assessments" aria-labelledby="result-title" ref={answerRef} tabIndex={-1}>
                  <div className="result-title-row">
                    <h2 id="result-title">The answer</h2>
                    <div className="segmented-control view-control" role="group" aria-label="Answer detail" aria-describedby="detail-help">
                      <button type="button" aria-pressed={view === 'fan'} onClick={() => setView('fan')}>Fan</button>
                      <button type="button" aria-pressed={view === 'analyst'} onClick={() => setView('analyst')}>Analyst</button>
                    </div>
                  </div>
                  <p className="detail-help" id="detail-help">
                    {view === 'fan'
                      ? 'Fan view keeps the reasoning folded away. Analyst view opens it. The answer, verdict and limitations are the same in both.'
                      : 'Analyst view opens the reasoning, evidence and pass map. The answer, verdict and limitations are the same as in Fan view.'}
                  </p>
                  <p className="checked-question">{submittedOpinion}</p>
                  {opinion.trim() !== submittedOpinion && <p className="draft-notice">This reply is for the take above. Check your edited wording to update it.</p>}
                  {hasMovedSinceAnswer && <p className="stale-answer-notice" role="status">This reply is for {formatMatchClock(submittedContext.selectedClock)} · {submittedContext.period === 'match-so-far' ? 'Match so far' : 'Last 10 minutes'}. The replay is now at {formatMatchClock(selectedClock)}; this earlier answer has not been recalculated for the current moment.</p>}
                  <p className="server-summary">{analysis.summary}</p>
                  <div className="answer-attribution"><span>Synthetic match</span><span>Submitted at {formatMatchClock(submittedContext.selectedClock)}</span><span>{submittedContext.period === 'match-so-far' ? 'Match so far' : 'Last 10 minutes'}</span><span>{analysis.provider === 'local' ? 'Local rules · no model connection' : 'Foundry · server-side interpretation'}</span></div>
                  <div className="visible-limitations">
                    {analysis.claims.flatMap((result) => [
                      ...result.claim.clarificationNeeds.map((need) => ({
                        key: `${result.claim.id}-${need}`,
                        text: need,
                        title: 'Clarification',
                      })),
                      ...(isGenericStatisticsLimitation(result)
                        ? []
                        : [{ key: `${result.claim.id}-limitation`, text: result.limitation, title: 'Limitation' }]),
                    ])
                      .map((item) => <p key={item.key}><strong>{item.title}:</strong> {item.text}</p>)}
                    {analysis.claims.length === 0 && (
                      <p><strong>Limitation:</strong> The request was not interpreted as a supported claim.</p>
                    )}
                  </div>
                  <div className="share-row">
                    <button className="copy-button" type="button" onClick={copyAssessment}>Copy reply <ArrowIcon /></button>
                    <button className="secondary-button" type="button" onClick={copyShareCard}>Copy card text</button>
                    <button className="secondary-button" type="button" onClick={downloadShareCard}>{shareModel?.extended ? 'Download extended card' : 'Download card image'}</button>
                    <span role="status">{[copyMessage, shareMessage].filter(Boolean).join(' ')}</span>
                  </div>
                  {shareModel && (
                    <details className="share-preview">
                      <summary>Preview share card</summary>
                      <section className={`share-card${shareModel.extended ? ' is-extended' : ''}`} aria-label="Shareable card preview">
                        {shareCardBlocks(shareModel).map((block, index) => (
                          <p key={index} className={`share-block share-${block.kind}`}>{block.kind === 'bullet' && <span aria-hidden="true">• </span>}{block.text}</p>
                        ))}
                      </section>
                    </details>
                  )}
                  {analysis.claims.length > 0 ? view === 'fan' ? (
                    <details className="answer-breakdown"><summary>Check the reasoning <span>{analysis.claims.length} {analysis.claims.length === 1 ? 'claim' : 'claims'}</span></summary>{claimBreakdown}</details>
                  ) : <div className="analyst-breakdown"><p className="section-label">CLAIMS & EVIDENCE</p>{claimBreakdown}</div>
                  : <p className="empty-evidence">Try naming a team or player and the part of the match you mean.</p>}
                </section>
              )}
            </div>

            {analysis && view === 'analyst' && !hasUnresolvedSubject && <PassMap key={`${clockKey(submittedContext?.selectedClock ?? selectedClock)}-${submittedContext?.period ?? period}`} foundation={analysis.evidenceFoundation} />}
            {analysis && !hasUnresolvedSubject && <EvidenceFoundationPanel foundation={analysis.evidenceFoundation} />}
            {analysis && !hasUnresolvedSubject && (
              <details className="all-evidence match-events"><summary>Explore match events <span>{analysis.periodEvents.length} recorded</span></summary>{referenceList(analysis.periodEvents, analysis.evidenceFoundation.players)}</details>
            )}
            {analysis && (
              <details className="player-picker">
                <summary>Ask about a player</summary>
                <label htmlFor="player-select">Fictional matchday squad</label>
                <select id="player-select" value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.currentTarget.value)}>
                  <option value="">Choose a player</option>
                  {TEAMS.map((team) => <optgroup key={team} label={team}>{analysis.evidenceFoundation.players.filter((player) => player.team === team).map((player) => <option key={player.id} value={player.id}>{player.name} · {player.status === 'starter' ? 'starter' : 'substitute'}</option>)}</optgroup>)}
                </select>
                <button className="secondary-button" type="button" disabled={!selectedPlayerId} onClick={() => {
                  const player = analysis.evidenceFoundation.players.find(({ id }) => id === selectedPlayerId)
                  if (player) fillQuestion(`How did ${player.name} perform?`)
                }}>Use this player <ArrowIcon /></button>
              </details>
            )}
          </div>
        </div>


        <details className="about-demo">
          <summary>About this demo & its data</summary>
          <div>
            <p>Northbridge and Eastport are fictional teams using real-player names. Every performance and result is invented.</p>
            <p>{analysis?.provider === 'foundry' ? `${analysis.providerLabel}. Statistics are still calculated by the application, not by AI.` : analysis?.provider === 'local' ? 'This server is using limited local rules to read questions, with no model connection. It understands a small set of football phrasings.' : 'The analysis service has not yet reported how it reads questions.'}</p>
            <p>Match statistics use the selected time and evidence period. Possession uses recorded controlled time only; contested and out-of-play time are excluded. Build-up and pressure observations cover selected samples.</p>
            <p>Player tracking, video, running distance, defensive shape and calibrated expected goals are not recorded. A missing measurement is not a zero.</p>
            <p>First-half stoppage time is 45+N′; second-half stoppage is 90+N′. Recent-minute windows exclude half-time. Historical “before” periods exclude the anchored event and all later events.</p>
          </div>
        </details>
      </section>
      <footer className="site-footer"><span>Football opinions. A fuller picture.</span><span className="footer-label">{analysis?.provider === 'foundry' ? 'Foundry interpretation' : analysis?.provider === 'local' ? 'Local rules demo' : 'Demo match analysis'}</span></footer>
      {answerBelowFold && (
        <div className="answer-ready" role="status">
          <button type="button" onClick={showAnswer}>Answer ready <span aria-hidden="true">↓</span></button>
        </div>
      )}
    </main>
  )
}

export default App
