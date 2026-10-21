import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

const request = (opinion, minute = 90, period = 'match-so-far') => ({
  opinion,
  selectedClock: {
    period: 2,
    minute,
    ...(minute === 90 ? { stoppageMinutes: 4 } : {}),
  },
  period,
})

test('answers a factual pass-rate comparison directly without changing its calculations', async () => {
  const result = await analyzeOpinion(
    request('Eastport had a higher pass completion rate than Northbridge.'),
  )

  assert.equal(result.provider, 'local')
  assert.match(result.providerLabel, /local rule-based interpreter/i)
  assert.equal(result.claims[0].assessment, 'contradicted')
  assert.match(
    result.summary,
    /^No — Eastport completed 23 of 32 passes \(71\.9%\), compared with Northbridge's 30 of 38 passes \(78\.9%\)\./,
  )
  assert.ok(result.claims[0].calculations.length > 0)
  assert.doesNotMatch(result.summary, /Claim 1|pass-\d+|Example references/)
  assert.match(result.summary, /Selected period: Match so far through 90\+4′/)
  assert.match(result.summary, /fictional match using real-player names/i)
})

test('answers mixed opinions separately, qualifies possession and keeps the goal as a historical anchor', async () => {
  const result = await analyzeOpinion(
    request(
      'Eastport dominated possession during this game and Northbridge scored against the run of play. It was a comfortable match for Eastport.',
    ),
  )

  assert.equal(result.claims.length, 3)
  assert.match(result.summary, /^Eastport had 44% of recorded possession; Northbridge had 56%\./)
  assert.match(result.summary, /challenges the possession-majority part/i)
  assert.match(result.summary, /cannot establish overall dominance/i)
  assert.match(result.summary, /cannot establish whether Northbridge scored against the run of play/i)
  assert.match(result.summary, /strictly before Northbridge's goal at 45\+3′/)
  assert.match(result.summary, /do not establish the broader judgement: “It was a comfortable match for Eastport”/)
  assert.doesNotMatch(result.summary, /event-\d+|turnover-\d+|pass-\d+/)

  const historical = result.claims[1]
  assert.equal(historical.evidence.find(({ role }) => role === 'anchor').reference.id, 'event-07')
  assert.ok(historical.evidence
    .filter(({ role }) => role !== 'anchor')
    .every(({ reference }) => reference.id !== 'event-07' && reference.id !== 'event-08'))
})

test('states unavailable physical data without substituting unrelated figures', async () => {
  const result = await analyzeOpinion(request('Eastport ran further than Northbridge.'))
  const claim = result.claims[0]

  assert.equal(claim.assessment, 'unavailable data')
  assert.deepEqual(claim.statistics, [])
  assert.deepEqual(claim.evidence, [])
  assert.match(result.summary, /^The requested metric is not recorded|^Running distance/i)
  assert.match(result.summary, /running distance.*not recorded/i)
  assert.doesNotMatch(result.summary, /shots|passes|possession|km|miles/i)
})

test('keeps the 57-minute and 58-minute answers aligned with their exclusive event cutoff', async () => {
  const opinion = 'Eastport had more shots on target than Northbridge.'
  const before = await analyzeOpinion(request(opinion, 57))
  const after = await analyzeOpinion(request(opinion, 58))

  assert.equal(before.claims[0].assessment, 'contradicted')
  assert.equal(after.claims[0].assessment, 'supported')
  assert.match(before.summary, /^No — Eastport recorded 2 shots on target/)
  assert.match(after.summary, /^Yes — Eastport recorded 3 shots on target/)
  assert.match(before.summary, /through 57′/)
  assert.match(after.summary, /through 58′/)
  assert.ok(before.periodEvents.every(({ time }) => time !== '58′'))
  assert.ok(after.periodEvents.some(({ time }) => time === '58′'))
  assert.doesNotMatch(before.summary, /event-\d+/)
})

test('uses strict historical scope for player statistics and leaves record IDs in evidence', async () => {
  const result = await analyzeOpinion(
    request('How many shots did Saka have before Northbridge scored?'),
  )
  const claim = result.claims[0]

  assert.match(result.summary, /Bukayo Saka: 1 shot/)
  assert.match(result.summary, /strictly before Northbridge's goal at 45\+3′/)
  assert.doesNotMatch(result.summary, /event-07|Claim 1/)
  assert.ok(claim.playerCalculations.every((trace) =>
    trace.denominatorRecordIds.every((id) => id !== 'event-07'),
  ))
  assert.ok(claim.evidence.some(({ role, reference }) =>
    role === 'anchor' && reference.id === 'event-07',
  ))
})
