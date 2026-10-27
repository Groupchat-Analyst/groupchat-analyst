/**
 * Illustrative homepage preview. It is a static model of two verified local-rule responses for the
 * Original fixture and is never fetched. An API test replays both clocks through the real analysis
 * path and fails if any figure, assessment, reply or fixture version here drifts.
 */
export const HOME_PREVIEW = {
  datasetId: 'northbridge-eastport-analysis-demo',
  datasetVersion: '3.0.0',
  opinion: 'Eastport had more shots on target than Northbridge.',
  frames: [
    {
      minute: 57,
      clockLabel: '57′',
      assessment: 'contradicted',
      verdict: 'No',
      reply: 'No — Eastport and Northbridge are level on 2 shots on target each.',
      score: { Northbridge: 1, Eastport: 0 },
      shotsOnTarget: { Northbridge: 2, Eastport: 2 },
    },
    {
      minute: 58,
      clockLabel: '58′',
      assessment: 'supported',
      verdict: 'Yes',
      reply: "Yes — Eastport have 3 shots on target to Northbridge's 2.",
      score: { Northbridge: 1, Eastport: 1 },
      shotsOnTarget: { Northbridge: 2, Eastport: 3 },
    },
  ],
} as const

export type HomePreviewFrame = (typeof HOME_PREVIEW.frames)[number]
