import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { FoundryInterpretationProvider } from '../dist/api/src/providers/foundry.js'

const BASELINE = 'northbridge-eastport-analysis-demo'
const RETURN = 'northbridge-eastport-return-demo'

const captured = JSON.parse(
  await readFile(new URL('./fixtures/foundry-cf10c74-interpretations.json', import.meta.url), 'utf8'),
)

function stub(content, seen = []) {
  return new FoundryInterpretationProvider(
    { baseUrl: 'https://example.invalid/openai/v1', apiKey: 'mock-key', deployment: 'mock' },
    async (_url, init) => {
      seen.push(JSON.parse(init.body))
      return new Response(
        JSON.stringify({
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    },
  )
}

// CAPTURED REPLAY: genuine cf10c74 Foundry outputs, replayed offline after the dataset refactor.
// This is not new Foundry verification.
test('captured baseline shots pair still compares correctly with and without datasetId', async () => {
  for (const datasetId of [undefined, BASELINE]) {
    const withId = (minute) => ({
      opinion: 'Eastport had more shots on target.',
      selectedClock: { period: 2, minute },
      period: 'match-so-far',
      ...(datasetId ? { datasetId } : {}),
    })
    const at57 = await analyzeOpinion(withId(57), stub(captured[0]))
    const at58 = await analyzeOpinion(withId(58), stub(captured[1]))
    assert.equal(at57.provider, 'foundry')
    assert.equal(at57.evidenceFoundation.dataset.id, BASELINE)
    assert.equal(at57.claims[0].assessment, 'contradicted')
    assert.equal(at58.claims[0].assessment, 'supported')
    assert.deepEqual(at57.score, { Northbridge: 1, Eastport: 0 })
    assert.deepEqual(at58.score, { Northbridge: 1, Eastport: 1 })
  }
})

// CONSTRUCTED STUB: an interpretation written by hand for the second fixture, delivered through the
// real Foundry adapter and validator with a stubbed transport. It proves what the selected fixture
// supplies; it does not show that a model can produce this interpretation.
const constructed = {
  claims: [
    {
      id: 'claim-1',
      subject: 'Northbridge',
      playerSubject: null,
      playerMetric: null,
      text: 'Northbridge had more shots than Eastport.',
      intent: 'factual-claim',
      meaning: {
        category: 'factual-comparison',
        description: 'Northbridge recorded more shots than Eastport.',
        comparison: { opponent: 'Eastport', opponentPlayer: null, metric: 'shots', operator: 'greater-than' },
      },
      requiredEvidence: ['shots'],
      timePeriod: { kind: 'selected' },
      historicalEventAnchor: null,
      clarificationNeeds: [],
    },
  ],
}

test('constructed stub: the second fixture supplies interpretation context, evidence, calculations and metadata', async () => {
  const seen = []
  const result = await analyzeOpinion(
    {
      opinion: 'Northbridge had more shots than Eastport.',
      selectedClock: { period: 2, minute: 90, stoppageMinutes: 4 },
      period: 'match-so-far',
      datasetId: RETURN,
    },
    stub(constructed, seen),
  )
  assert.equal(seen.length, 1)
  const userMessage = JSON.parse(seen[0].messages.at(-1).content)
  assert.ok(userMessage.availableEvents.length > 0)
  assert.ok(userMessage.availableEvents.every(({ id }) => id.startsWith('return-event-')))
  assert.ok(userMessage.availablePlayers.length >= 22)
  assert.equal(result.provider, 'foundry')
  assert.equal(result.evidenceFoundation.dataset.id, RETURN)
  assert.equal(result.claims[0].assessment, 'supported')
  const shots = result.claims[0].statistics
  assert.deepEqual(shots.map(({ team, value }) => [team, value]), [['Northbridge', 11], ['Eastport', 4]])
  assert.ok(result.claims[0].evidence.every(({ reference }) => reference.id.startsWith('return-event-')))
  assert.deepEqual(result.score, { Northbridge: 2, Eastport: 1 })
})

test('constructed stub: a baseline-only event reference is rejected for the second fixture', async () => {
  const baselineAnchor = structuredClone(constructed)
  baselineAnchor.claims[0].timePeriod = { kind: 'before-event', eventId: 'event-07' }
  baselineAnchor.claims[0].historicalEventAnchor = { eventId: 'event-07', relationship: 'Goal' }
  await assert.rejects(
    analyzeOpinion(
      {
        opinion: 'Northbridge had more shots than Eastport.',
        selectedClock: { period: 2, minute: 90, stoppageMinutes: 4 },
        period: 'match-so-far',
        datasetId: RETURN,
      },
      stub(baselineAnchor),
    ),
    /unavailable event|anchor/i,
  )
})
