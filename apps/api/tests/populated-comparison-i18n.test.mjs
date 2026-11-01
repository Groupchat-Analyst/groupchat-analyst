import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

const DATASET = 'northbridge-eastport-analysis-demo'
const cases = [
  { language: 'English', text: 'Eastport had more shots on target than Northbridge.' },
  { language: 'Español', text: 'Eastport tuvo más tiros a puerta que Northbridge.' },
  { language: 'Français', text: 'Eastport a eu plus de tirs cadrés que Northbridge.' },
  { language: 'Deutsch', text: 'Eastport hatte mehr Schüsse aufs Tor als Northbridge.' },
  { language: 'العربية', text: 'إيستبورت لديه تسديدات على المرمى أكثر من نورثبريدج.' },
]

for (const { language, text } of cases) {
  test(`${language}: shot-on-target comparison changes from 57′ to 58′`, async () => {
    const results = await Promise.all([57, 58].map((minute) =>
      analyzeOpinion({
        opinion: text,
        datasetId: DATASET,
        selectedClock: { period: 2, minute },
        period: 'match-so-far',
      }),
    ))

    for (const [index, minute] of [57, 58].entries()) {
      const result = results[index]
      const claim = result.claims[0]
      const expectedAssessment = minute === 57 ? 'contradicted' : 'supported'
      const eastportShotsOnTarget = minute === 57 ? 2 : 3

      assert.equal(result.provider, 'local')
      assert.equal(result.selectedTime, `${minute}′`)
      assert.equal(result.selectedPeriodLabel, `Match so far through ${minute}′`)
      assert.equal(claim.claim.intent, 'factual-claim')
      assert.equal(claim.claim.meaning.comparison.metric, 'shots-on-target')
      assert.equal(claim.assessment, expectedAssessment)
      assert.deepEqual(
        Object.fromEntries(claim.statistics.map(({ team, value }) => [team, value])),
        { Northbridge: 2, Eastport: eastportShotsOnTarget },
      )
      assert.ok(claim.evidence.length >= 2)
    }
  })
}