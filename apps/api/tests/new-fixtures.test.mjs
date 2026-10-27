import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { getReplayFrame } from '../dist/api/src/functions/replay.js'
import { resolveDataset } from '../dist/api/src/datasets.js'
import { validateFixtureIntegrity } from '../dist/shared/src/fixtureIntegrity.js'
import { SYNTHETIC_MATCH_EVENTS } from '../dist/shared/src/match.js'
import { toDisplay, toSlotOpinion } from '../dist/shared/src/teamNaming.js'

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

test('foreign opponents are preserved distinctly and never attributed to a fixture team', async () => {
  let providerCalls = 0
  const provider = {
    name: 'foundry',
    async interpret() {
      providerCalls += 1
      throw new Error('Foreign team opinions must not be sent to a model provider')
    },
  }
  for (const [datasetId, opinion, foreignNames, fixtureTeams] of [
    [WEST, 'Eastport had more shots than Northbridge', ['Eastport', 'Northbridge'], ['Westhaven FC', 'Kingswell City']],
    [RED, 'Northbridge had more shots than Eastport', ['Northbridge', 'Eastport'], ['Redmere FC', 'Alderwick United']],
  ]) {
    const r = await analyzeOpinion({
      opinion,
      datasetId,
      selectedClock: FT,
      period: 'match-so-far',
    }, provider)
    const claim = r.claims[0]
    assert.equal(r.provider, 'local')
    assert.match(r.providerLabel, /local rule-based interpreter/)
    assert.equal(claim.assessment, 'unrecognized language')
    assert.equal(claim.claim.intent, 'unrecognized-language')
    assert.equal(claim.claim.subject, null)
    assert.equal(claim.claim.meaning.comparison, null)
    assert.equal(claim.claim.requiredEvidence.length, 0)
    assert.deepEqual(claim.statistics, [])
    assert.deepEqual(claim.evidence, [])
    assert.ok(foreignNames.every((name) => claim.claim.text.includes(name)))
    assert.ok(foreignNames.every((name) => r.fanReply.includes(name)))
    assert.ok(fixtureTeams.every((name) => r.fanReply.includes(name)))
    assert.match(r.fanReply, /not part of/)
    assert.doesNotMatch(JSON.stringify(r), /__foreign_|Foreignclub/)
  }
  assert.equal(providerCalls, 0)
})

test('short team aliases retain distinct fixture identities in claim and reply', async () => {
  const west = await ask('Westhaven had more shots than Kingswell', WEST)
  const red = await ask('Redmere had more shots than Alderwick', RED, { period: 2, minute: 57 })
  assert.equal(west.claims[0].claim.subject, 'Westhaven FC')
  assert.equal(west.claims[0].claim.meaning.comparison.opponent, 'Kingswell City')
  assert.match(west.fanReply, /Westhaven FC have 9 shots to Kingswell City's 3/)
  assert.equal(red.claims[0].claim.subject, 'Redmere FC')
  assert.equal(red.claims[0].claim.meaning.comparison.opponent, 'Alderwick United')
  assert.match(red.fanReply, /Redmere FC have 4 shots to Alderwick United's 2/)
})

test('slot translation preserves distinct names, including names containing the opposite slot', () => {
  const naming = {
    teams: ['Eastport United', 'Northbridge City'],
    aliases: [['Eastport United'], ['Northbridge City']],
  }
  const slotted = toSlotOpinion('Eastport United beat Northbridge City', naming)
  assert.deepEqual(slotted.foreign, {})
  assert.equal(slotted.text, 'Northbridge beat Eastport')
  assert.deepEqual(
    toDisplay(
      { score: { Northbridge: 2, Eastport: 1 }, reply: 'Northbridge beat Eastport' },
      naming,
    ),
    { score: { 'Eastport United': 2, 'Northbridge City': 1 }, reply: 'Eastport United beat Northbridge City' },
  )
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
