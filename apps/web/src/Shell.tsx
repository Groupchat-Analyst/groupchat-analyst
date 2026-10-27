import { useEffect, useState } from 'react'
import { DATASET_CATALOG } from '../../shared/src/datasetCatalog'
import { HomePage } from './HomePage'
import { MatchView } from './App'
import { matchHash, parseRoute, type Route } from './routes'
import { LanguageSelector, LocalizationProvider, LocalizedMarkup } from './localization'
import './App.css'
import './home.css'

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <LocalizedMarkup>
      <main className="page-shell analyst-shell" id="main-content">
        <header className="site-header">
          <a className="brand" href="#/" aria-label="Groupchat Analyst home">
            <span className="brand-mark" aria-hidden="true">g<span>.</span></span>
            <span>Groupchat<span className="brand-light">Analyst</span></span>
          </a>
          <nav className="site-nav" aria-label="Matches"><a href="#/matches">All matches</a></nav>
          <span className="demo-label"><span aria-hidden="true" />Synthetic demo</span>
          <LanguageSelector />
        </header>
        {children}
      </main>
    </LocalizedMarkup>
  )
}

function Home() {
  return (
    <Chrome>
      <HomePage />
    </Chrome>
  )
}

function monogram(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
}

function Matches({ unknownId }: { unknownId?: string }) {
  return (
    <Chrome>
      <section className="home-page" aria-labelledby="page-title">
        <h1 id="page-title">Choose a match</h1>
        <p className="matches-lede">Fictional matches, each with its own story. Pick one to start.</p>
        {unknownId !== undefined && <p className="api-error" role="alert">That match isn’t available. Choose one below.</p>}
        <ul className="match-list">
          {DATASET_CATALOG.map((entry) => (
            <li key={entry.id}>
              <a className="match-card" href={matchHash(entry.id)}>
                <span className="match-fixture" aria-hidden="true">
                  <span className="monogram">{monogram(entry.teams[0])}</span>
                  <span className="match-v">v</span>
                  <span className="monogram away">{monogram(entry.teams[1])}</span>
                </span>
                <strong>{entry.teams[0]} v {entry.teams[1]}</strong>
                <span>{entry.scenario}</span>
                <span className="match-meta">{entry.name} · fictional · {entry.examples.length} example opinions</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </Chrome>
  )
}

export default function Shell() {
  const route = useRoute()
  return (
    <LocalizationProvider>
      {route.name === 'home' ? (
        <Home />
      ) : route.name === 'matches' ? (
        <Matches unknownId={route.unknownId} />
      ) : (
        // Keying by match resets drafts, answers, comparisons, replay and prepared images together.
        <MatchView key={route.datasetId} datasetId={route.datasetId} autoDemo={route.demo} />
      )}
    </LocalizationProvider>
  )
}
