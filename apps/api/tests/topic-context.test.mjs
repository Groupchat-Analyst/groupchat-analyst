import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

const B = 'northbridge-eastport-analysis-demo'
const W = 'westhaven-kingswell-demo'
const RD = 'redmere-alderwick-demo'
const FT = { period: 2, minute: 90, stoppageMinutes: 4 }
const at = (minute) => ({ period: 2, minute })

const run = (opinion, datasetId, selectedClock = at(57), period = 'match-so-far') =>
  analyzeOpinion({ opinion, selectedClock, period, datasetId })

const metrics = (claim, metric) => claim.statistics.filter((s) => s.metric === metric)

test('keeper opinion shows the selected team’s shots on target in the selected window and stays qualitative', async () => {
  for (const [opinion, team] of [
    ['Eastport are not testing the keeper', 'Eastport'],
    ['Northbridge are testing the keeper', 'Northbridge'],
  ]) {
    const r = await run(opinion, B)
    const claim = r.claims[0]
    assert.equal(claim.assessment, 'insufficient evidence for a firm conclusion')
    assert.deepEqual(metrics(claim, 'shots-on-target').map((s) => [s.team, s.value]), [[team, 2]])
    assert.match(r.fanReply, /qualitative judgement/)
  }
  const early = await run('Eastport are not testing the keeper', B, { period: 1, minute: 10 })
  const [sot] = metrics(early.claims[0], 'shots-on-target')
  assert.ok(sot.value <= 2)
  const late = await run('Eastport are testing the keeper', B, at(58))
  assert.equal(metrics(late.claims[0], 'shots-on-target')[0].value, 3)
})

test('keeper opinion on a new fixture uses display names and that fixture’s counts', async () => {
  const r = await run('Kingswell are not testing the keeper', W, FT)
  assert.deepEqual(metrics(r.claims[0], 'shots-on-target').map((s) => [s.team, s.value]), [['Kingswell City', 0]])
  assert.doesNotMatch(JSON.stringify(r), /Northbridge|Eastport/)
})

test('defensive-shape opinions keep the limitation and label possession as context only', async () => {
  for (const opinion of ['Northbridge parked the bus', 'Northbridge are sitting deep', 'Northbridge are not sitting deep']) {
    const r = await run(opinion, B)
    const claim = r.claims[0]
    assert.equal(claim.assessment, 'insufficient evidence for a firm conclusion')
    assert.match(r.fanReply, /Nothing here records defensive shape or positioning/)
    assert.match(r.fanReply, /For context only.*does not support or contradict defensive shape/s)
    assert.ok(claim.evidence.length > 0)
    assert.ok(claim.evidence.every((e) => e.role === 'context'), 'possession never supports or challenges shape')
    assert.ok(claim.calculations.every((c) => c.metric === 'possession-percentage' && c.denominatorRecordIds.length > 0))
  }
})

test('possession context follows the selected window and fixture', async () => {
  const full = await run('Northbridge parked the bus', B)
  const early = await run('Northbridge parked the bus', B, { period: 1, minute: 20 })
  assert.notDeepEqual(
    metrics(full.claims[0], 'possession-percentage').map((s) => s.value),
    metrics(early.claims[0], 'possession-percentage').map((s) => s.value),
  )
  const r = await run('Kingswell City parked the bus', W, FT, 'last-10-minutes')
  assert.deepEqual(
    metrics(r.claims[0], 'possession-percentage').map((s) => [s.team, s.value]),
    [['Westhaven FC', 40], ['Kingswell City', 60]],
  )
  assert.match(r.fanReply, /Kingswell City had 60%.*Westhaven FC's 40%/)
  assert.doesNotMatch(JSON.stringify(r), /Northbridge|Eastport/)
})

test('pressing opinion surfaces attributed pressure observations with sample coverage and no intensity claim', async () => {
  const r = await run('Northbridge are pressing high', B)
  const claim = r.claims[0]
  assert.equal(claim.assessment, 'insufficient evidence for a firm conclusion')
  assert.deepEqual(metrics(claim, 'pressure-observations').map((s) => [s.team, s.value]), [['Northbridge', 2], ['Eastport', 2]])
  assert.equal(claim.evidence.length, 2)
  assert.ok(claim.evidence.every((e) => e.role === 'context' && e.reference.team === 'Northbridge' && /pressure coverage is partial/.test(e.reference.description)))
  assert.match(r.fanReply, /partial sample/)
  assert.match(r.fanReply, /doesn't show continuous pressing, how high it was, or its intensity/)
})

test('a zero pressure count is reported as a sampled zero, not as no pressing', async () => {
  const r = await run('Northbridge are pressing high', B, { period: 1, minute: 3 })
  const claim = r.claims[0]
  assert.equal(claim.evidence.length, 0)
  if (metrics(claim, 'pressure-observations').find((s) => s.team === 'Northbridge')?.value === 0) {
    assert.match(r.fanReply, /No selected pressure observations are recorded for Northbridge.*doesn't show Northbridge weren't pressing/s)
  }
})

test('pressing opinion on a new fixture is attributed to the display name', async () => {
  const r = await run('Redmere are pressing high', RD, FT)
  assert.doesNotMatch(JSON.stringify(r), /Northbridge|Eastport/)
  assert.match(r.fanReply, /Redmere FC/)
  assert.match(r.fanReply, /partial sample/)
})
