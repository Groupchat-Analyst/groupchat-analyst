import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

const ask = (opinion, clock = { period: 2, minute: 57 }, period = 'match-so-far', datasetId) =>
  analyzeOpinion({
    opinion,
    selectedClock: clock,
    period,
    ...(datasetId ? { datasetId } : {}),
  })

const first = (result) => result.claims[0]

test('negated goals: the first-half window is read from the wording, not the selected time', async () => {
  for (const text of [
    'Northbridge did not score in the first half',
    'Northbridge didn’t score before half-time',
    'Northbridge did not score during the first half',
  ]) {
    const result = await ask(text)
    assert.equal(first(result).claim.intent, 'factual-claim', text)
    assert.equal(first(result).assessment, 'contradicted', text)
    assert.ok(first(result).evidence.some(({ reference }) => /45\+3/.test(reference.time)), text)
    assert.match(result.fanReply, /did score before half-time, at 45\+3/, text)
  }
  const positive = await ask('Northbridge scored in the first half')
  assert.equal(first(positive).assessment, 'supported')
  const eastport = await ask('Eastport did not score in the first half')
  assert.equal(first(eastport).assessment, 'supported')
})

test('negated goals without a window assert a zero goal count in the selected window', async () => {
  const before = await ask('Eastport had no goals', { period: 2, minute: 57 })
  assert.equal(first(before).assessment, 'supported')
  assert.equal(first(before).calculations[0].numerator, 0)
  const after = await ask('Eastport had no goals', { period: 2, minute: 58 })
  assert.equal(first(after).assessment, 'contradicted')
  assert.equal(first(after).calculations[0].numerator, 1)
  const notScored = await ask('Northbridge has not scored')
  assert.equal(first(notScored).assessment, 'contradicted')
})

