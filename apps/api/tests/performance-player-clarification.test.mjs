import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { verifyPlayerResolution } from '../dist/api/src/playerResolution.js'

const DATASET = 'northbridge-eastport-analysis-demo'
const foundryBruno = JSON.parse(
  await readFile(
    new URL('./fixtures/foundry-2026-10-27-call4-interpretation.json', import.meta.url),
    'utf8',
  ),
).claims[0]

const clocks = [
  { label: '1′', selectedClock: { period: 1, minute: 1 }, minute: 1 },
  { label: '58′', selectedClock: { period: 2, minute: 58 }, minute: 58 },
  { label: '90+4′', selectedClock: { period: 2, minute: 90, stoppageMinutes: 4 }, minute: 90 },
]

const performanceQuestions = [
  ['How did Bruno play?', 'Bruno'],
  ['How did Bruno perform?', 'Bruno'],
  ['How good was Bruno today?', 'Bruno'],
  ['How did Martin play today?', 'Martin'],
  ['How good was Martin today?', 'Martin'],
]

const request = (opinion, selectedClock, inputLanguage = 'en') => ({
  opinion,
  selectedClock,
  period: 'match-so-far',
  datasetId: DATASET,
  inputLanguage,
})

function countingProvider(claim) {
  let calls = 0
  return {
    provider: {
      name: 'foundry',
      async interpret() {
        calls += 1
        return { claims: [claim] }
      },
    },
    calls: () => calls,
  }
}

const neverCalled = {
  name: 'local',
  async interpret() {
    throw new Error('Selecting a player must not invoke an interpreter.')
  },
}

function assertUnresolved(response, firstName) {
  assert.equal(response.claims.length, 1)
  const [result] = response.claims
  assert.equal(result.assessment, 'clarification needed')
  assert.equal(result.claim.playerSubject, null)
  assert.equal(result.claim.subject, null)
  assert.deepEqual(result.playerStatistics, [])
  assert.deepEqual(result.statistics, [])
  assert.deepEqual(result.evidence, [])
  assert.ok(result.playerResolution, 'structured player choices are required')
  const { candidates, continuation } = result.playerResolution
  assert.equal(candidates.length, 2)
  assert.equal(new Set(candidates.map(({ id }) => id)).size, 2)
  const plain = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  assert.ok(candidates.every(({ name }) => plain(name).split(' ').includes(firstName)))
  assert.equal(response.playerResolutionContinuation, continuation)
  return { result, candidates, continuation }
}

function assertResolved(resolved, original, chosen, selectedTime) {
  const [result] = resolved.claims
  assert.equal(resolved.selectedTime, selectedTime)
  assert.equal(resolved.evidenceFoundation.dataset.id, DATASET)
  assert.equal(resolved.evidenceFoundation.dataset.version, '3.0.0')
  assert.equal(result.claim.text, original.replace(/\?$/u, ''))
  assert.equal(result.claim.playerSubject.id, chosen.id)
  assert.equal(result.claim.subject, chosen.team)
  assert.equal(result.playerResolution, undefined)
  assert.equal(result.assessment, 'insufficient evidence for a firm conclusion')
  assert.ok(result.playerStatistics.every(({ playerId }) => playerId === chosen.id))
  assert.match(result.limitation, /no overall player rating or ranking/i)
  assert.deepEqual(resolved.selectedPlayers.map(({ id }) => id), [chosen.id])
  assert.ok(
    resolved.evidenceFoundation.passRecords.every(
      ({ time }) => Number.parseInt(time, 10) <= Number.parseInt(selectedTime, 10),
    ),
  )
}

test('local rules connect open-ended performance questions to the signed player choice', async () => {
  for (const { label, selectedClock } of clocks) {
    for (const [opinion, firstName] of performanceQuestions) {
      const initial = await analyzeOpinion(request(opinion, selectedClock))
      assert.equal(initial.provider, 'local')
      assert.equal(initial.claims[0].claim.intent, 'subjective-judgement', opinion)
      const { result, candidates, continuation } = assertUnresolved(initial, firstName)
      const grant = verifyPlayerResolution(continuation)
      assert.equal(grant.request.opinion, opinion)
      assert.deepEqual(grant.request.selectedClock, selectedClock)
      assert.equal(grant.request.period, 'match-so-far')
      assert.equal(grant.request.datasetId, DATASET)

      for (const chosen of candidates) {
        const resolved = await analyzeOpinion(
          {
            action: 'resolve-player',
            continuation,
            claimId: result.claim.id,
            playerId: chosen.id,
          },
          neverCalled,
        )
        assertResolved(resolved, opinion, chosen, label)
      }
    }
  }
})

test('structural performance claims resolve even when the claim text matches no local topic phrase', async () => {
  for (const { label, selectedClock } of clocks) {
    for (const firstName of ['Bruno', 'Martin']) {
      const opinion = `Assess ${firstName}'s contribution`
      const claim = {
        ...foundryBruno,
        text: opinion,
        playerMetric: null,
        intent: 'subjective-judgement',
        meaning: { category: 'performance-judgement', description: opinion, comparison: null },
        requiredEvidence: ['possession', 'passing', 'shots', 'goals'],
        clarificationNeeds: [
          `Which ${firstName} do you mean?`,
        ],
      }
      const stub = countingProvider(claim)
      const initial = await analyzeOpinion(request(opinion, selectedClock), stub.provider)
      assert.equal(initial.provider, 'foundry')
      const { result, candidates, continuation } = assertUnresolved(initial, firstName)

      for (const chosen of candidates) {
        const resolved = await analyzeOpinion(
          {
            action: 'resolve-player',
            continuation,
            claimId: result.claim.id,
            playerId: chosen.id,
          },
          stub.provider,
        )
        assertResolved(resolved, opinion, chosen, label)
        assert.equal(resolved.provider, 'foundry')
      }
      assert.equal(stub.calls(), 1, 'both selections must reuse the one interpretation')
    }
  }
})

test('at 1 minute a selected player reports sparse evidence honestly and invents no rating', async () => {
  const initial = await analyzeOpinion(request('How did Bruno play?', clocks[0].selectedClock))
  const { result, candidates, continuation } = assertUnresolved(initial, 'Bruno')
  for (const chosen of candidates) {
    const resolved = await analyzeOpinion(
      { action: 'resolve-player', continuation, claimId: result.claim.id, playerId: chosen.id },
      neverCalled,
    )
    const answer = resolved.claims[0]
    assert.notEqual(answer.assessment, 'supported')
    assert.notEqual(answer.assessment, 'contradicted')
    assert.doesNotMatch(`${answer.reply} ${answer.limitation}`, /\b\d+(?:\.\d+)?\s*\/\s*10\b/)
    assert.ok(answer.reply.includes(chosen.name))
  }
})

test('tampered continuations and candidates outside the saved clarification stay rejected', async () => {
  const initial = await analyzeOpinion(request('How did Bruno play?', clocks[1].selectedClock))
  const { result, continuation } = assertUnresolved(initial, 'Bruno')
  await assert.rejects(
    analyzeOpinion(
      {
        action: 'resolve-player',
        continuation,
        claimId: result.claim.id,
        playerId: 'north-player-01',
      },
      neverCalled,
    ),
  )
})
