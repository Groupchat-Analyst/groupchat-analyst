import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { DATASET_CATALOG } from '../dist/shared/src/datasetCatalog.js'
import { getMatchTimeOptions } from '../dist/shared/src/matchClock.js'

const validClock = (c, secondHalfStoppageMinutes) =>
  getMatchTimeOptions(secondHalfStoppageMinutes).some((o) => o.period === c.period && o.minute === c.minute && (o.stoppageMinutes ?? 0) === (c.stoppageMinutes ?? 0))

for (const dataset of DATASET_CATALOG) {
  test(`${dataset.name}: moments and examples are valid, and each example runs against its own dataset`, async () => {
    const minimumExamples = dataset.historicalReplay ? 1 : 4
    const minimumMoments = dataset.historicalReplay ? 2 : 4
    assert.ok(dataset.moments.length >= minimumMoments && dataset.examples.length >= minimumExamples && dataset.examples.length <= 6)
    const stoppage = dataset.historicalReplay ? 6 : undefined
    for (const { clock, label } of dataset.moments) assert.ok(validClock(clock, stoppage), `moment ${label}`)
    for (const example of dataset.examples) {
      assert.ok(validClock(example.clock, stoppage), `example ${example.id} clock`)
      const result = await analyzeOpinion({
        opinion: example.text,
        selectedClock: example.clock,
        period: example.period,
        datasetId: dataset.id,
      })
      assert.equal(result.evidenceFoundation.dataset.id, dataset.id)
      assert.equal(result.evidenceFoundation.dataset.version, dataset.version)
      assert.notEqual(result.claims[0].assessment, 'unrecognized language', `${example.id} must not be refused`)
      assert.equal(result.claims[0].assessment, example.expectedAssessment, example.id)
    }
  })
}
