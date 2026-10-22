import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { LocalInterpretationProvider } from '../dist/api/src/providers/local.js'

const provider = new LocalInterpretationProvider()
const selectedClock = { period: 2, minute: 90, stoppageMinutes: 4 }

async function analyze(opinion) {
  return analyzeOpinion(
    { opinion, selectedClock, period: 'match-so-far' },
    provider,
  )
}

test('TEAM_DEMO statistics walkthrough is supported by the local interpreter', async () => {
  const result = await analyze('How many shots did Eastport have?')
  const claim = result.claims[0]

  assert.equal(result.provider, 'local')
  assert.equal(claim.claim.intent, 'statistical-request')
  assert.equal(
    claim.statistics.find(
      ({ team, metric }) => team === 'Eastport' && metric === 'shots',
    )?.value,
    8,
  )
  assert.match(result.summary, /Eastport recorded 8 shots/)
})

test('TEAM_DEMO historical walkthrough supports the recorded first-half goal', async () => {
  const result = await analyze('Northbridge scored before half-time.')
  const claim = result.claims[0]

  assert.equal(result.provider, 'local')
  assert.equal(claim.assessment, 'supported')
  assert.ok(
    claim.evidence.some(
      ({ reference }) =>
        reference.id === 'event-07' && reference.time === '45+3′',
    ),
  )
  assert.match(result.summary, /Northbridge scored before half-time at 45\+3′/)
})

test('TEAM_DEMO ambiguous-player walkthrough asks which Bruno without evidence', async () => {
  const result = await analyze('How many passes did Bruno complete?')
  const claim = result.claims[0]

  assert.equal(result.provider, 'local')
  assert.equal(claim.assessment, 'clarification needed')
  assert.match(
    claim.claim.clarificationNeeds.join(' '),
    /Bruno Guimarães \(Northbridge\).*Bruno Fernandes \(Eastport\)/,
  )
  assert.equal(claim.evidence.length, 0)
})

test('TEAM_DEMO unavailable-measurement walkthrough returns no substituted statistics', async () => {
  const result = await analyze('How far did Bruno Fernandes run?')
  const claim = result.claims[0]

  assert.equal(result.provider, 'local')
  assert.equal(claim.assessment, 'unavailable data')
  assert.match(claim.limitation, /Running distance.*not recorded/i)
  assert.equal(claim.statistics.length, 0)
  assert.equal(claim.playerStatistics.length, 0)
  assert.equal(claim.evidence.length, 0)
})
