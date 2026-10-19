import { useEffect, useState, type FormEvent } from 'react'
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
  type MatchTeam,
} from '../../shared/src/matchClock'
import './App.css'

const MATCH_TIME_OPTIONS = getMatchTimeOptions()
const INITIAL_MATCH_TIME: MatchClock = {
  period: 2,
  minute: 90,
  stoppageMinutes: 4,
}

function clockKey(clock: MatchClock): string {
  return `${clock.period}-${clock.minute}-${clock.stoppageMinutes ?? 0}`
}

function isAnalysisResponse(value: unknown): value is AnalysisResponse {
  if (typeof value !== 'object' || value === null) return false
  return (
    'provider' in value &&
    (value.provider === 'local' || value.provider === 'foundry') &&
    'claims' in value &&
    Array.isArray(value.claims) &&
    'periodEvents' in value &&
    Array.isArray(value.periodEvents) &&
    'score' in value &&
    typeof value.score === 'object' &&
    value.score !== null
  )
}

function referenceList(references: EvidenceReference[]) {
  if (references.length === 0) {
    return <p className="empty-evidence">No matching event references in this section.</p>
  }

  return (
    <ul className="claim-reference-list">
      {references.map((reference) => (
        <li key={reference.id}>
          <span className="reference-time">{reference.time}</span>
          <span className="reference-description">
            <strong>{reference.team}</strong>
            <span>{reference.description}</span>
            <small>
              {reference.id} · {reference.time}
            </small>
          </span>
        </li>
      ))}
    </ul>
  )
}

function metricLabel(metric: string): string {
  if (metric === 'shots-on-target') return 'shots on target'
  return metric
}

function evidenceLabel(kind: string): string {
  return kind.replaceAll('-', ' ')
}

