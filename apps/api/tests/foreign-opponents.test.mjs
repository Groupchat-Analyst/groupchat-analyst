import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

const B = 'northbridge-eastport-analysis-demo'
const R = 'northbridge-eastport-return-demo'
const W = 'westhaven-kingswell-demo'
const RD = 'redmere-alderwick-demo'
const FT = { period: 2, minute: 90, stoppageMinutes: 4 }
const ask = (opinion, datasetId, provider) => analyzeOpinion({ opinion, datasetId, selectedClock: FT, period: 'match-so-far' }, provider)

test('catalog foreign opponents never become possession context for another team, in either order', async () => {
  for (const [datasetId, opinion] of [
    [W, 'Kingswell had more possession than Redmere'],
    [W, 'Redmere had more possession than Kingswell'],
    [RD, 'Redmere had less possession than Westhaven'],
    [RD, 'Westhaven had less possession than Redmere'],
    [B, 'Northbridge had more possession than Westhaven'],
    [R, 'Alderwick had more possession than Eastport'],
    [W, 'Kingswell did not have more possession than Redmere FC'],
    [RD, 'REDMERE had fewer shots than KINGSWELL CITY'],
  ]) {
    const response = await ask(opinion, datasetId)
    assert.match(response.fanReply, /not part of/, opinion)
    for (const result of response.claims) {
      assert.equal(result.assessment, 'unrecognized language', opinion)
      assert.equal(result.claim.subject, null, opinion)
      assert.equal(result.claim.meaning.comparison, null, opinion)
      assert.deepEqual(result.statistics, [], opinion)
      assert.deepEqual(result.playerStatistics, [], opinion)
      assert.deepEqual(result.evidence, [], opinion)
    }
    assert.doesNotMatch(response.fanReply, /backs up|goes against|\d+%|possession part/)
    assert.doesNotMatch(JSON.stringify(response), /__foreign_/)
  }
})

test('foreign aliases bypass a supplied model on both original and new fixtures', async () => {
  let calls = 0
  const provider = { name: 'foundry', async interpret() { calls += 1; throw new Error('Must not call transport') } }
  for (const [id, opinion] of [[B, 'Northbridge had more shots than Redmere'], [RD, 'Westhaven had more possession than Alderwick']]) {
    const response = await ask(opinion, id, provider)
    assert.equal(response.provider, 'local')
    assert.match(response.fanReply, /not part of/)
    assert.deepEqual(response.claims[0].evidence, [])
  }
  assert.equal(calls, 0)
})

test('distinct outside aliases keep their original spelling in claims and replies', async () => {
  for (const [id, opinion, names] of [
    [B, 'Westhaven FC had more possession than Alderwick United', ['Westhaven FC', 'Alderwick United']],
    [W, 'Redmere had more shots than Alderwick', ['Redmere', 'Alderwick']],
    [RD, 'Northbridge had more shots than Eastport', ['Northbridge', 'Eastport']],
  ]) {
    const response = await ask(opinion, id)
    assert.equal(response.claims[0].claim.text, opinion)
    for (const name of names) assert.ok(response.fanReply.includes(name), name)
    assert.deepEqual(response.claims[0].statistics, [])
  }
})

test('uncatalogued explicit opponents ask for clarification without substitute figures', async () => {
  for (const [id, opinion] of [
    [B, 'Northbridge had more possession than Chelsea'],
    [W, 'Kingswell had less possession than Arsenal'],
    [RD, 'Alderwick completed more passes than Mystery FC'],
    [W, 'Palmer completed more passes than Saka'],
  ]) {
    const response = await ask(opinion, id)
    assert.equal(response.claims[0].assessment, 'clarification needed', opinion)
    assert.match(response.fanReply, /cannot resolve both sides/, opinion)
    assert.deepEqual(response.claims[0].statistics, [], opinion)
    assert.deepEqual(response.claims[0].playerStatistics, [], opinion)
    assert.deepEqual(response.claims[0].evidence, [], opinion)
    assert.doesNotMatch(response.fanReply, /backs up|goes against|\d+%/)
  }
})

test('valid aliases, descriptive possession opinions and completed-pass comparisons remain available', async () => {
  for (const [id, opinion, assessment] of [
    [W, 'Westhaven had more shots than Kingswell', 'supported'],
    [RD, 'Redmere had more shots than Alderwick', 'supported'],
    [B, 'Eastport had more shots on target.', 'supported'],
    [W, 'Westhaven dominated possession', 'insufficient evidence for a firm conclusion'],
    [RD, 'Alderwick completed more passes than Redmere', 'contradicted'],
  ]) {
    const response = await ask(opinion, id)
    assert.equal(response.claims[0].assessment, assessment, opinion)
    assert.ok(response.claims[0].statistics.length > 0)
    assert.doesNotMatch(response.fanReply, /not part of|cannot resolve both sides/)
  }
})
