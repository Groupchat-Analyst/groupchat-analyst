import { useState } from 'react'
import { BASELINE_DATASET_ID } from '../../shared/src/datasetCatalog.ts'
import { HOME_PREVIEW } from '../../shared/src/homePreview.ts'
import { matchHash } from './routes.ts'
import './landing.css'

const JOURNEY = ['Choose a match', 'Enter an opinion', 'Check a moment', 'Recheck and share']

// Static, illustrative model: switching minutes never calls the analysis service.
function PreviewSwitch() {
  const [minute, setMinute] = useState<number>(HOME_PREVIEW.frames[0].minute)
  const frame = HOME_PREVIEW.frames.find((candidate) => candidate.minute === minute) ?? HOME_PREVIEW.frames[0]
  const { Northbridge: nbScore, Eastport: eaScore } = frame.score
  const { Northbridge: nbShots, Eastport: eaShots } = frame.shotsOnTarget
  const holds = frame.assessment === 'supported'

  return (
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
          <p className="lp-bubble lp-bubble-user">{HOME_PREVIEW.opinion}</p>
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
              <dd>{HOME_PREVIEW.opinion}</dd>
            </div>
            <div className="lp-line lp-verdict">
              <dt>Verdict</dt>
              <dd className={holds ? 'is-yes' : 'is-no'}>{frame.verdict}</dd>
            </div>
            <div className="lp-line">
              <dt>Shots on target</dt>
              <dd>Northbridge {nbShots} · Eastport {eaShots}</dd>
            </div>
            <div className="lp-line lp-score">
              <dt>Match score (a different figure)</dt>
              <dd>Northbridge {nbScore}–{eaScore} Eastport</dd>
            </div>
          </dl>
          <p className="lp-receipt-foot">
            Illustrative · fictional replay · local rules · Original match v{HOME_PREVIEW.datasetVersion}
          </p>
        </article>
      </div>
      <p className="lp-caption">
        An illustrative preview of the fictional replay, written from verified local-rule answers. It is not a live conversation and no AI model is involved.
      </p>
    </section>
  )
}

export function HomePage() {
  return (
    <div className="lp">
      <section className="lp-hero" aria-labelledby="page-title">
        <p className="lp-eyebrow">Football opinions. Checked minute by minute.</p>
        <h1 id="page-title">Your mate’s got an opinion. <span>Bring the receipts.</span></h1>
        <p className="lp-lede">
          Check a football opinion against the match at a specific minute. Check again as the game changes—and share the evidence.
        </p>
        <div className="lp-actions">
          <a className="lp-primary" href={matchHash(BASELINE_DATASET_ID, true)}>Try the 57′ → 58′ demo</a>
          <a className="lp-secondary" href="#/matches">Explore both matches</a>
        </div>
        <p className="lp-disclosure">Fictional matches · Local rules · No AI model connected</p>
      </section>

      <PreviewSwitch />

      <section className="lp-journey" aria-labelledby="lp-journey-title">
        <h2 id="lp-journey-title">How it works</h2>
        <ol>
          {JOURNEY.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <p>The demo starts with nothing sent: it prepares the opinion and the minute, and you press the check button yourself.</p>
      </section>

      <section className="lp-future" aria-labelledby="lp-future-title">
        <h2 id="lp-future-title">Built for the arguments happening in your group chat.</h2>
        <p>
          The web demo works today. A WhatsApp companion is planned, but it does not exist yet: nothing here connects to messaging,
          reads a chat or monitors one automatically.
        </p>
      </section>

      <details className="lp-limits">
        <summary>What this demo is, and is not</summary>
        <ul>
          <li>Both matches are fictional. Players carry real names as invented identities; no performance, result or statistic is real.</li>
          <li>Opinions are read by a limited local rule set, not an AI model. Unfamiliar wording may be declined or answered with a question.</li>
          <li>Evidence comes from a sampled synthetic event record. There is no video, tracking, chance quality or defensive-shape data.</li>
          <li>Answers live in your browser and are lost on refresh. Nothing is stored or sent anywhere except your opinion and the chosen minute for checking.</li>
        </ul>
      </details>
    </div>
  )
}
