import assert from 'node:assert/strict'
import test from 'node:test'
import { matchHash, parseRoute } from './routes.ts'
import { createAnalysisRequest, createSubmissionContext } from './matchday.ts'

const BASE = 'northbridge-eastport-analysis-demo'
const RET = 'northbridge-eastport-return-demo'

test('routes resolve home, matches and allowlisted matches only', () => {
  assert.deepEqual(parseRoute(''), { name: 'home' })
  assert.deepEqual(parseRoute('#/'), { name: 'home' })
  assert.deepEqual(parseRoute('#/matches'), { name: 'matches' })
  assert.deepEqual(parseRoute(matchHash(RET)), { name: 'match', datasetId: RET, demo: false })
  assert.deepEqual(parseRoute(matchHash(BASE, true)), { name: 'match', datasetId: BASE, demo: true })
})

test('unknown, malformed or path-like match IDs never select a match', () => {
  for (const hash of ['#/match/nope', '#/match/%E0%A4%A', '#/match/..%2F..%2Fsecret', '#/match/', '#/other']) {
    assert.equal(parseRoute(hash).name, 'matches', hash)
  }
  assert.equal(parseRoute('#/match/nope').unknownId, 'nope')
})

test('the guided demo only exists for the original match', () => {
  assert.equal(parseRoute(`#/match/${RET}/demo`).demo, false)
})

test('submission context carries the dataset into the request, and omits it when absent', () => {
  const clock = { period: 2, minute: 57 }
  const withId = createAnalysisRequest(createSubmissionContext('x', clock, 'match-so-far', RET))
  assert.equal(withId.datasetId, RET)
  assert.equal(withId.inputLanguage, 'en')
  const without = createAnalysisRequest(createSubmissionContext('x', clock, 'match-so-far'))
  assert.equal('datasetId' in without, false)
  assert.equal(without.inputLanguage, 'en')
})
