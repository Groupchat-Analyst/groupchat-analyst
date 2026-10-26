export const BASELINE_DATASET_ID = 'northbridge-eastport-analysis-demo'
export const RETURN_DATASET_ID_PUBLIC = 'northbridge-eastport-return-demo'

export type DatasetCatalogEntry = {
  id: string
  version: string
  name: string
  description: string
  fictional: true
}

/**
 * Metadata only, so the web client can list matches without bundling fixtures.
 * The API resolves these IDs to data through its own allowlist.
 */
export const DATASET_CATALOG: readonly DatasetCatalogEntry[] = [
  {
    id: BASELINE_DATASET_ID,
    version: '3.0.0',
    name: 'Original match',
    description: 'Northbridge v Eastport — the verified demonstration fixture (16 recorded shots).',
    fictional: true,
  },
  {
    id: RETURN_DATASET_ID_PUBLIC,
    version: '1.0.0',
    name: 'Return match',
    description: 'Northbridge v Eastport — Eastport hold more of the ball, Northbridge take more shots (15 recorded shots).',
    fictional: true,
  },
]

export function findCatalogEntry(id: unknown): DatasetCatalogEntry | undefined {
  return typeof id === 'string'
    ? DATASET_CATALOG.find((entry) => entry.id === id)
    : undefined
}
