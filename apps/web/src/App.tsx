import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type RefObject,
} from 'react'
import type {
  AnalysisResponse,
  ClaimResult,
  EvidenceReference,
  PlayerResolutionOption,
} from '../../shared/src/apiContracts'
import {
  formatMatchClock,
  getMatchTimeOptions,
  type AnalysisPeriod,
  type MatchClock,
  type MatchTeam,
} from '../../shared/src/matchClock'
import { MatchHeader, type KeyMoment } from './MatchHeader'
import { PassMap } from './PassMap'
import { requestAnalysis } from './analysisClient'
import {
  createAnalysisRequest,
  createSubmissionContext,
  isLatestRequest,
  isSubmissionScopeCurrent,
  type SubmissionContext,
} from './matchday'
import {
  buildShareCardModel,
  canonicalReply,
  CONTEXT_ONLY_LABEL,
  blocksToText,
  describeEvidence,
  describePeriodLabel,
  isRoutineLimitation,
  isUnsupportedJudgement,
  shareCardBlocks,
  type ShareCardModel,
} from './presentation'
import {
  buildChangeCard,
  changeCardText,
  checkedAgainst,
  compareSnapshots,
  createSnapshot,
  isLaterClock,
  needsPassMap,
  snapshotReply,
  type AnswerSnapshot,
  type ChangeCard,
  type Comparison,
} from './investigation'
import { createBlocksImage, svgToPngBlob, type ShareCardImage } from './shareCardImage'
import { DEMO_CLOCK, DEMO_ENTRY_LABEL, DEMO_NEXT_CLOCK, DEMO_TAKE, demoStep, isRelevantAnswer } from './guidedDemo'
import { imageKey, shareReceipts, supportsFileShare, type PreparedImage } from './nativeShare'
import { fetchReplayFrame } from './replayApi'
import { clockKey, ReplayController } from './replayController'
import { findCatalogEntry, BASELINE_DATASET_ID, type DatasetExample } from '../../shared/src/datasetCatalog'
import { localizedExample, translateNarrative, translateText } from '../../shared/src/localization'
import { localizeMatchText, localizedPlayerName } from '../../shared/src/displayNames'
import { LanguageSelector, LocalizedMarkup } from './localization'
import { useLocalization } from './localizationContext'
import './App.css'
import './matchday.css'

const MATCH_TIME_OPTIONS = getMatchTimeOptions()
const REPLAY_DWELL_MS = 900
const INITIAL_MATCH_TIME: MatchClock = {
  period: 1,
  minute: 1,
}

type RequestOperation =
  | { kind: 'analysis' }
  | {
      kind: 'resolve-player'
      continuation: string
      claimId: string
      playerId: string
      snapshotId: number
    }
  | { kind: 'recheck-resolved-player'; continuation: string }

type SubmittedRequest = {
  id: number
  context: SubmissionContext
  baseline: AnswerSnapshot | null
  operation: RequestOperation
}

function isPlayerResolutionOption(value: unknown): value is PlayerResolutionOption {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'team' in value &&
    typeof value.team === 'string'
  )
}

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
    (!('playerResolutionContinuation' in value) ||
      typeof value.playerResolutionContinuation === 'string') &&
    (!('selectedPlayers' in value) ||
      (Array.isArray(value.selectedPlayers) &&
        value.selectedPlayers.every(isPlayerResolutionOption))) &&
    (!('fanReply' in value) || value.fanReply === undefined || typeof value.fanReply === 'string') &&
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
        Array.isArray(claim.playerCalculations) &&
        (!('reply' in claim) || typeof claim.reply === 'string') &&
        (!('playerResolution' in claim) ||
          (typeof claim.playerResolution === 'object' &&
            claim.playerResolution !== null &&
            'continuation' in claim.playerResolution &&
            typeof claim.playerResolution.continuation === 'string' &&
            'candidates' in claim.playerResolution &&
            Array.isArray(claim.playerResolution.candidates) &&
            claim.playerResolution.candidates.length > 1 &&
            claim.playerResolution.candidates.every(isPlayerResolutionOption))),
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
      <TechnicalRecord references={references} roster={roster} />
    </>
  )
}

function TechnicalRecord({
  references,
  roster,
}: {
  references: EvidenceReference[]
  roster: Roster
}) {
  return (
    <LocalizedMarkup>
      <details className="technical-record">
        <summary>Technical record · IDs and original source wording (English)</summary>
        <p>The descriptions above are localized. The records below retain original English source wording.</p>
        <ul>
          {references.map((reference) => (
            <li key={reference.id}>
              <code>{reference.id}</code> · {reference.time} · {reference.team}
              <p>{describeEvidence(reference.description, roster)}</p>
              <p>
                <strong>Original source wording (English):</strong>{' '}
                <span data-original-source="true">{reference.description}</span>
              </p>
            </li>
          ))}
        </ul>
      </details>
    </LocalizedMarkup>
  )
}

function metricLabel(
  metric: string,
  language: ReturnType<typeof useLocalization>['language'],
  value?: number,
): string {
  const label = metric === 'shots-on-target' ? 'shots on target'
    : metric === 'possession-percentage' ? 'possession'
      : metric === 'pass-completion-percentage' ? 'pass completion'
        : metric === 'pass-attempts' ? 'pass attempts'
          : metric === 'pass-completions' ? 'pass completions'
            : metric === 'minutes-played' ? 'elapsed participation minutes (recorded window; added time included)'
              : metric === 'recoveries' ? 'recorded recoveries'
                : metric === 'pressure-observations' ? 'selected pressure observations'
                  : metric.replaceAll('-', ' ')
  if (language === 'ar' && value !== undefined && !metric.includes('percentage')) {
    const countedLabel = translateNarrative(`${value} ${label}`, language)
    const prefix = `${value} `
    if (countedLabel.startsWith(prefix)) return countedLabel.slice(prefix.length)
  }
  return translateText(label, language)
}

function evidenceLabel(
  kind: string,
  language: ReturnType<typeof useLocalization>['language'],
): string {
  return translateText(kind.replaceAll('-', ' '), language)
}

