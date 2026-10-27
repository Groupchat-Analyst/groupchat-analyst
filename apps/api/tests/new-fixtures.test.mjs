import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { getReplayFrame } from '../dist/api/src/functions/replay.js'
import { resolveDataset } from '../dist/api/src/datasets.js'
import { validateFixtureIntegrity } from '../dist/shared/src/fixtureIntegrity.js'
import { SYNTHETIC_MATCH_EVENTS } from '../dist/shared/src/match.js'

const WEST = 'westhaven-kingswell-demo'
const RED = 'redmere-alderwick-demo'
const FT = { period: 2, minute: 90, stoppageMinutes: 4 }
const ask = (opinion, datasetId, selectedClock = FT, period = 'match-so-far') =>
  analyzeOpinion({ opinion, selectedClock, period, datasetId })

test('new fixtures pass integrity and keep exactly 11 per side with 20 listed players', () => {
  for (const id of [WEST, RED]) {
    const d = resolveDataset(id)
    assert.deepEqual(validateFixtureIntegrity(d.events, d.evidence), [])
    assert.equal(d.evidence.dataset.id, id)
  }
})

test('responses carry display names, never internal slot names', async () => {
  const r = await ask('Westhaven had more shots than Kingswell', WEST)
  const text = JSON.stringify(r)
  assert.ok(text.includes('Westhaven FC') && text.includes('Kingswell City'))
  assert.ok(!/Northbridge|Eastport|Foreignclub/.test(text))
  assert.equal(r.claims[0].assessment, 'supported')
})

test('replay frame uses display names for score and events', () => {
  const frame = getReplayFrame({ period: 2, minute: 90, stoppageMinutes: 4 }, RED)
  assert.deepEqual(Object.keys(frame.score).sort(), ['Alderwick United', 'Redmere FC'])
  assert.deepEqual(frame.score, { 'Redmere FC': 1, 'Alderwick United': 2 })
  assert.ok(frame.events.every((e) => e.team === 'Redmere FC' || e.team === 'Alderwick United'))
})

test('goalless fixture: zero shots on target and no goal anchor', async () => {
  const zero = await ask('Kingswell City had no shots on target', WEST)
  assert.equal(zero.claims[0].assessment, 'supported')
  const anchor = await ask('Westhaven FC had no shots on target before the goal', WEST)
  assert.equal(anchor.claims[0].assessment, 'clarification needed')
  assert.match(anchor.fanReply, /No goal is recorded/)
})

test('ambiguous goal anchor and ambiguous player ask for clarification', async () => {
  const goal = await ask('Redmere FC had no shots on target before the goal', RED)
  assert.equal(goal.claims[0].assessment, 'clarification needed')
  const pedro = await ask('How many passes did Pedro complete?', WEST, { period: 2, minute: 62 })
  assert.match(pedro.fanReply, /Joao Pedro.*Pedro Neto|Pedro Neto.*Joao Pedro/)
})

test('player with shots but no pass attempts is not given a completion rate', async () => {
  const r = await ask('Haaland’s passing has been poor', WEST)
  assert.match(r.fanReply, /no recorded pass attempts/)
})

test('a substitute only has goals from the minute they score', async () => {
  const before = await ask('Abraham has scored', RED, { period: 2, minute: 85 })
  assert.notEqual(before.claims[0].assessment, 'supported')
  const after = await ask('Abraham has scored', RED, { period: 2, minute: 88 })
  assert.equal(after.claims[0].assessment, 'supported')
})

test('recent window differs from the whole match', async () => {
  const whole = await ask('Westhaven FC had more possession than Kingswell City', WEST)
  const recent = await ask('Westhaven FC had more possession than Kingswell City', WEST, FT, 'last-10-minutes')
  assert.notEqual(whole.claims[0].assessment, recent.claims[0].assessment)
})

test('another match’s team name is not silently reinterpreted', async () => {
  const r = await ask('Eastport had more shots than Westhaven', WEST)
  assert.ok(!/Eastport|Northbridge/.test(JSON.stringify(r)) || r.claims[0].assessment !== 'supported')
  assert.notEqual(r.claims[0].assessment, 'supported')
  assert.notEqual(r.claims[0].assessment, 'contradicted')
})

test('a player from another fixture is not resolved', async () => {
  const r = await ask('Haaland has scored', RED)
  assert.notEqual(r.claims[0].assessment, 'supported')
  assert.notEqual(r.claims[0].assessment, 'contradicted')
})

test('baseline evidence is untouched by the adapter', async () => {
  const r = await analyzeOpinion({ opinion: 'Eastport had more shots on target than Northbridge', selectedClock: { period: 2, minute: 58 }, period: 'match-so-far' })
  assert.equal(r.claims[0].assessment, 'supported')
  assert.equal(SYNTHETIC_MATCH_EVENTS.length > 0, true)
})
