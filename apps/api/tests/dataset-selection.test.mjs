import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { getReplayFrame, createReplayHandler } from '../dist/api/src/functions/replay.js'
import { resolveDataset } from '../dist/api/src/datasets.js'
import { DATASET_CATALOG } from '../dist/shared/src/datasetCatalog.js'
import { SYNTHETIC_MATCH_EVIDENCE } from '../dist/shared/src/evidence.js'

const RETURN_ID = 'northbridge-eastport-return-demo'
const BASELINE_ID = 'northbridge-eastport-analysis-demo'

const ask = (opinion, clock, { period = 'match-so-far', datasetId } = {}) =>
  analyzeOpinion({
    opinion,
    selectedClock: clock,
    period,
    ...(datasetId === undefined ? {} : { datasetId }),
  })
const at = (minute, stoppageMinutes, periodNumber = minute > 45 ? 2 : 1) => ({
  period: periodNumber,
  minute,
  ...(stoppageMinutes === undefined ? {} : { stoppageMinutes }),
})
const stat = (result, team) => result.claims[0].statistics.find((s) => s.team === team)

test('catalog entries resolve to fixtures with matching ID and version', () => {
  assert.deepEqual(DATASET_CATALOG.map((d) => d.id), [BASELINE_ID, RETURN_ID])
  for (const entry of DATASET_CATALOG) {
    const resolved = resolveDataset(entry.id)
    assert.equal(resolved.evidence.dataset.id, entry.id)
    assert.equal(resolved.evidence.dataset.version, entry.version)
  }
})

test('omitted datasetId behaves identically to the explicit baseline', async () => {
  const clock = at(58)
  const opinion = 'Eastport had more shots on target than Northbridge'
  const omitted = await ask(opinion, clock)
  const explicit = await ask(opinion, clock, { datasetId: BASELINE_ID })
  assert.deepEqual(explicit, omitted)
  assert.equal(omitted.evidenceFoundation.dataset.id, SYNTHETIC_MATCH_EVIDENCE.dataset.id)
})

test('57′ → 58′ baseline walkthrough is unchanged by dataset support', async () => {
  const opinion = 'Eastport had more shots on target than Northbridge'
  const early = await ask(opinion, at(57))
  const later = await ask(opinion, at(58))
  assert.equal(early.claims[0].assessment, 'contradicted')
  assert.equal(later.claims[0].assessment, 'supported')
  assert.deepEqual(early.score, { Northbridge: 1, Eastport: 0 })
  assert.deepEqual(later.score, { Northbridge: 1, Eastport: 1 })
})

test('unknown, malformed or path-like dataset IDs fail clearly and never select another match', async () => {
  for (const datasetId of ['nope', '', '../../etc/passwd', 'C:\\data.json', '__proto__', 'constructor', null, 7, {}, [RETURN_ID]]) {
    await assert.rejects(
      ask('Eastport had more shots than Northbridge', at(57), { datasetId }),
      /datasetId is not a supported match/,
      `datasetId ${JSON.stringify(datasetId)} must be rejected`,
    )
  }
  await assert.rejects(
    analyzeOpinion({ opinion: 'x', selectedClock: at(57), period: 'match-so-far', datasetId: RETURN_ID, extra: 1 }),
    /optionally datasetId/,
  )
})

test('response metadata identifies the dataset and clock actually assessed', async () => {
  const result = await ask('Northbridge had more shots than Eastport', at(90, 4), { datasetId: RETURN_ID })
  assert.equal(result.evidenceFoundation.dataset.id, RETURN_ID)
  assert.equal(result.evidenceFoundation.dataset.version, '1.0.0')
  assert.equal(result.selectedTime, '90+4′')
  assert.deepEqual(result.score, { Northbridge: 2, Eastport: 1 })
})

test('return fixture: possession advantage differs from shot advantage', async () => {
  const clock = at(90, 4)
  const shots = await ask('Northbridge had more shots than Eastport', clock, { datasetId: RETURN_ID })
  const possession = await ask('Eastport had more possession than Northbridge', clock, { datasetId: RETURN_ID })
  assert.equal(shots.claims[0].assessment, 'supported')
  assert.equal(stat(shots, 'Northbridge').value, 11)
  assert.equal(stat(shots, 'Eastport').value, 4)
  assert.equal(possession.claims[0].assessment, 'supported')
  assert.ok(stat(possession, 'Eastport').value > stat(possession, 'Northbridge').value)
})

test('return fixture: a recent window differs from the cumulative match', async () => {
  const claim = 'Northbridge had more possession than Eastport'
  const cumulative = await ask(claim, at(88), { datasetId: RETURN_ID })
  const recent = await ask(claim, at(88), { datasetId: RETURN_ID, period: 'last-10-minutes' })
  assert.equal(cumulative.claims[0].assessment, 'contradicted')
  assert.equal(recent.claims[0].assessment, 'supported')
  assert.notEqual(recent.claims[0].periodLabel, cumulative.claims[0].periodLabel)
})