test('"before the goal" resolves the recorded goal and excludes it and everything later', async () => {
  const result = await ask('Northbridge had more shots on target than Eastport before the goal')
  const claim = first(result)
  assert.equal(claim.claim.timePeriod.kind, 'before-event')
  assert.equal(claim.claim.meaning.comparison.metric, 'shots-on-target')
  assert.match(claim.periodLabel, /strictly before 45\+3/)
  const anchor = claim.evidence.find(({ role }) => role === 'anchor')
  assert.ok(anchor)
  const ids = claim.evidence.filter(({ role }) => role !== 'anchor').map(({ reference }) => reference.id)
  assert.ok(!ids.includes(anchor.reference.id))
  const whole = await ask('Northbridge had more shots on target than Eastport')
  assert.notDeepEqual(claim.statistics, first(whole).statistics)
  assert.match(result.fanReply, /strictly before Northbridge's goal at 45\+3/)
})

test('"before the goal" is a clarification when several goals make it ambiguous, and never uses a future goal', async () => {
  const ambiguous = await ask('Eastport had more shots than Northbridge before the goal', { period: 2, minute: 84 })
  assert.equal(first(ambiguous).assessment, 'clarification needed')
  assert.match(first(ambiguous).limitation, /Which goal/)
  assert.equal(first(ambiguous).evidence.length, 0)
  const none = await ask('Eastport had more shots than Northbridge before the goal', { period: 1, minute: 20 })
  assert.equal(first(none).assessment, 'clarification needed')
  assert.match(first(none).limitation, /No goal is recorded/)
  const opener = await ask('Eastport had more shots than Northbridge before the opener', { period: 2, minute: 84 })
  assert.equal(first(opener).claim.timePeriod.kind, 'before-event')
  const equaliser = await ask('Eastport had more shots than Northbridge before the equaliser', { period: 2, minute: 84 })
  assert.match(first(equaliser).periodLabel, /strictly before 58′/)
})

test('universal claims use the team’s recorded shots as the denominator and handle zero attempts', async () => {
  const every = first(await ask('Every Eastport shot was on target'))
  assert.equal(every.assessment, 'contradicted')
  assert.equal(every.calculations[0].denominator, 4)
  assert.equal(every.calculations[0].numerator, 2)
  assert.equal(every.calculations[0].denominatorRecordIds.length, 4)
  assert.ok(every.evidence.every(({ reference }) => reference.team === 'Eastport'))
  assert.ok(every.evidence.some(({ role }) => role === 'supporting'))
  assert.ok(every.evidence.some(({ role }) => role === 'challenging'))

  assert.equal(first(await ask('Not every Eastport shot was on target')).assessment, 'supported')
  assert.equal(first(await ask('None of Eastport’s shots were on target')).assessment, 'contradicted')

  const noAttempts = first(await ask('Every Eastport shot was on target', { period: 1, minute: 1 }))
  assert.equal(noAttempts.assessment, 'insufficient evidence for a firm conclusion')
  assert.equal(noAttempts.calculations[0].denominator, 0)
  assert.match(noAttempts.limitation, /no recorded shots/)
})

test('universal verdicts always agree with the traced numerator and denominator', async () => {
  const clocks = [
    { period: 1, minute: 10 },
    { period: 1, minute: 30 },
    { period: 1, minute: 45, stoppageMinutes: 3 },
    { period: 2, minute: 58 },
    { period: 2, minute: 90 },
  ]
  for (const clock of clocks) {
    for (const team of ['Northbridge', 'Eastport']) {
      const claim = first(await ask(`Every ${team} shot was on target`, clock))
      const { numerator, denominator } = claim.calculations[0]
      const expected = denominator === 0
        ? 'insufficient evidence for a firm conclusion'
        : numerator === denominator ? 'supported' : 'contradicted'
      assert.equal(claim.assessment, expected, `${team} ${JSON.stringify(clock)}`)
      const none = first(await ask(`None of ${team}’s shots were on target`, clock))
      const noneExpected = denominator === 0
        ? 'insufficient evidence for a firm conclusion'
        : numerator === 0 ? 'supported' : 'contradicted'
      assert.equal(none.assessment, noneExpected, `none ${team} ${JSON.stringify(clock)}`)
    }
  }
})

test('"no shots on target" keeps both the zero assertion and the shots-on-target metric', async () => {
  const claim = first(await ask('Northbridge had no shots on target'))
  assert.equal(claim.claim.requiredEvidence.join(), 'shots-on-target')
  assert.equal(claim.assessment, 'contradicted')
  assert.equal(claim.calculations[0].metric, 'shots-on-target')
  assert.equal(claim.calculations[0].numerator, 2)
  assert.ok(claim.statistics.every(({ metric, team }) => metric === 'shots-on-target' && team === 'Northbridge'))
  assert.match(claim.evidence.find(({ role }) => role === 'challenging').reference.description, /shot/i)
  for (const text of ['Northbridge did not have a shot on target', 'Northbridge had zero shots on target', 'Northbridge hadn’t had any shots on target']) {
    const variant = first(await ask(text))
    assert.equal(variant.calculations[0].metric, 'shots-on-target', text)
    assert.equal(variant.assessment, 'contradicted', text)
  }
  // The same wording about shots, not shots on target, is a different metric.
  const shots = first(await ask('Northbridge had no shots'))
  assert.equal(shots.calculations[0].metric, 'shots')
  const early = first(await ask('Eastport had no shots on target', { period: 1, minute: 1 }))
  assert.equal(early.assessment, 'supported')
  assert.equal(early.calculations[0].numerator, 0)
})

test('"both teams had the same number of shots" preserves the equality and the named metric', async () => {
  const result = await ask('Both teams had the same number of shots')
  const claim = first(result)
  assert.equal(claim.claim.meaning.comparison.operator, 'equal')
  assert.equal(claim.claim.meaning.comparison.metric, 'shots')
  assert.equal(claim.assessment, 'supported')
  assert.match(result.fanReply, /level on 4 shots each/)
  const negated = first(await ask('Both teams did not have the same number of shots'))
  assert.equal(negated.claim.meaning.comparison.operator, 'not-equal')
  assert.equal(negated.assessment, 'contradicted')
  const onTarget = first(await ask('Both sides had the same number of shots on target', { period: 2, minute: 58 }))
  assert.equal(onTarget.claim.meaning.comparison.metric, 'shots-on-target')
  assert.equal(onTarget.assessment, 'contradicted')
})

test('shot location is reported as unrecorded without substituting shot counts', async () => {
  for (const text of [
    'Eastport had a shot from outside the box',
    'Northbridge scored from long range',
    'Saka had an effort from inside the area',
  ]) {
    const claim = first(await ask(text))
    assert.equal(claim.claim.intent, 'unavailable-metric', text)
    assert.equal(claim.assessment, 'unavailable data', text)
    assert.deepEqual(claim.claim.requiredEvidence, ['shot-location'], text)
    assert.equal(claim.statistics.length, 0, text)
    assert.equal(claim.evidence.length, 0, text)
    assert.match(claim.limitation, /pitch coordinates or zone/, text)
  }
})

test('one judgement about two named players is assessed separately for each', async () => {
  const result = await ask('Saka and Rice have been poor')
  assert.equal(result.claims.length, 2)
  assert.deepEqual(result.claims.map(({ claim }) => claim.playerSubject.name), ['Bukayo Saka', 'Declan Rice'])
  for (const claim of result.claims) {
    assert.equal(claim.claim.intent, 'subjective-judgement')
    assert.equal(claim.assessment, 'insufficient evidence for a firm conclusion')
    assert.ok(claim.playerStatistics.every(({ playerId }) => playerId === claim.claim.playerSubject.id))
    assert.match(claim.limitation, /no overall player rating/)
  }
  assert.notDeepEqual(result.claims[0].playerStatistics, result.claims[1].playerStatistics)
  assert.match(result.fanReply, /Bukayo Saka/)
  assert.match(result.fanReply, /Declan Rice/)
  const praise = await ask('Saka and Rice have been brilliant')
  assert.equal(praise.claims.length, 2)
  const negated = await ask('Saka and Rice have not been poor')
  assert.equal(negated.claims.length, 2)
  // A comparison between the same two players keeps its own, single-claim handling.
  const compare = await ask('Saka had more shots than Rice')
  assert.equal(compare.claims.length, 1)
})

test('new semantics preserve the request shape and selected dataset', async () => {
  const baseline = await ask('Both teams had the same number of shots')
  assert.equal(baseline.evidenceFoundation.dataset.id, 'northbridge-eastport-analysis-demo')
  const explicit = await ask(
    'Both teams had the same number of shots',
    { period: 2, minute: 90, stoppageMinutes: 4 },
    'match-so-far',
    'northbridge-eastport-return-demo',
  )
  assert.equal(explicit.evidenceFoundation.dataset.id, 'northbridge-eastport-return-demo')
  assert.equal(first(explicit).assessment, 'contradicted')
  const returnEvery = first(await ask('Every Northbridge shot was on target', { period: 2, minute: 90, stoppageMinutes: 4 }, 'match-so-far', 'northbridge-eastport-return-demo'))
  assert.ok(returnEvery.calculations[0].denominatorRecordIds.every((id) => id.startsWith('return-event-')))
})
