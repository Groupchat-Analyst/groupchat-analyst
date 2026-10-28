import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MatchReplayResponse } from '../../shared/src/apiContracts'
import type { MatchTeam } from '../../shared/src/matchClock'
import { elapsedMatchMinute, formatMatchClock, type MatchClock } from '../../shared/src/matchClock'
import { clockKey, REPLAY_LOAD_ERROR, type ReplaySnapshot } from './replayController'
import { teamMonogram } from './teamMonogram'
import { LocalizedMarkup } from './localization'
import { useLocalization } from './localizationContext'
import {
  localizedPlayerName,
  localizedTeamMonogram,
} from '../../shared/src/displayNames'
import { translateText } from '../../shared/src/localization'

export type KeyMoment = { label: string; clock: MatchClock }

type Replay = MatchReplayResponse
type ReplayEvent = Replay['events'][number]

type MatchHeaderProps = {
  datasetId: string
  teams: readonly [string, string]
  timeline: MatchClock[]
  snapshot: ReplaySnapshot
  keyMoments: KeyMoment[]
  dwellMs: number
  onSeek: (clock: MatchClock) => void
  onStep: (direction: -1 | 1) => void
  onPlay: () => void
  onPause: () => void
  onRetry: () => void
}

function isGoal(event: ReplayEvent): boolean {
  return event.type === 'shot' && event.outcome === 'goal'
}

function useChangedFlag(value: string, durationMs = 1100): boolean {
  const previous = useRef(value)
  const [changed, setChanged] = useState(false)
  useEffect(() => {
    if (previous.current === value) return
    previous.current = value
    setChanged(true)
    const timer = window.setTimeout(() => setChanged(false), durationMs)
    return () => window.clearTimeout(timer)
  }, [value, durationMs])
  return changed
}

/** Event ids that arrived since the previous frame, when that is a small, natural step. */
function useNewEventIds(frame: Replay | null): Set<string> {
  const [tracked, setTracked] = useState<{ frame: Replay | null; ids: Set<string> | null; added: Set<string> }>({ frame, ids: null, added: new Set() })
  if (tracked.frame !== frame) {
    const added = new Set<string>()
    if (frame && tracked.ids) {
      for (const event of frame.events) if (!tracked.ids.has(event.id)) added.add(event.id)
    }
    const result = added.size <= 2 ? added : new Set<string>()
    setTracked({ frame, ids: frame ? new Set(frame.events.map(({ id }) => id)) : null, added: result })
    return result
  }
  return tracked.added
}

function EventLog({ frame, homeTeam }: { frame: Replay | null; homeTeam: string }) {
  const listRef = useRef<HTMLOListElement>(null)
  const added = useNewEventIds(frame)
  const count = frame?.events.length ?? 0

  useLayoutEffect(() => {
    const list = listRef.current
    if (list && added.size > 0) list.scrollTop = list.scrollHeight
  }, [added, count])

  return (
    <ol className="event-log-list" ref={listRef} aria-label="Recorded events in match order" tabIndex={0}>
      {frame?.events.map((event) => (
        <li
          key={event.id}
          className={[
            event.team === homeTeam ? 'north-event' : 'east-event',
            isGoal(event) ? 'is-goal' : '',
            added.has(event.id) ? 'is-new' : '',
          ].filter(Boolean).join(' ')}
        >
          <time>{event.time}</time>
          <span>
            <strong>{event.team}</strong>
            <span>{event.description}</span>
          </span>
          {isGoal(event) && <b>GOAL</b>}
        </li>
      ))}
      {count === 0 && <li className="event-log-empty">Nothing recorded yet.</li>}
    </ol>
  )
}

