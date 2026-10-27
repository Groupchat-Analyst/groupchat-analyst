import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

const BASE = 'northbridge-eastport-analysis-demo'
const WEST = 'westhaven-kingswell-demo'
const RED = 'redmere-alderwick-demo'
const FT = { period: 2, minute: 90, stoppageMinutes: 4 }

async function run(opinion, datasetId, clock = { period: 2, minute: 57 }, period = 'match-so-far') {
  return analyzeOpinion({ opinion, selectedClock: clock, period, datasetId })
}

function check(result, assessment, values, metric = 'pass-completions') {
  const claim = result.claims[0]
  assert.equal(claim.claim.intent, 'factual-claim')
  assert.equal(claim.assessment, assessment)
  assert.ok(claim.statistics.length >= 2)
  assert.ok(claim.statistics.every((s) => s.metric === metric), 'completed counts only')
  assert.deepEqual(claim.statistics.map((s) => s.value), values)
  assert.ok(claim.evidence.length > 0)
  assert.doesNotMatch(result.fanReply, /attempt|%/i)
}

test('team completed-pass comparison keeps counts, with opposite and negated forms', async () => {
  check(await run('Northbridge completed more passes than Eastport', BASE), 'supported', [18, 14])
  check(await run('Northbridge had more completed passes than Eastport', BASE), 'supported', [18, 14])
  check(await run('Eastport completed fewer passes than Northbridge', BASE), 'supported', [18, 14])
  check(await run('Northbridge completed fewer passes than Eastport', BASE), 'contradicted', [18, 14])
  check(await run('Northbridge did not complete more passes than Eastport', BASE), 'contradicted', [18, 14])
  check(await run('Northbridge completed as many passes as Eastport', BASE), 'contradicted', [18, 14])
})

test('fixture aliases resolve to display names with the same counts', async () => {
  const full = await run('Westhaven FC completed more passes than Kingswell City', WEST, FT)
  const alias = await run('Westhaven completed more passes than Kingswell', WEST, FT)
  check(full, 'supported', [48, 38])
  check(alias, 'supported', [48, 38])
  assert.match(alias.fanReply, /Westhaven FC/)
  assert.doesNotMatch(JSON.stringify(alias), /Northbridge|Eastport/)
  check(await run('Kingswell City completed more passes than Westhaven FC', WEST, FT), 'contradicted', [48, 38])
  check(await run('Alderwick completed more passes than Redmere', RED, FT), 'contradicted', [46, 34])
})

test('selected window changes the counts', async () => {
  const early = await run('Northbridge completed more passes than Eastport', BASE, { period: 1, minute: 20 })
  const late = await run('Northbridge completed more passes than Eastport', BASE)
  const early_v = early.claims[0].statistics.map((s) => s.value)
  assert.ok(early_v.every((v, i) => v <= [18, 14][i]))
  assert.notDeepEqual(early_v, [18, 14])
  assert.deepEqual(late.claims[0].statistics.map((s) => s.value), [18, 14])
})

test('player comparison uses completions, not attempts, including negation', async () => {
  const a = await run('Saka completed more passes than Rice', BASE)
  assert.equal(a.claims[0].assessment, 'contradicted')
  assert.match(a.fanReply, /completion/)
  assert.doesNotMatch(a.fanReply, /attempt/)
  const b = await run('Saka didn’t complete more passes than Rice', BASE)
  assert.equal(b.claims[0].assessment, 'supported')
  assert.doesNotMatch(b.fanReply, /attempt/)
})

test('a slot name from another fixture is explicitly rejected, not assigned to a team', async () => {
  const r = await run('Eastport completed more passes than Northbridge', WEST, FT)
  assert.equal(r.claims[0].assessment, 'unrecognized language')
  assert.equal(r.claims[0].claim.subject, null)
  assert.deepEqual(r.claims[0].statistics, [])
  assert.deepEqual(r.claims[0].evidence, [])
  assert.match(r.fanReply, /Eastport and Northbridge are not part of Westhaven FC v Kingswell City/)
})
