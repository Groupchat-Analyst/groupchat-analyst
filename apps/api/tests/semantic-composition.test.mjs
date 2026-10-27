import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

const ask = (opinion, selectedClock = { period: 2, minute: 57 }, period = 'match-so-far') =>
  analyzeOpinion({ opinion, selectedClock, period })
const first = (result) => result.claims[0]

test('player zero-goal assertions preserve identity, polarity and a narrow goal metric', async () => {
  for (const opinion of ['Saka has not scored', 'Saka hasn’t scored', 'Saka hasn’t scored a goal', 'Saka has never scored', 'Bukayo Saka had no goals']) {
    const result = await ask(opinion)
    const claim = first(result)
    assert.equal(claim.claim.intent, 'factual-claim', opinion)
    assert.equal(claim.claim.playerSubject.name, 'Bukayo Saka', opinion)
    assert.equal(claim.assessment, 'contradicted', opinion)
    assert.deepEqual(claim.statistics, [], opinion)
    assert.deepEqual(claim.playerStatistics.map(({ metric, value }) => [metric, value]), [['goals', 1]], opinion)
    assert.deepEqual(claim.playerCalculations[0].numeratorRecordIds, ['event-07'], opinion)
    assert.match(result.fanReply, /Bukayo Saka has 1 recorded goal\./, opinion)
  }
  const rice = first(await ask('Rice has not scored'))
  assert.equal(rice.assessment, 'supported')
  assert.equal(rice.playerStatistics[0].value, 0)
  assert.ok(!rice.evidence.some(({ reference }) => reference.id === 'event-07'))
})

test('positive goal statements are the complement of zero claims in the selected window', async () => {
  assert.equal(first(await ask('Saka has scored')).assessment, 'supported')
  assert.equal(first(await ask('Saka scored', { period: 1, minute: 30 })).assessment, 'contradicted')
  assert.equal(first(await ask('Rice has scored')).assessment, 'contradicted')
  assert.equal(first(await ask('Eastport never scored')).assessment, 'supported')
  assert.equal(first(await ask('Eastport never scored', { period: 2, minute: 58 })).assessment, 'contradicted')
  const recent = first(await ask('Saka has scored', { period: 2, minute: 57 }, 'last-10-minutes'))
  assert.equal(recent.assessment, 'contradicted')
  assert.equal(recent.playerStatistics[0].value, 0)
})

test('player first-half scoring statements survive validation and do not inherit teammate goals', async () => {
  const yes = await ask('Saka scored in the first half')
  assert.equal(first(yes).assessment, 'supported')
  assert.equal(first(yes).periodLabel, 'Recorded first-half goal events')
  assert.match(yes.fanReply, /Bukayo Saka scored before half-time, at 45\+3/)
  for (const opinion of ['Saka did not score in the first half', 'Saka hasn’t scored before half-time']) {
    const result = await ask(opinion)
    assert.equal(first(result).assessment, 'contradicted', opinion)
    assert.match(result.fanReply, /Bukayo Saka did score before half-time/, opinion)
    assert.deepEqual(first(result).evidence.map(({ reference }) => reference.id), ['event-07'], opinion)
  }
  const rice = first(await ask('Rice did not score in the first half'))
  assert.equal(rice.assessment, 'supported')
  assert.equal(rice.evidence.length, 0)
  const recent = first(await ask('Saka scored in the first half', { period: 2, minute: 57 }, 'last-10-minutes'))
  assert.equal(recent.assessment, 'supported')
})

test('a missing player goal before half-time remains unsettled while the first half is in progress', async () => {
  for (const opinion of ['Saka scored in the first half', 'Saka did not score in the first half']) {
    const result = first(await ask(opinion, { period: 1, minute: 20 }))
    assert.equal(result.assessment, 'insufficient evidence for a firm conclusion', opinion)
    assert.equal(result.evidence.length, 0, opinion)
  }
  assert.equal(first(await ask('Bruno has not scored')).assessment, 'clarification needed')
})

test('zero shots on target before a goal keep the exact metric and exclusive anchor', async () => {
  const result = await ask('Northbridge had no shots on target before the goal')
  const claim = first(result)
  assert.equal(claim.claim.intent, 'factual-claim')
  assert.equal(claim.assessment, 'contradicted')
  assert.equal(claim.calculations[0].metric, 'shots-on-target')
  assert.equal(claim.calculations[0].numerator, 1)
  assert.equal(claim.calculations[0].denominator, 2)
  assert.ok(!claim.calculations[0].denominatorRecordIds.includes('event-07'))
  assert.deepEqual(claim.evidence.filter(({ role }) => role === 'anchor').map(({ reference }) => reference.id), ['event-07'])
  assert.match(result.fanReply, /1 recorded shot on target/)
  assert.match(result.fanReply, /strictly before Northbridge's goal at 45\+3/)
  assert.doesNotMatch(result.fanReply, /event-07|attacking threat|recorded 2 shots/)
})

test('universal claims retain their historical denominator rather than becoming a broad judgement', async () => {
  const claim = first(await ask('Every Eastport shot was on target before the goal'))
  assert.equal(claim.claim.intent, 'factual-claim')
  assert.equal(claim.assessment, 'contradicted')
  assert.equal(claim.calculations[0].numerator, 1)
  assert.equal(claim.calculations[0].denominator, 3)
  assert.ok(!claim.calculations[0].denominatorRecordIds.includes('event-08'))
  const negated = first(await ask('Not every Eastport shot was on target before the goal'))
  assert.equal(negated.assessment, 'supported')
})

test('negating every shot is distinct from asserting that every shot missed the target', async () => {
  assert.equal(first(await ask('Not every Eastport shot was on target')).assessment, 'supported')
  const eachMissed = first(await ask('Every Eastport shot was not on target'))
  assert.equal(eachMissed.assessment, 'contradicted')
  assert.equal(eachMissed.calculations[0].numerator, 2)
  assert.equal(eachMissed.calculations[0].denominator, 4)
})

test('historical count assertions clarify absent or ambiguous anchors without returning counts', async () => {
  for (const clock of [{ period: 1, minute: 20 }, { period: 2, minute: 84 }]) {
    const claim = first(await ask('Northbridge had no shots on target before the goal', clock))
    assert.equal(claim.assessment, 'clarification needed')
    assert.equal(claim.statistics.length, 0)
    assert.equal(claim.calculations.length, 0)
    assert.equal(claim.evidence.length, 0)
  }
})

test('one ambiguous first name is not expanded into opinions about two players', async () => {
  const result = await ask('Bruno has been poor')
  assert.equal(result.claims.length, 1)
  assert.equal(first(result).assessment, 'clarification needed')
  assert.equal(first(result).playerStatistics.length, 0)
  assert.equal(first(result).evidence.length, 0)
  assert.match(result.fanReply, /Bruno Fernandes/)
  assert.match(result.fanReply, /Bruno Guimarães/)
  const named = await ask('Bruno Fernandes and Bruno Guimaraes have been poor')
  assert.deepEqual(named.claims.map(({ claim }) => claim.playerSubject.name), ['Bruno Fernandes', 'Bruno Guimarães'])
  const uniqueFirstNames = await ask('Bukayo and Declan have been poor')
  assert.deepEqual(uniqueFirstNames.claims.map(({ claim }) => claim.playerSubject.name), ['Bukayo Saka', 'Declan Rice'])
})
