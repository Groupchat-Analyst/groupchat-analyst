import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

const ask = (opinion, minute = 57, datasetId) =>
  analyzeOpinion({
    opinion,
    selectedClock: { period: 2, minute },
    period: 'match-so-far',
    ...(datasetId ? { datasetId } : {}),
  })

test('an omitted opponent in a two-team match resolves to the other team', async () => {
  const bare = await ask('Eastport had more shots on target.', 58)
  const explicit = await ask('Eastport had more shots on target than Northbridge.', 58)
  assert.equal(bare.claims[0].claim.meaning.comparison.opponent, 'Northbridge')
  assert.equal(bare.claims[0].assessment, explicit.claims[0].assessment)
  assert.deepEqual(bare.claims[0].statistics, explicit.claims[0].statistics)
})

test('a contrast with an omitted opponent produces two assessed claims, not a refusal', async () => {
  const result = await ask('Eastport had more possession than Northbridge but Northbridge had more shots')
  assert.equal(result.claims.length, 2)
  assert.ok(result.claims.every(({ claim }) => claim.intent === 'factual-claim'))
  assert.deepEqual(result.claims.map(({ claim }) => claim.meaning.comparison.metric), ['possession-percentage', 'shots'])
})

test('distance phrasing is an unavailable-data answer about running distance, not a refusal or a substitute', async () => {
  for (const text of [
    'Northbridge covered more distance than Eastport',
    'Eastport ran further than Northbridge',
    'Northbridge covered more ground than Eastport',
  ]) {
    const result = await ask(text)
    assert.equal(result.claims[0].claim.intent, 'unavailable-metric', text)
    assert.equal(result.claims[0].assessment, 'unavailable data', text)
    assert.match(result.claims[0].limitation, /running distance|physical/i, text)
    assert.equal(result.claims[0].statistics.length, 0, text)
  }
})

test('a team comparison phrased without a verb the local rules know is clarified, not guessed', async () => {
  const result = await ask('Eastport were better than Northbridge')
  assert.notEqual(result.claims[0].assessment, 'supported')
  assert.notEqual(result.claims[0].assessment, 'contradicted')
})
