import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { HOME_PREVIEW } from '../dist/shared/src/homePreview.js'

test('the homepage preview matches the real local analysis at 57′ and 58′', async () => {
  for (const frame of HOME_PREVIEW.frames) {
    const real = await analyzeOpinion({
      opinion: HOME_PREVIEW.opinion,
      selectedClock: { period: 2, minute: frame.minute },
      period: 'match-so-far',
      datasetId: HOME_PREVIEW.datasetId,
    })
    assert.equal(real.provider, 'local')
    assert.equal(real.evidenceFoundation.dataset.id, HOME_PREVIEW.datasetId)
    assert.equal(real.evidenceFoundation.dataset.version, HOME_PREVIEW.datasetVersion)
    assert.deepEqual(Object.keys(real.score), HOME_PREVIEW.teams)
    assert.equal(real.claims[0].assessment, frame.assessment)
    assert.equal(real.fanReply, frame.reply)
    assert.deepEqual(real.score, frame.score)
    const shots = Object.fromEntries(real.claims[0].statistics.map(({ team, value }) => [team, value]))
    assert.deepEqual(shots, frame.shotsOnTarget)
  }
})

test('the preview keeps match score and shots on target as different figures', () => {
  for (const frame of HOME_PREVIEW.frames) {
    assert.notDeepEqual(frame.score, frame.shotsOnTarget)
  }
  assert.equal(HOME_PREVIEW.frames[0].assessment, 'contradicted')
  assert.equal(HOME_PREVIEW.frames[1].assessment, 'supported')
})
