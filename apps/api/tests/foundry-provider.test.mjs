import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { FoundryInterpretationProvider } from '../dist/api/src/providers/foundry.js'

const request = (opinion, minute = 58) => ({
  opinion,
  selectedClock: { period: 2, minute },
  period: 'match-so-far',
})

function mockedFoundry(responseContent, onRequest = () => {}) {
  return new FoundryInterpretationProvider(
    {
      baseUrl: 'https://example.invalid/openai/v1',
      apiKey: 'mock-key',
      deployment: 'mock-deployment',
    },
    async (input, init) => {
      onRequest(String(input), init)
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(responseContent) } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    },
  )
}

test('serializes strict schema and selected scorer context through the actual provider', async () => {
  let serializedBody
  const provider = mockedFoundry({ claims: [] }, (_url, init) => {
    serializedBody = JSON.parse(init.body)
  })

  await analyzeOpinion(request('Explain the event at 58 minutes.'), provider)

  const claimsSchema = serializedBody.response_format.json_schema.schema
    .properties.claims
  const claimSchema = claimsSchema.items
  const claimProperties = claimSchema.properties
  const playerSubjectSchema = claimProperties.playerSubject.anyOf[0]

  assert.ok(claimProperties.playerMetric)
  assert.ok(claimSchema.required.includes('playerMetric'))
  assert.equal(playerSubjectSchema.properties.playerMetric, undefined)
  assert.equal(claimsSchema.maxItems, undefined)
  assert.equal(claimProperties.playerMetric.anyOf[1].type, 'null')

  const systemInstructions = serializedBody.messages[0].content
  assert.match(systemInstructions, /For a team comparison, put the first team in subject/)
  assert.match(systemInstructions, /comparison-request/)
  assert.match(systemInstructions, /clarificationNeeds must contain no more than eight/)
  assert.match(systemInstructions, /Never put record IDs in claim\.text/)
  assert.match(systemInstructions, /express yes\/no questions as declarative propositions/)
  assert.match(systemInstructions, /Unavailability is not ambiguity/)
  assert.match(systemInstructions, /exclusive cutoff/)

  const userContext = JSON.parse(serializedBody.messages[1].content)
  assert.deepEqual(userContext.availableTeams, ['Northbridge', 'Eastport'])
  const eventById = new Map(userContext.availableEvents.map((event) => [event.id, event]))
  assert.equal(eventById.get('event-07').playerId, 'north-player-09')
  assert.equal(eventById.get('event-10').playerId, 'east-player-10')
  assert.equal(eventById.has('event-11'), false)
  assert.equal(
    userContext.availablePlayers.find(({ id }) => id === 'north-player-09').id,
    'north-player-09',
  )
})

test('server rejects a wrong-scorer provider anchor even with neutral claim wording', async () => {
  const valid = await analyzeOpinion(
    request('Saka scored against the run of play.', 90),
  )
  const claim = structuredClone(valid.claims[0].claim)
  const rice = valid.evidenceFoundation.players.find(
    ({ id }) => id === 'north-player-06',
  )
  claim.playerSubject = { id: rice.id, name: rice.name, team: rice.team }
  claim.text = 'Assess this historical circumstance.'
  claim.meaning.description = 'Assess a player event before the goal.'
  const provider = mockedFoundry({ claims: [claim] })

  await assert.rejects(
    analyzeOpinion(request(claim.text, 90), provider),
    /historical anchor must be a goal scored by the named player/i,
  )
})

test('server retains the eight-claim limit without a schema maxItems constraint', async () => {
  const provider = mockedFoundry({
    claims: Array.from({ length: 9 }, (_, index) => ({ id: `claim-${index + 1}` })),
  })

  await assert.rejects(
    analyzeOpinion(request('Split this opinion into claims.'), provider),
    /at most eight claims/i,
  )
})
