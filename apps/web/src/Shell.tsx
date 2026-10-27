import { useEffect, useState } from 'react'
import { DATASET_CATALOG } from '../../shared/src/datasetCatalog'
import { HomePage } from './HomePage'
import { MatchView } from './App'
import { matchHash, parseRoute, type Route } from './routes'
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
    <main className="page-shell analyst-shell" id="main-content">
      <header className="site-header">
        <a className="brand" href="#/" aria-label="Groupchat Analyst home">
          <span className="brand-mark" aria-hidden="true">g<span>.</span></span>
          <span>Groupchat<span className="brand-light">Analyst</span></span>
        </a>
        <nav className="site-nav" aria-label="Matches"><a href="#/matches">All matches</a></nav>
        <span className="demo-label"><span aria-hidden="true" />Synthetic demo</span>
      </header>
      {children}
    </main>
  )
}

function Home() {
  return (
    <Chrome>
      <HomePage />
    </Chrome>
  )
}

function Matches({ unknownId }: { unknownId?: string }) {
  return (
    <Chrome>
      <section className="home-page" aria-labelledby="page-title">
        <h1 id="page-title">Choose a match</h1>
        {unknownId !== undefined && <p className="api-error" role="alert">That match isn’t available. Choose one below.</p>}
        <ul className="match-list">
          {DATASET_CATALOG.map((entry) => (
            <li key={entry.id}>
              <a className="match-card" href={matchHash(entry.id)}>
                <strong>{entry.name}</strong>
                <span>{entry.description}</span>
                <span className="match-meta">Fictional · v{entry.version} · {entry.moments.length} key moments · {entry.examples.length} example opinions</span>
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
  if (route.name === 'home') return <Home />
  if (route.name === 'matches') return <Matches unknownId={route.unknownId} />
  // Keying by match resets drafts, answers, comparisons, replay and prepared images together.
  return <MatchView key={route.datasetId} datasetId={route.datasetId} autoDemo={route.demo} />
}
