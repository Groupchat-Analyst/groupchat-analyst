import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { FoundryInterpretationProvider } from '../dist/api/src/providers/foundry.js'
import { createAnalyzeHandler } from '../dist/api/src/functions/analyze.js'

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
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(responseContent) } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    },
  )
}

function providerWithFetch(request) {
  return new FoundryInterpretationProvider(
    {
      baseUrl: 'https://example.invalid/openai/v1',
      apiKey: 'mock-key',
      deployment: 'mock-deployment',
    },
    request,
  )
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

test('serializes strict schema and selected scorer context through the actual provider', async () => {
  let serializedBody
  const valid = await analyzeOpinion(request('How many shots did Eastport have?'))
  const provider = mockedFoundry({ claims: [valid.claims[0].claim] }, (_url, init) => {
    serializedBody = JSON.parse(init.body)
  })

  await analyzeOpinion(request('How many shots did Eastport have?'), provider)

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
  assert.match(systemInstructions, /tag question that asks whether a comparison is true/)
  assert.match(systemInstructions, /negative tag does not negate the preceding proposition/)
  assert.match(systemInstructions, /clarificationNeeds must contain no more than eight/)
  assert.match(systemInstructions, /Never put record IDs in claim\.text/)
  assert.match(systemInstructions, /express yes\/no questions as declarative propositions/)
  assert.match(systemInstructions, /Unavailability is not ambiguity/)
  assert.match(systemInstructions, /Broad team judgements such as/)
  assert.match(systemInstructions, /which side covered the greater distance/)
  assert.match(systemInstructions, /For an unavailable comparison phrased as a question/)
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

test('classifies transport, throttling, refusal, incomplete, schema, and semantic failures', async () => {
  const cases = [
    {
      category: 'transport',
      request: async () => { throw new TypeError('network unavailable') },
      message: /could not be reached/,
    },
    {
      category: 'throttling',
      request: async () => response({}, 429),
      message: /throttling/,
    },
    {
      category: 'refusal',
      request: async () =>
        response({
          choices: [{ message: { refusal: 'blocked', content: null } }],
        }),
      message: /refused/,
    },
    {
      category: 'incomplete-output',
      request: async () => response({ choices: [] }),
      message: /no interpretation choices/,
    },
    {
      category: 'schema',
      request: async () =>
        response({
          choices: [{ finish_reason: 'stop', message: { content: '{"claims":' } }],
        }),
      message: /not valid structured JSON/,
    },
    {
      category: 'semantic-validation',
      request: async () =>
        response({
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ claims: [{}] }) } }],
        }),
      message: /missing or unexpected fields/,
    },
  ]

  for (const failure of cases) {
    const provider = providerWithFetch(failure.request)
    await assert.rejects(
      analyzeOpinion(request('How did Saka perform?'), provider),
      (error) => {
        assert.equal(error.category, failure.category)
        assert.match(error.message, failure.message)
        return true
      },
      failure.category,
    )
  }
})

test('classifies refused finish reasons and truncated output as incomplete', async () => {
  const outputs = [
    {
      body: {
        choices: [{
          finish_reason: 'content_filter',
          message: { content: null, refusal: 'blocked' },
        }],
      },
      category: 'refusal',
    },
    {
      body: {
        choices: [{
          finish_reason: 'length',
          message: { content: '{"claims":' },
        }],
      },
      category: 'incomplete-output',
    },
  ]
  for (const item of outputs) {
    const provider = providerWithFetch(async () => response(item.body))
    await assert.rejects(
      analyzeOpinion(request('Explain this claim.'), provider),
      (error) => error.category === item.category,
    )
  }
})

test('classifies an upstream timeout as transport failure', async () => {
  const provider = providerWithFetch(async () => {
    throw new DOMException('request timed out', 'TimeoutError')
  })
  await assert.rejects(
    analyzeOpinion(request('Explain this claim.'), provider),
    (error) => {
      assert.equal(error.category, 'transport')
      assert.match(error.message, /timed out after 30 seconds/i)
      return true
    },
  )
})

test('uses one bounded 30-second request and reports provider token usage when returned', async () => {
  let callCount = 0
  let requestSignal
  const reportedUsage = []
  const valid = await analyzeOpinion(request('How many shots did Eastport have?'))
  const provider = new FoundryInterpretationProvider(
    {
      baseUrl: 'https://example.invalid/openai/v1',
      apiKey: 'mock-key',
      deployment: 'mock-deployment',
    },
    async (_url, init) => {
      callCount += 1
      requestSignal = init.signal
      return response({
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ claims: [valid.claims[0].claim] }) } }],
        usage: { prompt_tokens: 120, completion_tokens: 34, total_tokens: 154 },
      })
    },
    (usage) => reportedUsage.push(usage),
  )

  await analyzeOpinion(request('How many shots did Eastport have?'), provider)

  assert.equal(callCount, 1)
  assert.ok(requestSignal instanceof AbortSignal)
  assert.equal(requestSignal.aborted, false)
  assert.deepEqual(reportedUsage, [{
    promptTokens: 120,
    completionTokens: 34,
    totalTokens: 154,
  }])
})

test('API surfaces a classified provider error without returning a success-shaped assessment', async () => {
  const provider = providerWithFetch(async () => response({}, 429))
  const context = {
    error() {},
  }
  const httpResponse = await createAnalyzeHandler(provider)(
    {
      async json() {
        return request('How did Saka perform?')
      },
    },
    context,
  )

  assert.equal(httpResponse.status, 502)
  assert.deepEqual(httpResponse.jsonBody, {
    error: 'Microsoft Foundry is throttling interpretation requests (HTTP 429).',
    failureType: 'throttling',
  })
})

test('accepts an unavailable-metric comparison request without creating a truth verdict', async () => {
  const baseline = await analyzeOpinion(
    request('Eastport ran further than Northbridge.'),
  )
  const claim = structuredClone(baseline.claims[0].claim)
  claim.text = 'Which team covered the greater distance?'
  claim.intent = 'unavailable-metric'
  claim.meaning.comparison.operator = 'comparison-request'
  const provider = mockedFoundry({ claims: [claim] })

  const result = await analyzeOpinion(
    request('Which team covered the greater distance?'),
    provider,
  )

  assert.equal(result.claims[0].assessment, 'unavailable data')
  assert.equal(result.claims[0].claim.intent, 'unavailable-metric')
  assert.equal(result.claims[0].claim.meaning.comparison.metric, 'running-distance')
  assert.deepEqual(result.claims[0].statistics, [])
  assert.deepEqual(result.claims[0].evidence, [])
})
