import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { SYNTHETIC_MATCH_EVIDENCE } from '../dist/shared/src/evidence.js'

const request = (opinion) => ({
  opinion,
  selectedClock: { period: 2, minute: 90, stoppageMinutes: 4 },
  period: 'match-so-far',
})

test('preserves negation in player verdicts and displayed meanings, including contractions', async () => {
  for (const text of [
    'Saka did not have a higher pass completion rate than Amad.',
    "Saka didn't have a higher pass completion rate than Amad.",
    'Saka didn’t have a higher pass completion rate than Amad.',
  ]) {
    const result = await analyzeOpinion(request(text))
    const claim = result.claims[0]
    assert.equal(claim.assessment, 'supported')
    assert.equal(claim.claim.meaning.comparison.operator, 'less-or-equal')
    assert.match(claim.claim.meaning.description, /is less than or equal to/)
    assert.doesNotMatch(claim.claim.meaning.description, /is greater than|a higher/)
  }

  const equalCounts = await analyzeOpinion(
    request('Saka did not have fewer pass completions than Amad.'),
  )
  assert.equal(equalCounts.claims[0].assessment, 'supported')
  assert.equal(
    equalCounts.claims[0].claim.meaning.comparison.operator,
    'greater-or-equal',
  )
  assert.match(
    equalCounts.claims[0].claim.meaning.description,
    /is greater than or equal to/,
  )
})

test('never substitutes a teammate scorer for a player historical-circumstance claim', async () => {
  for (const text of [
    'Amad found the net against the run of play.',
    'Rice found the net against the run of play.',
  ]) {
    const result = await analyzeOpinion(request(text))
    const claim = result.claims[0]
    assert.equal(claim.assessment, 'clarification needed')
    assert.equal(claim.claim.historicalEventAnchor, null)
    assert.deepEqual(claim.playerStatistics, [])
    assert.deepEqual(claim.playerCalculations, [])
    assert.deepEqual(claim.evidence, [])
    assert.match(result.summary, /No goal by .* is recorded/)
  }

  const validScorer = await analyzeOpinion(
    request('Saka found the net against the run of play.'),
  )
  assert.equal(validScorer.claims[0].claim.historicalEventAnchor.eventId, 'event-07')
  assert.equal(validScorer.claims[0].claim.clarificationNeeds.length, 0)
})

test('enforces scorer identity at the provider boundary independently of text wording', async () => {
  const teamGoal = await analyzeOpinion(
    request('Eastport scored against the run of play.'),
  )
  const amad = SYNTHETIC_MATCH_EVIDENCE.players.find(
    (player) => player.name === 'Amad',
  )
  for (const text of [
    'Amad found the net against the run of play.',
    'Assess this historical scoring circumstance.',
  ]) {
    const wrong = {
      ...teamGoal.claims[0].claim,
      playerSubject: { id: amad.id, name: amad.name, team: amad.team },
      text,
      meaning: {
        category: 'historical-circumstance',
        description: 'Assess the goal scored by Amad.',
        comparison: null,
      },
    }
    const provider = {
      name: 'foundry',
      async interpret() {
        return { claims: [wrong] }
      },
    }
    await assert.rejects(
      analyzeOpinion(request(text), provider),
      /historical anchor must be a goal scored by the named player/i,
    )
  }
})

test('keeps non-scorer player questions before a team goal valid', async () => {
  const result = await analyzeOpinion(
    request('How did Ben White perform before Northbridge scored?'),
  )
  const claim = result.claims[0]
  assert.equal(claim.claim.clarificationNeeds.length, 0)
  assert.equal(claim.claim.historicalEventAnchor.eventId, 'event-07')
  assert.match(result.summary, /Ben White had not yet come on/)
  assert.equal(
    claim.playerStatistics.find(({ metric }) => metric === 'minutes-played').value,
    0,
  )
})
