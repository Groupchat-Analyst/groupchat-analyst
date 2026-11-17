import {
  ARSENAL_LEICESTER_DATASET_ID as ARSENAL_LEICESTER_FIXTURE_ID,
  ARSENAL_LEICESTER_DATASET_VERSION,
  ARSENAL_LEICESTER_MATCH_EVENTS,
  ARSENAL_LEICESTER_MATCH_EVIDENCE,
  ARSENAL_LEICESTER_WINNING_GOAL,
  ARSENAL_LEICESTER_GOAL_SCORERS,
} from '../../shared/src/arsenalLeicester.js'
import {
  BASELINE_DATASET_ID,
  DATASET_CATALOG,
  REDMERE_DATASET_ID_PUBLIC,
  RETURN_DATASET_ID_PUBLIC,
  WESTHAVEN_DATASET_ID_PUBLIC,
  findCatalogEntry,
} from '../../shared/src/datasetCatalog.js'
import { EVIDENCE_CAPABILITIES, type EvidenceCapability } from '../../shared/src/evidence.js'
import type { EvidenceKind } from '../../shared/src/apiContracts.js'
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
import {
  WESTHAVEN_MATCH_EVENTS,
  WESTHAVEN_MATCH_EVIDENCE,
} from '../../shared/src/westhavenKingswell.js'
import {
  REDMERE_MATCH_EVENTS,
  REDMERE_MATCH_EVIDENCE,
} from '../../shared/src/redmereAlderwick.js'
import { IDENTITY_NAMING, type TeamNaming } from '../../shared/src/teamNaming.js'

export type ResolvedDataset = {
  id: string
  version: string
  events: MatchEvent[]
  evidence: SyntheticMatchEvidence
  /** Display names and aliases; identity for the original two fixtures. */
  naming: TeamNaming
  capabilities?: EvidenceCapability[]
  unavailableEvidence?: Partial<Record<EvidenceKind, string>>
  winningGoal?: {
    eventId: string
    sourcePlayerId: string
    scorerAliases: readonly string[]
  }
  goalScorers?: ReadonlyArray<{ eventId: string; sourcePlayerId: string; scorerAliases: readonly string[] }>
}

export class UnknownDatasetError extends Error {
  constructor() {
    super('Unknown datasetId. Choose one of the supported matches.')
    this.name = 'UnknownDatasetError'
  }
}

function namingFor(id: string): TeamNaming {
  const entry = findCatalogEntry(id)
  return entry ? { teams: entry.teams, aliases: entry.teamAliases } : IDENTITY_NAMING
}

const arsenalLeicesterCapabilities: EvidenceCapability[] = [
  ...EVIDENCE_CAPABILITIES.map((capability) => {
    if (capability.id === 'match-events') {
      return {
        ...capability,
        status: 'partial' as const,
        detail: 'The filtered source contains 1,768 match events; all 34 Wyscout Shot records are mapped, while other event kinds are not.',
      }
    }
    return {
      ...capability,
      status: 'not-recorded' as const,
      detail: 'This data is not mapped from the selected Wyscout event records.',
    }
  }),
  {
    id: 'shots-on-target',
    label: 'Shots on target',
    status: 'not-recorded' as const,
    detail: 'Shot accuracy and outcome classifications are not mapped; this metric is unavailable, not zero.',
  },
]

const REGISTRY = new Map<string, ResolvedDataset>([
  [
    BASELINE_DATASET_ID,
    {
      id: BASELINE_DATASET_ID,
      version: SYNTHETIC_MATCH_EVIDENCE.dataset.version,
      events: SYNTHETIC_MATCH_EVENTS,
      evidence: SYNTHETIC_MATCH_EVIDENCE,
      naming: IDENTITY_NAMING,
    },
  ],
  [
    RETURN_DATASET_ID_PUBLIC,
    {
      id: RETURN_DATASET_ID_PUBLIC,
      version: RETURN_MATCH_EVIDENCE.dataset.version,
      events: RETURN_MATCH_EVENTS,
      evidence: RETURN_MATCH_EVIDENCE,
      naming: IDENTITY_NAMING,
    },
  ],
  [
    WESTHAVEN_DATASET_ID_PUBLIC,
    {
      id: WESTHAVEN_DATASET_ID_PUBLIC,
      version: WESTHAVEN_MATCH_EVIDENCE.dataset.version,
      events: WESTHAVEN_MATCH_EVENTS,
      evidence: WESTHAVEN_MATCH_EVIDENCE,
      naming: namingFor(WESTHAVEN_DATASET_ID_PUBLIC),
    },
  ],
  [
    REDMERE_DATASET_ID_PUBLIC,
    {
      id: REDMERE_DATASET_ID_PUBLIC,
      version: REDMERE_MATCH_EVIDENCE.dataset.version,
      events: REDMERE_MATCH_EVENTS,
      evidence: REDMERE_MATCH_EVIDENCE,
      naming: namingFor(REDMERE_DATASET_ID_PUBLIC),
    },
  ],
  [
    ARSENAL_LEICESTER_FIXTURE_ID,
    {
      id: ARSENAL_LEICESTER_FIXTURE_ID,
      version: ARSENAL_LEICESTER_DATASET_VERSION,
      events: ARSENAL_LEICESTER_MATCH_EVENTS,
      evidence: ARSENAL_LEICESTER_MATCH_EVIDENCE,
      naming: namingFor(ARSENAL_LEICESTER_FIXTURE_ID),
      capabilities: arsenalLeicesterCapabilities,
      unavailableEvidence: {
        possession: 'Possession intervals are not mapped from the source records, so possession percentages are unavailable.',
        'territorial-control': 'Continuous territory and defensive-shape data are not included in the mapped records.',
        'shots-on-target': 'Wyscout shot accuracy and outcome classifications are not mapped; no shot-on-target count is inferred.',
        passing: 'Pass events are not mapped into the application evidence model.',
        'possession-losses': 'Turnovers and recoveries are not mapped into the application evidence model.',
        'physical-measurements': 'Physical and tracking measurements are not included in the mapped records.',
        'build-up-phase': 'Versioned build-up annotations are not included in the mapped records.',
        lineups: 'Lineups and substitutions are not mapped; player minutes and participation are unavailable.',
        'shot-location': 'Pitch coordinates and shot locations are not mapped.',
        'player-events': 'Player names, lineups, and player-performance metrics are not mapped; source shooter IDs are retained only on shot records.',
      },
      winningGoal: ARSENAL_LEICESTER_WINNING_GOAL,
      goalScorers: ARSENAL_LEICESTER_GOAL_SCORERS,
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