export function MatchHeader({
  datasetId,
  teams,
  timeline,
  snapshot,
  keyMoments,
  dwellMs,
  onSeek,
  onStep,
  onPlay,
  onPause,
  onRetry,
}: MatchHeaderProps) {
  const { language } = useLocalization()
  const { requested, displayed, displayedClock, status, error, playing } = snapshot
  const last = timeline.length - 1
  const requestedIndex = timeline.findIndex((clock) => clockKey(clock) === clockKey(requested))
  const displayedIndex = displayedClock
    ? timeline.findIndex((clock) => clockKey(clock) === clockKey(displayedClock))
    : -1
  const isPending = status === 'loading' && requestedIndex !== displayedIndex
  const isAtEnd = requestedIndex >= last
  const requestedLabel = formatMatchClock(requested)
  const displayedLabel = displayed?.selectedTime ?? null
  const latest = displayed && displayed.events.length > 0
    ? displayed.events[displayed.events.length - 1]
    : null

  // While playing, the bar eases toward the next moment; time, score and events only change when a frame commits.
  const barIndex = playing && displayedIndex >= 0
    ? Math.min(displayedIndex + 1, last)
    : requestedIndex
  const fraction = last > 0 ? barIndex / last : 0
  const motion = playing ? `${dwellMs}ms linear` : '160ms ease-out'

  const scoreText = displayed
    ? `${displayed.score[teams[0] as MatchTeam]} – ${displayed.score[teams[1] as MatchTeam]}`
    : '– –'
  const scoreChanged = useChangedFlag(scoreText)

  const announcement = displayed && !playing
    ? `${displayed.selectedTime}. ${teams[0]} ${displayed.score[teams[0] as MatchTeam]}, ${teams[1]} ${displayed.score[teams[1] as MatchTeam]}.`
    : ''

  return (
    <LocalizedMarkup>
    <section className="match-header" aria-labelledby="match-header-title">
      <h2 id="match-header-title" className="visually-hidden">Fictional match replay</h2>
      <div className="scoreboard">
        <div className="team-name north"><span className="team-monogram north" aria-hidden="true">{localizedTeamMonogram(datasetId, teams[0], language) ?? teamMonogram(teams[0])}</span>{teams[0]}</div>
        <div
          className={`score${scoreChanged ? ' is-changed' : ''}${displayed ? '' : ' is-empty'}`}
          aria-hidden="true"
        >
          <bdi dir="ltr">{scoreText}</bdi>
        </div>
        <div className="team-name east">{teams[1]}<span className="team-monogram east" aria-hidden="true">{localizedTeamMonogram(datasetId, teams[1], language) ?? teamMonogram(teams[1])}</span></div>
        <div className="match-clock" aria-hidden="true">
          <span className="clock-value" dir="ltr">{displayedLabel ?? requestedLabel}</span>
          <span className="clock-state">
            {error
              ? 'Showing the last loaded moment'
              : isPending
                ? `Moving to ${requestedLabel}…`
                : displayed
                  ? 'Match time'
                  : 'Loading…'}
          </span>
        </div>
      </div>
      {displayed && (
        <details className="all-evidence match-squad">
          <summary>{translateText('View squads', language)}</summary>
          <p>{translateText('Familiar names. Fictional teams and performances.', language)}</p>
          {teams.map((team) => (
            <section key={team} aria-label={team}>
              <h3>{team}</h3>
              {(['starter', 'substitute'] as const).map((status) => (
                <div key={status}>
                  <h4>
                    {translateText(status === 'starter' ? 'Starters' : 'Substitutes', language)}
                  </h4>
                  <ul>
                    {displayed.players
                      .filter((player) => player.team === team && player.status === status)
                      .map((player) => (
                        <li key={player.id}>
                          <bdi dir="auto">
                            {localizedPlayerName(datasetId, player.id, player.name, language)}
                          </bdi>
                          {' · '}
                          {translateText(
                            `Participation: ${player.participation}`,
                            language,
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </details>
      )}
      <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>

      <div className="replay-bar" role="group" aria-label="Replay controls">
        <button
          className="replay-play"
          type="button"
          onClick={playing ? onPause : onPlay}
          aria-label={playing ? 'Pause replay' : isAtEnd ? 'Replay from kick-off' : 'Play replay'}
        >
          {playing ? 'Pause' : isAtEnd ? 'Replay' : 'Play'}
        </button>
        <button className="icon-step" type="button" onClick={() => onStep(-1)} disabled={requestedIndex <= 0} aria-label="Back one minute">−1′</button>
        <button className="icon-step" type="button" onClick={() => onStep(1)} disabled={isAtEnd} aria-label="Forward one minute">+1′</button>
        <div className="scrubber">
          <div className="scrubber-track" aria-hidden="true">
            <div className="scrubber-fill" style={{ transform: `scaleX(${fraction})`, transition: `transform ${motion}` }} />
          </div>
          <div className="scrubber-thumb" aria-hidden="true" style={{ left: `${fraction * 100}%`, transition: `left ${motion}` }} />
          <input
            type="range"
            min={0}
            max={last}
            step={1}
            value={Math.max(requestedIndex, 0)}
            onChange={(event) => onSeek(timeline[Number(event.currentTarget.value)])}
            aria-label="Match time"
            aria-valuetext={requestedLabel}
          />
        </div>
      </div>

      {error && (
        <p className="replay-error" role="alert">
          {translateText(
            displayed ? `${REPLAY_LOAD_ERROR} The last loaded moment is still shown.` : REPLAY_LOAD_ERROR,
            language,
          )}{' '}
          <button type="button" className="link-button" onClick={onRetry}>{translateText('Try again', language)}</button>
        </p>
      )}

      <div className="moment-chips" role="group" aria-label="Jump to a key moment">
        {keyMoments.map(({ label, clock }) => {
          const hasOccurred = displayedClock !== null
            && elapsedMatchMinute(clock) <= elapsedMatchMinute(displayedClock)
          return (
            <button
              key={label}
              type="button"
              aria-pressed={clockKey(clock) === clockKey(requested)}
              onClick={() => onSeek(clock)}
            >
              {hasOccurred ? label : <><bdi dir="ltr">{formatMatchClock(clock)}</bdi> · <span>Recorded moment</span></>}
            </button>
          )
        })}
      </div>

      <div className="latest-moment" aria-label="Latest recorded moment">
        <p className="latest-label">
          Latest recorded moment{latest ? ` · ${latest.time}` : ''}
        </p>
        {latest ? (
          <p key={latest.id} className={`latest-body${isGoal(latest) ? ' is-goal' : ''}`}>
            <strong>{latest.team} ·</strong> {latest.description}
          </p>
        ) : (
          <p className="latest-body is-quiet">
            {status === 'loading' && !displayed ? 'Loading the match…' : 'Nothing has been recorded yet.'}
          </p>
        )}
        <p className="latest-note">One recorded event — it does not show who is on top.</p>
      </div>

      <details className="event-log">
        <summary>
          All recorded events <span>{displayed ? `${displayed.events.length} through ${displayed.selectedTime}` : '…'}</span>
        </summary>
        <EventLog frame={displayed} homeTeam={teams[0]} />
      </details>
    </section>
    </LocalizedMarkup>
  )
}