function ClaimCard({
  result,
  index,
}: {
  result: ClaimResult
  index: number
}) {
  const claim = result.claim
  const titleId = `claim-result-${index}`
  const supporting = result.evidence
    .filter(({ role }) => role === 'supporting')
    .map(({ reference }) => reference)
  const challenging = result.evidence
    .filter(({ role }) => role === 'challenging')
    .map(({ reference }) => reference)
  const contextual = result.evidence
    .filter(({ role }) => role === 'context')
    .map(({ reference }) => reference)
  const needsSubjectClarification =
    claim.subject === null && result.assessment === 'clarification needed'

  return (
    <article className="claim-result" aria-labelledby={titleId}>
      <h3 className="claim-number" id={titleId}>
        Claim {index + 1}
      </h3>
      <div className="claim-understanding">
        <p>
          <span>Subject</span>
          <strong>{claim.subject ?? 'Needs clarification'}</strong>
        </p>
        <p>
          <span>Claim</span>
          <strong>{claim.text}</strong>
        </p>
        <p>
          <span>Interpreted meaning</span>
          <strong>{claim.meaning.description}</strong>
        </p>
        <p>
          <span>Evidence period</span>
          <strong>{result.periodLabel}</strong>
        </p>
        {claim.historicalEventAnchor && (
          <p>
            <span>Historical anchor</span>
            <strong>{claim.historicalEventAnchor.relationship}</strong>
          </p>
        )}
      </div>

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
                  {statistic.value} {metricLabel(statistic.metric)}
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

      {!needsSubjectClarification && (
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
            {claim.meaning.category === 'factual-comparison' ? (
              <div className="evidence-columns">
                <section className="evidence-group">
                  <h3>Supporting evidence</h3>
                  {referenceList(supporting)}
                </section>
                <section className="evidence-group counter-group">
                  <h3>Challenging evidence</h3>
                  {referenceList(challenging)}
                </section>
              </div>
            ) : (
              <>
                <h3>Relevant retrieved events</h3>
                <p className="evidence-group-summary">
                  These fixture events provide context for this opinion; they do not prove a subjective assessment.
                </p>
                {referenceList(contextual)}
              </>
            )}
            {claim.historicalEventAnchor && (
              <div className="historical-anchor-evidence">
                <strong>Goal anchor, outside the before-goal evidence period</strong>
                {referenceList(
                  result.evidence
                    .filter(({ role }) => role === 'anchor')
                    .map(({ reference }) => reference),
                )}
              </div>
            )}
            <details className="all-references">
              <summary>All {result.evidence.length} claim evidence references</summary>
              <ul className="claim-reference-list">
                {result.evidence.map(({ role, reference }) => (
                  <li key={`${role}-${reference.id}`}>
                    <span className="reference-time">{reference.time}</span>
                    <span className="reference-description">
                      <strong>{reference.team} · {role}</strong>
                      <span>{reference.description}</span>
                      <small>{reference.id} · {reference.time}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        </>
      )}

      {!needsSubjectClarification && (
        <p className="assessment-limitation">
          <strong>What remains unknown:</strong> {result.limitation}
        </p>
      )}
      {needsSubjectClarification && (
        <p className="assessment-limitation">
          Resolve the subject to retrieve relevant evidence for this claim.
        </p>
      )}
    </article>
  )
}

function App() {
  const [selectedClock, setSelectedClock] = useState(INITIAL_MATCH_TIME)
  const [period, setPeriod] = useState<AnalysisPeriod>('match-so-far')
  const [opinion, setOpinion] = useState('')
  const [submittedOpinion, setSubmittedOpinion] = useState('')
  const [submissionVersion, setSubmissionVersion] = useState(0)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [requestError, setRequestError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const hasUnresolvedSubject = Boolean(
    analysis?.claims.some(
      ({ claim, assessment }) =>
        claim.subject === null && assessment === 'clarification needed',
    ),
  )
  const clockKeyForSelection = clockKey(selectedClock)

  useEffect(() => {
    const controller = new AbortController()
    async function loadAnalysis() {
      setIsLoading(true)
      setRequestError('')
      setAnalysis(null)

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            opinion: submittedOpinion,
            selectedClock,
            period,
          }),
          signal: controller.signal,
        })
        const responseText = await response.text()
        let payload: unknown
        if (responseText) {
          try {
            payload = JSON.parse(responseText)
          } catch {
            if (response.ok) {
              throw new Error('The analysis API returned invalid JSON.')
            }
          }
        }
        if (!response.ok) {
          const message =
            typeof payload === 'object' &&
            payload !== null &&
            'error' in payload &&
            typeof payload.error === 'string'
              ? payload.error
              : `The analysis service is unavailable (HTTP ${response.status}).`
          throw new Error(message)
        }
        if (!isAnalysisResponse(payload)) {
          throw new Error('The analysis API returned an invalid response.')
        }
        setAnalysis(payload)
      } catch (error) {
        if (controller.signal.aborted) return
        setRequestError(
          error instanceof Error
            ? `${error.message} Start the local Azure Functions API and try again.`
            : 'The local analysis API could not be reached. Start it and try again.',
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadAnalysis()
    return () => controller.abort()
  }, [period, selectedClock, submittedOpinion, submissionVersion])

  function selectClock(value: string) {
    const nextClock = MATCH_TIME_OPTIONS.find((clock) => clockKey(clock) === value)
    if (nextClock) setSelectedClock(nextClock)
  }

  function submitOpinion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedOpinion = opinion.trim()
    if (!trimmedOpinion) return
    setSubmittedOpinion(trimmedOpinion)
    setSubmissionVersion((version) => version + 1)
    setCopyMessage('')
  }

  async function copyAssessment() {
    if (!analysis) return
    try {
      await navigator.clipboard.writeText(
        `Groupchat Analyst · Synthetic match demonstration\nNorthbridge ${analysis.score.Northbridge}–${analysis.score.Eastport} Eastport at ${analysis.selectedTime}\n\n${analysis.summary}`,
      )
      setCopyMessage('Assessment copied.')
    } catch {
      setCopyMessage('Could not copy automatically. Select and copy the summary instead.')
    }
  }

  return (
    <main className="page-shell analyst-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Groupchat Analyst home">
          <span className="brand-mark" aria-hidden="true">G</span>
          <span>Groupchat Analyst</span>
        </a>
        <span className="project-status">A matchday companion</span>
      </header>

      <section className="analysis-page" aria-labelledby="page-title">
        <div className="page-intro">
          <p className="eyebrow">
            <span className="status-dot" aria-hidden="true" />
            Synthetic match demonstration
          </p>
          <h1 id="page-title">Bring your take. Check the evidence.</h1>
          <p className="intro-description">
            The server interprets each claim, retrieves its relevant match events,
            calculates recorded statistics, and shows what the fixture cannot establish.
          </p>
        </div>

        <section className="match-card" aria-labelledby="match-title">
          <div className="match-heading">
            <div>
              <p className="card-kicker">Synthetic Premier Division · 2025/26</p>
              <h2 id="match-title">Northbridge vs Eastport</h2>
            </div>
            <span className="synthetic-badge"><span aria-hidden="true" />Fictional match</span>
          </div>

          {analysis ? (
            <>
              <div className="scoreboard" aria-live="polite">
                <span className="score-team">Northbridge</span>
                <span className="score">
                  {analysis.score.Northbridge}<span aria-hidden="true">–</span>
                  {analysis.score.Eastport}
                </span>
                <span className="score-team">Eastport</span>
                <span className="score-clock">Score at {analysis.selectedTime}</span>
              </div>

              <div className="results-heading">
                <div>
                  <p className="card-kicker">Calculated by the API from fixture events</p>
                  <h2>Selected-period statistics</h2>
                </div>
                <span className="event-count">{analysis.periodEvents.length} recorded events</span>
              </div>
              <div className="team-stats">
                {TEAMS.map((team: MatchTeam) => {
                  const stats = analysis.periodStatistics[team]
                  return (
                    <article className="team-stat-card" key={team}>
                      <h3>{team}</h3>
                      <div className="team-stat-values">
                        <p><strong>{stats.shots}</strong><span>shots</span></p>
                        <p><strong>{stats.shotsOnTarget}</strong><span>on target</span></p>
                        <p><strong>{stats.goals}</strong><span>goals</span></p>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="api-status" role={requestError ? 'alert' : 'status'}>
              {requestError || (isLoading ? 'Loading server-calculated match data…' : '')}
            </p>
          )}

          <div className="analysis-controls">
            <label className="time-control" htmlFor="match-time">
              <span className="control-label">Match time</span>
              <select
                id="match-time"
                value={clockKeyForSelection}
                onChange={(event) => selectClock(event.currentTarget.value)}
              >
                <optgroup label="First half">
                  {MATCH_TIME_OPTIONS.filter((clock) => clock.period === 1).map((clock) => (
                    <option key={clockKey(clock)} value={clockKey(clock)}>
                      {formatMatchClock(clock)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Second half">
                  {MATCH_TIME_OPTIONS.filter((clock) => clock.period === 2).map((clock) => (
                    <option key={clockKey(clock)} value={clockKey(clock)}>
                      {formatMatchClock(clock)}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <fieldset className="period-control">
              <legend className="control-label">Evidence period</legend>
              <div className="period-options">
                <button
                  className={period === 'match-so-far' ? 'selected' : ''}
                  type="button"
                  aria-pressed={period === 'match-so-far'}
                  onClick={() => setPeriod('match-so-far')}
                >
                  Match so far
                </button>
                <button
                  className={period === 'last-10-minutes' ? 'selected' : ''}
                  type="button"
                  aria-pressed={period === 'last-10-minutes'}
                  onClick={() => setPeriod('last-10-minutes')}
                >
                  Last 10 minutes
                </button>
              </div>
            </fieldset>
          </div>

          <p className="context-caption">
            The server uses the selected match time and period; the browser sends no event data or statistics.
          </p>

          <form className="opinion-form" onSubmit={submitOpinion}>
            <label className="opinion-label" htmlFor="opinion-input">What&apos;s your take?</label>
            <textarea
              id="opinion-input"
              value={opinion}
              onChange={(event) => setOpinion(event.currentTarget.value)}
              placeholder="Eastport controlled possession of the game, Northbridge scored against the run of play."
              rows={3}
              required
            />
            <div className="opinion-submit-row">
              <p className="input-hint">
                The default server interpreter uses limited local rules. Microsoft Foundry is prepared but not connected.
              </p>
              <button className="check-button" type="submit" disabled={isLoading}>
                {isLoading ? 'Checking…' : 'Check the evidence'}
              </button>
            </div>
          </form>

          {analysis && submittedOpinion && (
            <section className="claim-assessments" aria-labelledby="result-title" aria-live="polite">
              <div className="result-title-row">
                <div>
                  <p className="card-kicker">{analysis.providerLabel}</p>
                  <h2 id="result-title">Your claim assessment</h2>
                </div>
                <span className="result-period">{analysis.selectedPeriodLabel}</span>
              </div>
              <p className="server-summary">{analysis.summary}</p>
              <div className="claim-result-list">
                {analysis.claims.map((result, index) => (
                  <ClaimCard key={result.claim.id} result={result} index={index} />
                ))}
              </div>
              {analysis.claims.length === 0 && (
                <p className="empty-evidence">No claim could be interpreted from this opinion.</p>
              )}
              <div className="share-row">
                <button className="copy-button" type="button" onClick={copyAssessment}>
                  Copy shareable summary
                </button>
                <span role="status" aria-live="polite">{copyMessage}</span>
              </div>
            </section>
          )}

          {analysis && !hasUnresolvedSubject && (
            <details className="all-evidence">
              <summary>All events in the selected evidence period ({analysis.periodEvents.length})</summary>
              {referenceList(analysis.periodEvents)}
            </details>
          )}
          {requestError && analysis && <p className="api-error" role="alert">{requestError}</p>}
        </section>

        <p className="analysis-footnote">
          Fictional synthetic data only. Statistics and evidence are calculated server-side from the fixture.
          Goals are shot outcomes. First-half stoppage time is shown as 45+N; the last-10-minutes window
          excludes half-time and includes both endpoints. Historical “before” periods exclude the anchored
          event itself and all later events. Possession, territorial-control, player, and passing data are
          absent from the fixture.
        </p>
      </section>

      <footer className="site-footer">
        <span>Good debates leave room for the full picture.</span>
        <span className="footer-label"><span className="footer-dot" aria-hidden="true" />Prototype in progress</span>
      </footer>
    </main>
  )
}

export default App