function ClaimCard({
  result,
  index,
  roster,
  take,
  datasetId,
}: {
  result: ClaimResult
  index: number
  roster: Roster
  take?: string
  datasetId: string
}) {
  const { language } = useLocalization()
  const claim = result.claim
  const titleId = `claim-result-${index}`
  const contextOnly = isUnsupportedJudgement(result)
  return (
    <LocalizedMarkup>
    <article className="claim-result" aria-labelledby={titleId}>
      <h3 className="claim-number" id={titleId}>
        Claim {index + 1}
      </h3>
      <p className="claim-display" data-original-opinion="true">{take ?? claim.text}</p>
      <div className="assessment-summary">
        <span
          className={`assessment-badge ${result.assessment.replaceAll(' ', '-')}`}
        >
          {result.assessment}
        </span>
        {contextOnly && result.statistics.length > 0 && (
          <p className="context-only-note">{CONTEXT_ONLY_LABEL}</p>
        )}
        {result.statistics.length > 0 && (
          <div className="broad-stats">
            {result.statistics.map((statistic) => (
              <p key={`${statistic.team}-${statistic.metric}`}>
                <strong>{statistic.team}</strong>
                <span>
                  {statistic.value === null
                    ? 'Not available'
                    : `${statistic.value}${statistic.metric.includes('percentage') ? '%' : ''}`}{' '}
                  {metricLabel(statistic.metric, language, statistic.value ?? undefined)}
                </span>
              </p>
            ))}
          </div>
        )}
        {result.playerStatistics.length > 0 && (
          <div className="broad-stats" aria-label="Player statistics">
            {result.playerStatistics.map((statistic) => (
              <p key={`${statistic.playerId}-${statistic.metric}`}>
                <strong>{localizedPlayerName(
                        datasetId,
                        statistic.playerId,
                        statistic.playerName,
                        language,
                      )}</strong>
                <span>
                  {statistic.value === null
                    ? 'Not available'
                    : `${statistic.value}${statistic.metric.includes('percentage') ? '%' : ''}`}{' '}
                  {metricLabel(statistic.metric, language, statistic.value ?? undefined)}
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
                    {evidenceLabel(item.kind, language)} · {item.available ? 'available' : 'not recorded'}
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
              <h3>{translateNarrative(`All ${result.evidence.length} claim evidence references`, language)}</h3>
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
              <TechnicalRecord
                references={result.evidence.map(({ reference }) => reference)}
                roster={roster}
              />
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
                  <h4>{trace.playerName} · {trace.metric === 'minutes-played' ? 'participation within recorded window' : trace.metric.replaceAll('-', ' ')}</h4>
                  <p>
                    {trace.metric === 'minutes-played'
                      ? `${trace.value ?? 0} ${translateText('elapsed minutes', language)}`
                      : trace.metric === 'pass-completion-percentage'
                      ? `${trace.numerator}/${trace.denominator} (${trace.value === null ? 'rate not available' : `${trace.value}%`})`
                      : trace.metric === 'pass-completions'
                        ? `${trace.numerator} completions among ${trace.denominator} attempts`
                        : `${trace.value ?? trace.numerator} ${metricLabel(trace.metric, language, trace.value ?? trace.numerator)}`}
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
    </LocalizedMarkup>
  )
}

function PlayerResolutionPicker({
  result,
  busy,
  requestError,
  onChoose,
  onRetry,
}: {
  result: ClaimResult
  busy: boolean
  requestError: string
  onChoose: (claimId: string, continuation: string, playerId: string) => void
  onRetry: () => void
}) {
  const { language } = useLocalization()
  const resolution = result.playerResolution
  if (!resolution) return null
  return (
    <LocalizedMarkup>
      <section className="player-resolution-picker" aria-label="Player clarification">
        <p>{translateText('Choose a player', language)}</p>
        <div className="player-choice-buttons">
          {resolution.candidates.map((candidate) => (
            <button
              className="secondary-button"
              type="button"
              key={candidate.id}
              disabled={busy}
              onClick={() =>
                onChoose(result.claim.id, resolution.continuation, candidate.id)
              }
            >
              <bdi dir="auto">{candidate.name}</bdi>
              <span> · </span>
              <bdi dir="auto">{candidate.team}</bdi>
            </button>
          ))}
        </div>
        {busy && (
          <p role="status">{translateText('Resolving your selection…', language)}</p>
        )}
        {requestError && !busy && (
          <div role="alert">
            <p>{translateText('Player selection failed.', language)}</p>
            <details className="msg-evidence">
              <summary>{translateText('Details', language)}</summary>
              <p>{translateNarrative(requestError, language)}</p>
            </details>
            <button className="secondary-button" type="button" onClick={onRetry}>
              {translateText('Try again', language)}
            </button>
          </div>
        )}
      </section>
    </LocalizedMarkup>
  )
}

function EvidenceFoundationPanel({
  foundation,
  selectedPeriodLabel,
}: {
  foundation: AnalysisResponse['evidenceFoundation']
  selectedPeriodLabel: string
}) {
  const roster = foundation.players
  const nameOf = (id: string) => roster.find((player) => player.id === id)?.name ?? 'Unrecorded player'
  return (
    <LocalizedMarkup>
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
        {(Object.keys(foundation.teams) as MatchTeam[]).map((team) => {
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
        {(Object.keys(foundation.teams) as MatchTeam[]).map((team) => (
          <section key={team}>
            <h3>{team} · starting XI</h3>
            <ol className="interval-list">
              {foundation.players
                .filter((player) => player.team === team && player.status === 'starter')
                .map((player) => (
                  <li key={player.id}>
                    <strong>{player.name} · {player.participation.replaceAll('-', ' ')}</strong>
                    <span>{player.minutesInWindow} elapsed participation minutes within {selectedPeriodLabel} (added time included) · {player.selectedWindowActions} recorded actions</span>
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
                    <span>{player.minutesInWindow} elapsed participation minutes within {selectedPeriodLabel} (added time included) · {player.selectedWindowActions} recorded actions</span>
                  </li>
                ))}
            </ol>
          </section>
        ))}
      </details>
      </div>
    </details>
    </LocalizedMarkup>
  )
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

// Renders the same PNG as the download ahead of time so the final Share tap keeps its user activation.
// The result is keyed by card content, so a changed answer or comparison can never reuse an old image.
function usePreparedImage(enabled: boolean, key: string | null, image: ShareCardImage | null, fileName: string): PreparedImage | null {
  const [prepared, setPrepared] = useState<PreparedImage | null>(null)
  useEffect(() => {
    if (!enabled || !key || !image) return
    let cancelled = false
    svgToPngBlob(image, 2)
      .then((blob) => {
        if (!cancelled) setPrepared({ key, file: new File([blob], fileName, { type: 'image/png' }) })
      })
      .catch(() => {
        if (!cancelled) setPrepared(null)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, key, image, fileName])
  return enabled && prepared && prepared.key === key ? prepared : null
}

function WhatChanged({
  comparison,
  view,
  changeCard,
  onCopy,
  onDownload,
  onShare,
  shareReady,
}: {
  comparison: { earlier: AnswerSnapshot; later: AnswerSnapshot; result: Comparison }
  view: 'fan' | 'analyst'
  changeCard: ChangeCard | null
  onCopy: () => void
  onDownload: () => void
  onShare: (() => void) | null
  shareReady: boolean
}) {
  const { earlier, later, result } = comparison
  const { language } = useLocalization()
  const separate = result.status !== 'comparable'
  return (
    <LocalizedMarkup>
    <section className="what-changed" aria-labelledby="what-changed-title">
      <h3 id="what-changed-title">What changed <span>{result.earlierTime} → {result.laterTime}</span></h3>
      <p className="change-headline">{result.headline}</p>
      {result.lines.map((line) => <p className="change-line" key={line}>{line}</p>)}
      {view === 'analyst' && !separate && (
        <div className="change-analyst">
          <p><strong>Windows</strong> {result.earlierTime}: {result.earlierWindow} · {result.laterTime}: {result.laterWindow}</p>
          {result.pairs.map((pair) => (
            <div key={pair.text}>
              <p><strong>Definition</strong> {later.analysis.claims.find(({ claim }) => claim.text === pair.text)?.claim.meaning.description ?? pair.text}</p>
              <table className="change-table">
                <thead><tr><th scope="col">Figure</th><th scope="col">{result.earlierTime}</th><th scope="col">{result.laterTime}</th></tr></thead>
                <tbody>
                  {pair.figures.map((figure) => (
                    <tr key={`${figure.entity}-${figure.metric}`}><th scope="row">{figure.entity} · {figure.label}</th><td>{figure.before ?? 'n/a'}</td><td>{figure.after ?? 'n/a'}</td></tr>
                  ))}
                </tbody>
              </table>
              <p><strong>Assessments</strong> {result.earlierTime}: {pair.beforeLabel} · {result.laterTime}: {pair.afterLabel}</p>
            </div>
          ))}
          <p className="change-note">Calculation traces and coverage are in the claim details below.</p>
        </div>
      )}
      {result.caveats.map((caveat) => <p className="change-caveat" key={caveat}>{caveat}</p>)}
      {result.qualifications.map((text) => <p className="change-caveat" key={text}>Limitation: {text}</p>)}
      <details className="earlier-answer" open={separate}>
        <summary>{translateNarrative(`Earlier answer · ${result.earlierTime} · ${earlier.context.period === 'match-so-far' ? 'Match so far' : 'Last 10 minutes'}`, language)}</summary>
        <p className="server-summary">{snapshotReply(earlier)}</p>
        {checkedAgainst(earlier.analysis).length > 0 && <p className="checked-against"><strong>Checked against</strong> {checkedAgainst(earlier.analysis).join('; ')}</p>}
        <p className="change-note">{earlier.analysis.provider === 'local' ? 'Local rules · no model connection' : 'Foundry · server-side interpretation'} · synthetic match</p>
      </details>
      {changeCard && (
        <details className="share-preview change-share">
          <summary>Share what changed</summary>
          <div className="share-row">
            {onShare && <button className="secondary-button share-native" type="button" disabled={!shareReady} onClick={onShare}>{shareReady ? 'Share the receipts' : 'Preparing image…'}</button>}
            <button className="secondary-button" type="button" onClick={onCopy}>Copy what-changed text</button>
            <button className="secondary-button" type="button" onClick={onDownload}>{changeCard.extended ? 'Download extended card' : 'Download card image'}</button>
          </div>
          <section className={`share-card${changeCard.extended ? ' is-extended' : ''}`} aria-label="What-changed card preview">
            {changeCard.blocks.map((block, index) => (
              <p key={index} className={`share-block share-${block.kind}`} data-original-opinion={block.kind === 'take' ? 'true' : undefined}>{block.kind === 'bullet' && <span aria-hidden="true">• </span>}{block.text}</p>
            ))}
          </section>
        </details>
      )}
    </section>
    </LocalizedMarkup>
  )
}

function scopePeriod(period: AnalysisPeriod): string {
  return period === 'match-so-far' ? 'Match so far' : 'Last 10 minutes'
}

function localizedShareModel(
  model: ShareCardModel,
  language: ReturnType<typeof useLocalization>['language'],
  datasetId: string,
): ShareCardModel {
  return {
    ...model,
    scope: localizeMatchText(translateNarrative(model.scope, language), datasetId, language),
    answer: localizeMatchText(translateNarrative(model.answer, language), datasetId, language),
    claims: model.claims.map((claim) => ({
      ...claim,
      text: localizeMatchText(translateNarrative(claim.text, language), datasetId, language),
      verdict: claim.verdict ? localizeMatchText(translateNarrative(claim.verdict, language), datasetId, language) : null,
      facts: claim.facts.map((text) => localizeMatchText(translateNarrative(text, language), datasetId, language)),
      moments: claim.moments.map((text) => localizeMatchText(translateNarrative(text, language), datasetId, language)),
      counter: claim.counter.map((text) => localizeMatchText(translateNarrative(text, language), datasetId, language)),
      limitations: claim.limitations.map((text) => localizeMatchText(translateNarrative(text, language), datasetId, language)),
    })),
    footer: model.footer ? localizeMatchText(translateNarrative(model.footer, language), datasetId, language) : undefined,
  }
}

function localizedShareCardBlocks(
  model: ShareCardModel,
  language: ReturnType<typeof useLocalization>['language'],
  datasetId: string,
) {
  return shareCardBlocks(model).map((block) => ({
    ...block,
    text: block.kind === 'take'
      ? block.text
      : localizeMatchText(translateNarrative(block.text, language), datasetId, language),
  }))
}

// One question and its reply, frozen at the minute and period it was asked.
function TurnMessages({
  turn,
  view,
  messageRef,
  onResolvePlayer,
  onRetryPlayerSelection,
  isResolving,
  requestError,
  datasetId,
}: {
  turn: AnswerSnapshot
  view: 'fan' | 'analyst'
  datasetId: string
  messageRef?: RefObject<HTMLDivElement | null>
  onResolvePlayer: (claimId: string, continuation: string, playerId: string) => void
  onRetryPlayerSelection: () => void
  isResolving: boolean
  requestError: string
}) {
  const { language } = useLocalization()
  const { analysis, context } = turn
  const scope = `${formatMatchClock(context.selectedClock)} · ${scopePeriod(context.period)}`
  const checked = checkedAgainst(analysis)
  const playerChoices = analysis.claims.filter(({ playerResolution }) => playerResolution)
  const evidenceClaims = analysis.claims
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => !result.playerResolution)
  const answeredReplies = analysis.claims
    .filter(({ playerResolution }) => !playerResolution)
    .map(({ reply }) => reply)
    .filter((reply): reply is string => Boolean(reply))
  const notes = analysis.claims.flatMap((result) => [
    ...(!result.playerResolution
      ? result.claim.clarificationNeeds.map((need) => ({ key: `${result.claim.id}-${need}`, text: need, title: 'Clarification' }))
      : []),
    ...(!result.playerResolution && !isRoutineLimitation(result)
      ? [{ key: `${result.claim.id}-limitation`, text: result.limitation, title: 'Limitation' }]
      : []),
  ])
  return (
    <LocalizedMarkup>
    <>
      <div className="msg msg-user">
        <p className="msg-label">{translateText('You', language)} · {translateText('Original wording', language)} · {scope}</p>
        <p className="msg-text" data-original-opinion="true" dir="auto">{context.opinion}</p>
      </div>
      <div className="msg msg-bot" ref={messageRef} tabIndex={-1}>
        <p className="msg-label">Groupchat Analyst · {scope}</p>
        {(playerChoices.length > 0 ? answeredReplies.join(' ') : canonicalReply(analysis)) && (
          <p className="msg-text">
            {translateNarrative(
              playerChoices.length > 0 ? answeredReplies.join(' ') : canonicalReply(analysis),
              language,
            )}
          </p>
        )}
        {analysis.claims.length > 1 && evidenceClaims.length > 0 && (
          <ul className="msg-claims" aria-label="Claims in this opinion">
            {evidenceClaims.map(({ result, index }) => (
              <li key={result.claim.id}>
                <span className={`assessment-badge ${result.assessment.replaceAll(' ', '-')}`}>{result.assessment}</span>
                <span>Claim {index + 1}: {result.claim.text}</span>
              </li>
            ))}
          </ul>
        )}
        {checked.length > 0 && <p className="msg-note"><strong>Checked against</strong> {checked.join('; ')}</p>}
        {notes.map((item) => <p className="msg-note" key={item.key}><strong>{item.title}:</strong> {item.text}</p>)}
        {analysis.claims.length === 0 && <p className="msg-note"><strong>Limitation:</strong> The request was not interpreted as a supported claim. Try naming a team or player and the part of the match you mean.</p>}
        {playerChoices.map((result) => (
          <PlayerResolutionPicker
            key={result.claim.id}
            result={result}
            busy={isResolving}
            requestError={requestError}
            onChoose={onResolvePlayer}
            onRetry={onRetryPlayerSelection}
          />
        ))}
        {evidenceClaims.length > 0 && (
          <details className="msg-evidence" key={view} open={view === 'analyst'}>
            <summary>How this was checked</summary>
            <div className="claim-result-list">
              {evidenceClaims.map(({ result, index }) => (
                <ClaimCard key={result.claim.id} result={result} index={index} roster={analysis.evidenceFoundation.players} take={analysis.claims.length === 1 ? context.opinion : undefined} datasetId={datasetId} />
              ))}
            </div>
          </details>
        )}
        <p className="msg-attribution">
          {translateText('Fictional match', language)} · {translateText(
            analysis.provider === 'local'
              ? 'Local rules · no model connection'
              : 'Foundry · server-side interpretation',
            language,
          )}
        </p>
        {analysis.selectedPlayers && analysis.selectedPlayers.length > 0 && (
          <p className="msg-attribution">
            {translateText('Player selected by you; no additional model call was made.', language)}
          </p>
        )}
      </div>
    </>
    </LocalizedMarkup>
  )
}

export function MatchView({ datasetId, autoDemo = false }: { datasetId: string; autoDemo?: boolean }) {
  const { language } = useLocalization()
  const dataset = findCatalogEntry(datasetId)!
  const KEY_MOMENTS: KeyMoment[] = dataset.moments
  const isBaseline = datasetId === BASELINE_DATASET_ID
  const replay = useMemo(
    () =>
      new ReplayController(
        MATCH_TIME_OPTIONS,
        INITIAL_MATCH_TIME,
        (clock, signal) => fetchReplayFrame(clock, signal, datasetId, dataset.teams),
        { dwellMs: REPLAY_DWELL_MS },
      ),
    [datasetId, dataset.teams],
  )
  const replaySnapshot = useSyncExternalStore(
    replay.subscribe,
    replay.getSnapshot,
    replay.getSnapshot,
  )
  const selectedClock = replaySnapshot.requested
  const [period, setPeriod] = useState<AnalysisPeriod>('match-so-far')
  const [opinion, setOpinion] = useState('')
  const [submittedRequest, setSubmittedRequest] = useState<SubmittedRequest | null>(null)
  // Successful turns are immutable snapshots in order; failed requests never replace or reorder them.
  const [transcript, setTranscript] = useState<AnswerSnapshot[]>([])
  const shown = transcript.length > 0 ? transcript[transcript.length - 1] : null
  const [comparisonState, setComparisonState] = useState<{
    earlier: AnswerSnapshot
    later: AnswerSnapshot
    result: Comparison
  } | null>(null)
  const analysis = shown?.analysis ?? null
  const [isLoading, setIsLoading] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [shareMessage, setShareMessage] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [view, setView] = useState<'fan' | 'analyst'>('fan')
  const analysisRequestId = useRef(0)
  const resolutionRequestId = useRef<number | null>(null)
  const answerRef = useRef<HTMLDivElement>(null)
  const isLoadingSubmit = isLoading && submittedRequest !== null
  const submittedContext = shown?.context
  const submittedOpinion = submittedContext?.opinion ?? ''
  const hasMovedSinceAnswer = Boolean(
    submittedContext &&
      !isSubmissionScopeCurrent(submittedContext, selectedClock, period),
  )
  const displayedClock = replaySnapshot.displayedClock
  const canCheckAgain = Boolean(
    shown && displayedClock && !isLoadingSubmit &&
      (!analysis?.claims.some(({ playerResolution }) => playerResolution) ||
        analysis.playerResolutionContinuation) &&
      isLaterClock(displayedClock, shown.context.selectedClock),
  )
  const hasPlayerChoices = Boolean(
    analysis?.claims.some(({ playerResolution }) => playerResolution),
  )
  const comparison = comparisonState && comparisonState.later === shown ? comparisonState : null
  const changeCard = useMemo<ChangeCard | null>(
    () => {
      if (!comparison) return null
      const card = buildChangeCard(comparison.later.context.opinion, comparison.earlier, comparison.later, comparison.result)
      if (!card) return null
      return {
        ...card,
        blocks: card.blocks.map((block) => ({
          ...block,
          text: block.kind === 'take'
            ? block.text
            : localizeMatchText(translateNarrative(block.text, language), datasetId, language),
        })),
      }
    },
    [comparison, language, datasetId],
  )
  const hasUnresolvedSubject = Boolean(analysis?.claims.some(({ claim, assessment }) =>
    claim.subject === null && assessment === 'clarification needed'))
  const periodName = period === 'match-so-far' ? 'Match so far' : 'Last 10 minutes'
  const isSeeking =
    replaySnapshot.status === 'loading' &&
    (replaySnapshot.displayedClock === null ||
      clockKey(replaySnapshot.displayedClock) !== clockKey(selectedClock))
  const committedClock = replaySnapshot.displayedClock
  const examples = committedClock
    ? dataset.examples.filter(({ clock }) => !isLaterClock(clock, committedClock))
    : []
  const shareModel = useMemo<ShareCardModel | null>(
    () => (analysis && submittedContext && !hasPlayerChoices
      ? localizedShareModel(buildShareCardModel(submittedContext.opinion, analysis), language, datasetId)
      : null),
    [analysis, submittedContext, language, hasPlayerChoices, datasetId],
  )
  const [canNativeShare] = useState(() => supportsFileShare(navigator, new File([''], 'probe.png', { type: 'image/png' })))
  const [demoActive, setDemoActive] = useState(false)
  const sharingRef = useRef(false)
  const singleShare = useMemo(
    () => (shareModel
      ? {
          key: imageKey('single', localizedShareCardBlocks(shareModel, language, datasetId)),
          image: createBlocksImage(localizedShareCardBlocks(shareModel, language, datasetId), language),
        }
      : null),
    [shareModel, language, datasetId],
  )
  const changeShare = useMemo(
    () => (changeCard ? { key: imageKey('change', changeCard.blocks), image: createBlocksImage(changeCard.blocks, language) } : null),
    [changeCard, language],
  )
  const preparedSingle = usePreparedImage(canNativeShare, singleShare?.key ?? null, singleShare?.image ?? null, 'groupchat-analyst-card.png')
  const preparedChange = usePreparedImage(canNativeShare, changeShare?.key ?? null, changeShare?.image ?? null, 'groupchat-analyst-what-changed.png')
  const demo = demoStep({
    active: demoActive,
    draft: opinion,
    hasSubmitted: shown !== null || submittedRequest !== null,
    isLoading,
    hasError: requestError !== '',
    displayedClock,
    requestedClock: selectedClock,
    answer: shown
      ? {
          take: shown.context.opinion,
          clock: shown.context.selectedClock,
          period: shown.context.period,
          relevant: isRelevantAnswer(shown.analysis.claims),
        }
      : null,
  })
  useEffect(() => {
    replay.start()
    return () => replay.dispose()
  }, [replay])

  useEffect(() => {
    if (!submittedRequest) return
    const active = submittedRequest
    const controller = new AbortController()
    const requestId = active.id
    const request =
      active.operation.kind === 'resolve-player'
        ? {
            action: 'resolve-player',
            continuation: active.operation.continuation,
            claimId: active.operation.claimId,
            playerId: active.operation.playerId,
          }
        : active.operation.kind === 'recheck-resolved-player'
          ? {
              action: 'recheck-resolved-player',
              continuation: active.operation.continuation,
              selectedClock: active.context.selectedClock,
              period: active.context.period,
            }
          : createAnalysisRequest(active.context)
    async function loadAnalysis() {
      setIsLoading(true)
      setRequestError('')
      setCopyMessage('')
      setShareMessage('')
      try {
        const payload = await requestAnalysis(request, { signal: controller.signal })
        if (!isAnalysisResponse(payload)) throw new Error('The analysis service returned an incomplete answer.')
        if (payload.evidenceFoundation.dataset?.id !== active.context.datasetId) throw new Error('The analysis service answered for a different match, so the reply was not shown.')
        if (isLatestRequest(requestId, analysisRequestId.current)) {
          if (active.operation.kind === 'resolve-player' && active.baseline) {
            const snapshot = createSnapshot(
              active.operation.snapshotId,
              active.baseline.context,
              payload,
            )
            setTranscript((turns) =>
              turns.map((turn) => (turn.id === snapshot.id ? snapshot : turn)),
            )
            setComparisonState((current) => {
              if (!current) return current
              const earlier =
                current.earlier.id === snapshot.id ? snapshot : current.earlier
              const later =
                current.later.id === snapshot.id ? snapshot : current.later
              return {
                earlier,
                later,
                result: compareSnapshots(earlier, later),
              }
            })
          } else {
            const snapshot = createSnapshot(requestId, active.context, payload)
            const baseline = active.baseline
            setTranscript((turns) => [...turns, snapshot])
            setComparisonState(
              baseline ? { earlier: baseline, later: snapshot, result: compareSnapshots(baseline, snapshot) } : null,
            )
          }
        }
      } catch (error) {
        if (
          !controller.signal.aborted &&
          isLatestRequest(requestId, analysisRequestId.current)
        ) {
          setRequestError(error instanceof Error ? error.message : 'The analysis service could not be reached.')
        }
      } finally {
        if (
          active.operation.kind === 'resolve-player' &&
          resolutionRequestId.current === requestId
        ) {
          resolutionRequestId.current = null
        }
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
  }, [submittedRequest, datasetId])

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

  function fillExample(example: DatasetExample) {
    setPeriod(example.period)
    replay.seek(example.clock)
    setOpinion(localizeMatchText(localizedExample(example.text, language), datasetId, language))
    document.getElementById('opinion-input')?.focus()
  }

  // Prepares the demonstration only; submitting stays an explicit user action.
  function startDemo() {
    if (demo !== 'offer' || !isBaseline) return
    setDemoActive(true)
    setPeriod('match-so-far')
    replay.seek(DEMO_CLOCK)
    setOpinion(localizeMatchText(localizedExample(DEMO_TAKE, language), datasetId, language))
    document.getElementById('opinion-input')?.focus()
  }

  useEffect(() => {
    if (autoDemo && isBaseline) startDemo()
    // Runs once when the match opens from the home page demonstration link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function shareCard(kind: 'single' | 'change') {
    const target = kind === 'single' ? singleShare : changeShare
    const prepared = kind === 'single' ? preparedSingle : preparedChange
    if (!target || sharingRef.current) return
    sharingRef.current = true
    try {
      const outcome = await shareReceipts(navigator, prepared, target.key, kind === 'single' ? 'Groupchat Analyst receipt' : 'Groupchat Analyst: what changed')
      setCopyMessage('')
      setShareMessage(outcome.message)
    } finally {
      sharingRef.current = false
    }
  }

  function submitOpinion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSeeking) return
    const trimmedOpinion = opinion.trim()
    if (!trimmedOpinion) return
    const id = ++analysisRequestId.current
    setRequestError('')
    setSubmittedRequest({
      id,
      context: createSubmissionContext(trimmedOpinion, selectedClock, period, datasetId, language),
      baseline: null,
      operation: { kind: 'analysis' },
    })
  }

  // Re-checks the saved take at the committed, displayed moment; never the pending replay position.
  function checkAgain() {
    if (!shown || !displayedClock || !canCheckAgain) return
    const id = ++analysisRequestId.current
    setRequestError('')
    setSubmittedRequest({
      id,
      context: createSubmissionContext(
        shown.context.opinion,
        displayedClock,
        shown.context.period,
        datasetId,
        shown.context.inputLanguage,
      ),
      baseline: shown,
      operation: shown.analysis.playerResolutionContinuation
        ? {
            kind: 'recheck-resolved-player',
            continuation: shown.analysis.playerResolutionContinuation,
          }
        : { kind: 'analysis' },
    })
  }

  function resolvePlayer(
    claimId: string,
    continuation: string,
    playerId: string,
  ) {
    if (!shown || resolutionRequestId.current !== null || isLoading) return
    const id = ++analysisRequestId.current
    resolutionRequestId.current = id
    setRequestError('')
    setSubmittedRequest({
      id,
      context: shown.context,
      baseline: shown,
      operation: {
        kind: 'resolve-player',
        continuation,
        claimId,
        playerId,
        snapshotId: shown.id,
      },
    })
  }

  function retryAnalysis() {
    if (!submittedRequest || isLoading) return
    const id = ++analysisRequestId.current
    if (submittedRequest.operation.kind === 'resolve-player') {
      if (resolutionRequestId.current !== null) return
      resolutionRequestId.current = id
    }
    setRequestError('')
    setSubmittedRequest({ ...submittedRequest, id })
  }

  async function copyAssessment() {
    if (!analysis) return
    try {
      await navigator.clipboard.writeText(
        localizeMatchText(translateNarrative(canonicalReply(analysis), language), datasetId, language),
      )
      setCopyMessage('Reply copied.')
    } catch {
      setCopyMessage('Select the reply above and copy it manually.')
    }
  }

  async function copyShareCard() {
    if (!shareModel) return
    try {
      await navigator.clipboard.writeText(
        blocksToText(localizedShareCardBlocks(shareModel, language, datasetId)),
      )
      setShareMessage('Card text copied.')
    } catch {
      setShareMessage('Clipboard access is unavailable. Select the card text above and copy it manually.')
    }
  }

  async function copyChangeCard() {
    if (!changeCard) return
    try {
      await navigator.clipboard.writeText(changeCardText(changeCard))
      setShareMessage('What-changed text copied.')
    } catch {
      setShareMessage('Clipboard access is unavailable. Select the card text above and copy it manually.')
    }
  }

  async function downloadImage(image: ShareCardImage, extended: boolean, name: string) {
    const save = (blob: Blob, extension: string) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${name}.${extension}`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    try {
      save(await svgToPngBlob(image, 2), 'png')
      setShareMessage(extended ? 'Extended card image downloaded.' : 'Card image downloaded.')
    } catch {
      try {
        save(new Blob([image.svg], { type: 'image/svg+xml;charset=utf-8' }), 'svg')
        setShareMessage('Card image downloaded as SVG.')
      } catch {
        setShareMessage('Image download is unavailable. Copy the card text instead.')
      }
    }
  }

  function downloadShareCard() {
    if (shareModel) void downloadImage(createBlocksImage(localizedShareCardBlocks(shareModel, language, datasetId), language), shareModel.extended, 'groupchat-analyst-card')
  }

  function downloadChangeCard() {
    if (changeCard) void downloadImage(createBlocksImage(changeCard.blocks, language), changeCard.extended, 'groupchat-analyst-what-changed')
  }

  const latestActions = analysis && submittedContext && shown ? (
    <div className="turn-actions">
      {demo === 'step-to-next-minute' && (
        <div className="demo-note" role="status">
          <span>Same opinion, one minute later in the fictional replay.</span>
          <button className="secondary-button" type="button" onClick={() => replay.seek(DEMO_NEXT_CLOCK)}>Move to 58′<ArrowIcon /></button>
        </div>
      )}
      {demo === 'moving' && <p className="demo-note" role="status">Moving to 58′…</p>}
      {demo === 'ready-to-recheck' && <p className="demo-note" role="status">The replay is at 58′. Use “Check again” to ask the same opinion against the new evidence.</p>}
      {comparison && <WhatChanged comparison={comparison} view={view} changeCard={hasPlayerChoices ? null : changeCard} onCopy={copyChangeCard} onDownload={downloadChangeCard} onShare={hasPlayerChoices || !canNativeShare ? null : () => void shareCard('change')} shareReady={preparedChange !== null && changeShare !== null && preparedChange.key === changeShare.key} />}
      {opinion.trim() !== submittedOpinion && (
        <p className="draft-notice">
          {translateNarrative(
            opinion.trim()
              ? 'The latest reply is for the saved opinion above, not the wording now in the box. “Check this moment” submits the edited wording instead.'
              : 'The latest reply is for the saved opinion above.',
            language,
          )}
        </p>
      )}
      {hasMovedSinceAnswer && (
        <p className="stale-answer-notice" role="status">
          {translateNarrative(
            `The latest reply is for ${formatMatchClock(submittedContext.selectedClock)} · ${scopePeriod(submittedContext.period)}. The replay is now at ${formatMatchClock(selectedClock)}; that answer has not been recalculated.`,
            language,
          )}
        </p>
      )}
      {canCheckAgain && displayedClock && (
        <div className="check-again">
          <button className="secondary-button" type="button" onClick={checkAgain}>
            {translateNarrative(`Check again at ${formatMatchClock(displayedClock)}`, language)}<ArrowIcon />
          </button>
          <span>
            {translateNarrative(
              `Same wording, same ${submittedContext.period === 'match-so-far' ? 'match-so-far' : 'last-10-minutes'} option${opinion.trim() !== submittedOpinion ? ' — this checks the saved opinion, not your edit' : ''}.`,
              language,
            )}
          </span>
        </div>
      )}
      {!hasPlayerChoices && (
        <div className="share-row">
          {canNativeShare && <button className="secondary-button share-native" type="button" disabled={!(preparedSingle && singleShare && preparedSingle.key === singleShare.key)} onClick={() => void shareCard('single')}>{preparedSingle && singleShare && preparedSingle.key === singleShare.key ? 'Share the receipts' : 'Preparing image…'}</button>}
          <button className="copy-button" type="button" onClick={copyAssessment}>Copy reply <ArrowIcon /></button>
          <button className="secondary-button" type="button" onClick={copyShareCard}>Copy card text</button>
          <button className="secondary-button" type="button" onClick={downloadShareCard}>{shareModel?.extended ? 'Download extended card' : 'Download card image'}</button>
          <span role="status">{[copyMessage, shareMessage].filter(Boolean).join(' ')}</span>
        </div>
      )}
      {shareModel && (
        <details className="share-preview">
          <summary>Preview share card</summary>
          <section className={`share-card${shareModel.extended ? ' is-extended' : ''}`} aria-label="Shareable card preview">
            {localizedShareCardBlocks(shareModel, language, datasetId).map((block, index) => (
              <p key={index} className={`share-block share-${block.kind}`} data-original-opinion={block.kind === 'take' ? 'true' : undefined}>{block.kind === 'bullet' && <span aria-hidden="true">• </span>}{block.text}</p>
            ))}
          </section>
        </details>
      )}
    </div>
  ) : null

  const resolutionOperation =
    submittedRequest?.operation.kind === 'resolve-player'
      ? submittedRequest.operation
      : null
  const isResolvingShown = Boolean(
    resolutionOperation &&
      submittedRequest?.baseline?.id === shown?.id &&
      isLoading,
  )
  const pending =
    submittedRequest &&
    submittedRequest.operation.kind !== 'resolve-player' &&
    (isLoading || requestError !== '')
      ? submittedRequest
      : null
  const pendingScope = pending ? `${formatMatchClock(pending.context.selectedClock)} · ${scopePeriod(pending.context.period)}` : ''

  return (
    <LocalizedMarkup datasetId={datasetId}>
    <main className="page-shell analyst-shell" id="main-content">
      <a className="skip-link" href="#opinion-input">Skip to your opinion</a>
      <header className="site-header">
        <a className="brand" href="#/" aria-label="Groupchat Analyst home">
          <span className="brand-mark" aria-hidden="true">g<span>.</span></span>
          <span>Groupchat<span className="brand-light">Analyst</span></span>
        </a>
        <nav className="site-nav" aria-label="Matches"><a href="#/matches">All matches</a></nav>
        <span className="demo-label"><span aria-hidden="true" />Synthetic demo</span>
        <LanguageSelector />
      </header>

      <section className="analysis-page" aria-labelledby="page-title">
        <div className="page-intro">
          <h1 id="page-title"><bdi dir="auto">{dataset.teams[0]} v {dataset.teams[1]}</bdi><span> · {dataset.name}</span></h1>
          <p className="intro-description">{dataset.scenario}</p>
          {demo === 'offer' && isBaseline && (
            <button className="demo-entry" type="button" onClick={startDemo}>{DEMO_ENTRY_LABEL}</button>
          )}
        </div>

        <div className="workspace-grid">
          <div className="match-column">
            <MatchHeader
              datasetId={datasetId}
              teams={dataset.teams}
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
            <section className="conversation" aria-labelledby="conversation-title">
              <div className="conversation-head">
                <h2 id="conversation-title">Conversation</h2>
                {transcript.length > 0 && (
                  <div className="segmented-control view-control" role="group" aria-label="Answer detail">
                    <button type="button" aria-pressed={view === 'fan'} onClick={() => setView('fan')}>Fan</button>
                    <button type="button" aria-pressed={view === 'analyst'} onClick={() => setView('analyst')}>Analyst</button>
                  </div>
                )}
              </div>
              <div className="chat-log" role="log" aria-label="Opinions and answers" aria-busy={isLoadingSubmit}>
                {transcript.length === 0 && !pending && (
                  <div className="msg msg-bot">
                    <p className="msg-label">Groupchat Analyst</p>
                    <p className="msg-text">Pick an example or type an opinion. I’ll check it against this match at the minute you choose.</p>
                  </div>
                )}
                {transcript.map((turn, index) => (
                  <div className="chat-turn" key={turn.id}>
                    <TurnMessages
                      turn={turn}
                      view={view}
                      datasetId={datasetId}
                      messageRef={index === transcript.length - 1 ? answerRef : undefined}
                      onResolvePlayer={resolvePlayer}
                      onRetryPlayerSelection={retryAnalysis}
                      isResolving={isResolvingShown && turn.id === shown?.id}
                      requestError={
                        resolutionOperation?.snapshotId === turn.id &&
                        !isLoading
                          ? requestError
                          : ''
                      }
                    />
                    {index === transcript.length - 1 && latestActions}
                  </div>
                ))}
                {pending && (
                  <div className="chat-turn">
                    <div className="msg msg-user">
                      <p className="msg-label">You · {pendingScope}</p>
                      <p className="msg-text" data-original-opinion="true" dir="auto">{pending.context.opinion}</p>
                    </div>
                    {isLoadingSubmit && (
                      <div className="msg msg-bot" role="status">
                        <p className="msg-text"><span className="loading-dot" aria-hidden="true" />Checking the match…</p>
                      </div>
                    )}
                    {requestError && !isLoadingSubmit && (
                      <div className="msg msg-bot msg-error" role="alert">
                        <p className="msg-text">That check didn’t finish. Please try again.</p>
                        {transcript.length > 0 && <p className="msg-note">Your earlier answer is still above.</p>}
                        <details className="msg-evidence"><summary>Details</summary><p className="msg-note">{requestError}</p></details>
                        <button className="secondary-button" type="button" onClick={retryAnalysis}>Try again</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <form className="opinion-form" onSubmit={submitOpinion}>
              <label className="opinion-label" htmlFor="opinion-input">Your opinion</label>
              <textarea
                id="opinion-input" value={opinion} onChange={(event) => setOpinion(event.currentTarget.value)}
                placeholder={`Type an opinion, e.g. How many shots did ${dataset.teams[1]} have?`}
                rows={3} required aria-describedby="input-hint" dir="auto"
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
              {examples.length > 0 && (
                <div className="suggestions" role="group" aria-label="Example opinions">
                  <span>Examples (these fill the box; nothing is sent until you check)</span>
                  {examples.map((example) => {
                    const text = localizedExample(example.text, language)
                    return <button key={example.id} type="button" onClick={() => fillExample(example)} title={`${translateNarrative(example.shows, language)} · ${formatMatchClock(example.clock)}`}>{text}</button>
                  })}
                </div>
              )}
              <p className="input-hint" id="input-hint">Fictional match: every performance and result is invented.</p>
              {demo === 'ready-to-submit' && <p className="demo-note" role="status">Fictional replay at 57′, Match so far. Press “Check this moment” to see how the opinion is read.</p>}
            </form>


            {analysis && view === 'analyst' && !hasUnresolvedSubject && needsPassMap(analysis) && <PassMap key={`${clockKey(submittedContext?.selectedClock ?? selectedClock)}-${submittedContext?.period ?? period}`} foundation={analysis.evidenceFoundation} />}
            {analysis && !hasUnresolvedSubject && <EvidenceFoundationPanel foundation={analysis.evidenceFoundation} selectedPeriodLabel={analysis.selectedPeriodLabel} />}
            {analysis && !hasUnresolvedSubject && (
              <details className="all-evidence match-events"><summary>Explore match events <span>{analysis.periodEvents.length} recorded</span></summary>{referenceList(analysis.periodEvents, analysis.evidenceFoundation.players)}</details>
            )}
            {analysis && (
              <details className="player-picker">
                <summary>Ask about a player</summary>
                <label htmlFor="player-select">Fictional matchday squad</label>
                <select id="player-select" value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.currentTarget.value)}>
                  <option value="">Choose a player</option>
                  {(Object.keys(analysis.evidenceFoundation.teams) as MatchTeam[]).map((team) => <optgroup key={team} label={team}>{analysis.evidenceFoundation.players.filter((player) => player.team === team).map((player) => <option key={player.id} value={player.id}>{player.name} · {player.status === 'starter' ? 'starter' : 'substitute'}</option>)}</optgroup>)}
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
            <p>{`${dataset.teams[0]} and ${dataset.teams[1]} are fictional teams using real-player names. Every performance and result is invented.`}</p>
            <p>{analysis
              ? `${analysis.providerLabel}. Statistics are still calculated by the application, not by AI.`
              : 'The analysis service has not yet reported how it reads questions.'}</p>
            <p>The guided demonstration only prepares a fictional 57′ replay and its opinion; nothing is checked until you press the submit button, and the 58′ re-check is also your choice. Local-rules reading is limited to a small set of phrasings, so unfamiliar wording may be declined.</p>
            <p>“Share the receipts” appears only where your browser can share image files. It hands the card image to your device’s share sheet and cannot tell whether anything was sent. Copy and download are always available.</p>
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
    </LocalizedMarkup>
  )
}