test('return fixture: chronology, stoppage time and substitutions do not leak later records', async () => {
  const before = await ask('Northbridge had more shots than Eastport', at(56), { datasetId: RETURN_ID })
  assert.deepEqual(before.score, { Northbridge: 0, Eastport: 1 })
  assert.ok(before.periodEvents.every((e) => !['return-event-08', 'return-event-14'].includes(e.id)))
  const goalMinute = await ask('Northbridge had more shots than Eastport', at(57), { datasetId: RETURN_ID })
  assert.deepEqual(goalMinute.score, { Northbridge: 1, Eastport: 1 })
  const firstHalfStoppage = await ask('Northbridge had more shots than Eastport', at(45, 1), { datasetId: RETURN_ID })
  assert.ok(firstHalfStoppage.periodEvents.some((e) => e.id === 'return-event-06'))
  assert.ok(!firstHalfStoppage.periodEvents.some((e) => e.id === 'return-event-07'))
  const beforeSubShot = await ask('Northbridge had more shots than Eastport', at(73), { datasetId: RETURN_ID })
  assert.ok(!beforeSubShot.periodEvents.some((e) => e.id === 'return-event-11'))
  const afterSubShot = await ask('Northbridge had more shots than Eastport', at(74), { datasetId: RETURN_ID })
  const substituteShot = afterSubShot.periodEvents.find((e) => e.id === 'return-event-11')
  assert.match(substituteShot.description, /north-player-12/)
})

test('return fixture: zero-attempt players have a null completion rate, not zero', async () => {
  const result = await ask('Gyökeres completion rate has been poor', at(90, 4), { datasetId: RETURN_ID })
  const text = JSON.stringify(result.claims[0])
  assert.doesNotMatch(text, /"completion[^"]*":0\b/)
  assert.doesNotMatch(result.fanReply, /Which player/)
})

test('player references resolve against the selected fixture, not the baseline', async () => {
  // north-player-12 comes on at 70′ in the return match but at 65′ in the baseline.
  const returnAt68 = await ask('Saka has had a horrible game', at(68), { datasetId: RETURN_ID })
  assert.equal(returnAt68.claims[0].claim.playerSubject.id, 'north-player-09')
  const baselineShots = await ask('Northbridge had more shots than Eastport', at(90, 4))
  assert.ok(!baselineShots.periodEvents.some((e) => e.id.startsWith('return-')))
  const returnShots = await ask('Northbridge had more shots than Eastport', at(90, 4), { datasetId: RETURN_ID })
  assert.ok(returnShots.periodEvents.every((e) => e.id.startsWith('return-')))
})

test('interleaved requests for different matches remain independent', async () => {
  const jobs = []
  for (let i = 0; i < 6; i += 1) {
    const datasetId = i % 2 === 0 ? undefined : RETURN_ID
    jobs.push(
      ask('Northbridge had more shots than Eastport', at(90, 4), { datasetId }).then((r) => ({ datasetId, r })),
    )
  }
  for (const { datasetId, r } of await Promise.all(jobs)) {
    assert.equal(r.evidenceFoundation.dataset.id, datasetId ?? BASELINE_ID)
    if (datasetId) assert.equal(stat(r, 'Northbridge').value, 11)
    else assert.notEqual(stat(r, 'Northbridge').value, 11)
    assert.ok(r.periodEvents.every((e) => (datasetId ? e.id.startsWith('return-') : !e.id.startsWith('return-'))))
  }
})

test('replay frames use the selected dataset and reject unknown IDs', () => {
  const base = getReplayFrame(at(57))
  assert.equal(base.datasetId, BASELINE_ID)
  assert.deepEqual(getReplayFrame(at(57), BASELINE_ID), base)
  const ret = getReplayFrame(at(57), RETURN_ID)
  assert.equal(ret.datasetId, RETURN_ID)
  assert.equal(ret.datasetVersion, '1.0.0')
  assert.ok(ret.events.every((e) => e.id.startsWith('return-')))
  assert.deepEqual(ret.score, { Northbridge: 1, Eastport: 1 })
  assert.throws(() => getReplayFrame(at(57), 'other'), TypeError)
  assert.throws(() => getReplayFrame(at(57), null), TypeError)
})

test('replay handler returns 400 for an unknown dataset and 200 for the return match', async () => {
  const handler = createReplayHandler()
  const call = (body) => handler({ json: async () => body }, { error() {} })
  const bad = await call({ selectedClock: at(57), datasetId: 'nope' })
  assert.equal(bad.status, 400)
  assert.match(bad.jsonBody.error, /not a supported match/)
  const ok = await call({ selectedClock: at(57), datasetId: RETURN_ID })
  assert.equal(ok.status, 200)
  assert.equal(ok.jsonBody.datasetId, RETURN_ID)
})
