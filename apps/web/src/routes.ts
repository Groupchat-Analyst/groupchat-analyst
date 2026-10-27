import { BASELINE_DATASET_ID, findCatalogEntry } from '../../shared/src/datasetCatalog.ts'

export type Route =
  | { name: 'home' }
  | { name: 'matches'; unknownId?: string }
  | { name: 'match'; datasetId: string; demo: boolean }

/** Hash routes keep Back, refresh and direct entry working without server configuration. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '')
  if (path === '') return { name: 'home' }
  if (path === 'matches') return { name: 'matches' }
  const match = /^match\/([^/]+)(\/demo)?$/.exec(path)
  if (!match) return { name: 'matches' }
  let id: string
  try {
    id = decodeURIComponent(match[1])
  } catch {
    return { name: 'matches' }
  }
  if (!findCatalogEntry(id)) return { name: 'matches', unknownId: id }
  // The guided 57′ → 58′ demonstration belongs to the original match only.
  return { name: 'match', datasetId: id, demo: match[2] !== undefined && id === BASELINE_DATASET_ID }
}

export function matchHash(datasetId: string, demo = false): string {
  return `#/match/${encodeURIComponent(datasetId)}${demo ? '/demo' : ''}`
}
