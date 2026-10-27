import { useState } from 'react'
import { HOME_PREVIEW } from '../../shared/src/homePreview.ts'
import { BASELINE_DATASET_ID } from '../../shared/src/datasetCatalog.ts'
import { LocalizedMarkup } from './localization'
import './landing.css'

const MATCHES_HASH = '#/matches'
const JOURNEY = ['Choose a match', 'Enter an opinion', 'Check a moment', 'Check again and share']

// Static, illustrative model: switching minutes never calls the analysis service.
function PreviewSwitch() {
  const [minute, setMinute] = useState<number>(HOME_PREVIEW.frames[0].minute)
  const frame = HOME_PREVIEW.frames.find((candidate) => candidate.minute === minute) ?? HOME_PREVIEW.frames[0]
  const [home, away] = HOME_PREVIEW.teams
  const homeScore = frame.score[home]
  const awayScore = frame.score[away]
  const homeShots = frame.shotsOnTarget[home]
  const awayShots = frame.shotsOnTarget[away]
  const holds = frame.assessment === 'supported'

  return (
    <LocalizedMarkup datasetId={BASELINE_DATASET_ID}>
      <section className="lp-preview" aria-labelledby="lp-preview-title">
        <div className="lp-preview-head">
          <h2 id="lp-preview-title">Same opinion. Different minute.</h2>
          <div className="lp-switch" role="group" aria-label="Preview match minute">
            {HOME_PREVIEW.frames.map((option) => (
              <button
                key={option.minute}
                type="button"
                aria-pressed={option.minute === minute}
                onClick={() => setMinute(option.minute)}
              >
                {option.clockLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="lp-stage">
          <div className="lp-chat" aria-label="Illustrative conversation">
            <p className="lp-bubble lp-bubble-user" dir="auto">{HOME_PREVIEW.opinion}</p>
            <div className="lp-reply" key={frame.minute} aria-live="polite">
              <span className="lp-avatar" aria-hidden="true">g.</span>
              <p className={`lp-bubble lp-bubble-app ${holds ? 'is-yes' : 'is-no'}`}>
                <span className="lp-at">At {frame.clockLabel}</span>
                {frame.reply}
              </p>
            </div>
          </div>

          <article className="lp-receipt" key={`r-${frame.minute}`} aria-label={`Evidence receipt at ${frame.clockLabel}`}>
            <header className="lp-receipt-top">
              <span className="lp-minute" aria-hidden="true">{frame.clockLabel}</span>
              <span className="lp-stamp">Checked at {frame.clockLabel}</span>
            </header>
            <dl className="lp-lines">
              <div className="lp-line">
                <dt>Opinion</dt>
                <dd dir="auto">{HOME_PREVIEW.opinion}</dd>
              </div>
              <div className="lp-line lp-verdict">
                <dt>Verdict</dt>
                <dd className={holds ? 'is-yes' : 'is-no'}>{frame.verdict}</dd>
              </div>
              <div className="lp-line">
                <dt>Shots on target</dt>
                <dd>{home} {homeShots} · {away} {awayShots}</dd>
              </div>
              <div className="lp-line lp-score">
                <dt>Match score (a different figure)</dt>
                <dd>{home} {homeScore}–{awayScore} {away}</dd>
              </div>
            </dl>
            <p className="lp-receipt-foot">
              Illustrative · fictional replay · local rules · {home} v {away} · Original match v{HOME_PREVIEW.datasetVersion}
            </p>
          </article>
        </div>
        <p className="lp-caption">
          An illustrative preview of the fictional replay, written from verified local-rule answers. It is not a live conversation and no AI model is involved.
        </p>
      </section>
    </LocalizedMarkup>
  )
}

export function HomePage() {
  return (
    <LocalizedMarkup>
      <div className="lp">
        <section className="lp-hero" aria-labelledby="page-title">
          <p className="lp-eyebrow">Football opinions. Checked.</p>
          <h1 id="page-title">Your mate’s football opinion. <span>Checked.</span></h1>
          <p className="lp-lede">
            Pick a match. Check the moment. Bring the evidence back to the chat.
          </p>
          <p className="lp-note">The answer can change as the match goes on, so check the same opinion again a minute later.</p>
          <div className="lp-actions">
            <a className="lp-primary" href={MATCHES_HASH}>Try it Out</a>
          </div>
          <p className="lp-disclosure">Fictional matches · Local rules · No AI model connected</p>
        </section>

        <PreviewSwitch />

        <section className="lp-journey" aria-labelledby="lp-journey-title">
          <h2 id="lp-journey-title">How it works</h2>
          <ol>
            {JOURNEY.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <p>Nothing is checked until you press the check button.</p>
        </section>

        <section className="lp-future" aria-labelledby="lp-future-title">
          <h2 id="lp-future-title">Built for your group chat.</h2>
          <p>
            Check an opinion here, then share the evidence with your mates. A WhatsApp companion is planned;
            this demo doesn’t connect to your chats.
          </p>
        </section>

        <details className="lp-limits">
          <summary>What this demo is, and is not</summary>
          <ul>
            <li>Every match is fictional. Players carry real names as invented identities; no performance, result or statistic is real.</li>
            <li>Opinions are read by a limited local rule set, not an AI model. Unfamiliar wording may be declined or answered with a question.</li>
            <li>Evidence comes from a sampled synthetic event record. There is no video, tracking, chance quality or defensive-shape data.</li>
            <li>Answers live in your browser and are lost on refresh. Nothing is stored or sent anywhere except your opinion and the chosen minute for checking.</li>
          </ul>
        </details>
      </div>
    </LocalizedMarkup>
  )
}
