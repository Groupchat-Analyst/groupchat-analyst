import {
  BASELINE_DATASET_ID,
  DATASET_CATALOG,
  RETURN_DATASET_ID_PUBLIC,
} from '../../shared/src/datasetCatalog.js'
import {
  SYNTHETIC_MATCH_EVIDENCE,
  type SyntheticMatchEvidence,
} from '../../shared/src/evidence.js'
import {
  SYNTHETIC_MATCH_EVENTS,
  type MatchEvent,
} from '../../shared/src/match.js'
import {
  RETURN_MATCH_EVENTS,
  RETURN_MATCH_EVIDENCE,
} from '../../shared/src/returnMatch.js'

export type ResolvedDataset = {
  id: string
  version: string
  events: MatchEvent[]
  evidence: SyntheticMatchEvidence
}

export class UnknownDatasetError extends Error {
  constructor() {
    super('Unknown datasetId. Choose one of the supported fictional matches.')
    this.name = 'UnknownDatasetError'
  }
}

const REGISTRY = new Map<string, ResolvedDataset>([
  [
    BASELINE_DATASET_ID,
    {
      id: BASELINE_DATASET_ID,
      version: SYNTHETIC_MATCH_EVIDENCE.dataset.version,
      events: SYNTHETIC_MATCH_EVENTS,
      evidence: SYNTHETIC_MATCH_EVIDENCE,
    },
  ],
  [
    RETURN_DATASET_ID_PUBLIC,
    {
      id: RETURN_DATASET_ID_PUBLIC,
      version: RETURN_MATCH_EVIDENCE.dataset.version,
      events: RETURN_MATCH_EVENTS,
      evidence: RETURN_MATCH_EVIDENCE,
    },
  ],
])

/**
 * Resolves an allowlisted dataset ID. Undefined selects the baseline, preserving requests that
 * predate dataset selection. Anything else must be an exact catalog ID; there is no path lookup.
 */
export function resolveDataset(datasetId: unknown): ResolvedDataset {
  if (datasetId === undefined) return REGISTRY.get(BASELINE_DATASET_ID)!
  if (typeof datasetId !== 'string' || !REGISTRY.has(datasetId)) {
    throw new UnknownDatasetError()
  }
  return REGISTRY.get(datasetId)!
}

export function assertCatalogMatchesRegistry(): void {
  for (const entry of DATASET_CATALOG) {
    const resolved = REGISTRY.get(entry.id)
    if (!resolved || resolved.version !== entry.version) {
      throw new Error(`Dataset catalog entry ${entry.id} does not match its fixture.`)
    }
  }
}
