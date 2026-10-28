import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import test from 'node:test'
import { DATASET_CATALOG } from '../dist/shared/src/datasetCatalog.js'
import { analyzeOpinion } from '../dist/api/src/service.js'
import {
  FoundryAllowanceConfigurationError,
  FoundryAllowanceExceededError,
  FoundryAllowanceUnavailableError,
  AzureTableFoundryAllowance,
  foundryAllowanceSettings,
  foundryClientIdentity,
} from '../dist/api/src/foundryAllowance.js'
import { createAnalyzeHandler } from '../dist/api/src/functions/analyze.js'
import { resolveDataset } from '../dist/api/src/datasets.js'
import { FoundryInterpretationProvider } from '../dist/api/src/providers/foundry.js'
import { createInterpretationProvider } from '../dist/api/src/providers/index.js'
import { LocalInterpretationProvider } from '../dist/api/src/providers/local.js'

const testApiKey = randomBytes(32).toString('base64url')
const publicEnvironment = {
  FOUNDRY_PUBLIC_ENABLED: 'true',
  FOUNDRY_OPENAI_BASE_URL: 'https://foundry.example.test/openai/v1',
  FOUNDRY_API_KEY: testApiKey,
  FOUNDRY_MODEL_DEPLOYMENT: 'offline-stub',
}
const allowanceSettings = {
  tableName: 'FoundryJudging',
  maxRequests: 200,
  maxPerClient: 200,
  windowHours: 8760,
}
const analysisRequest = {
  opinion: 'How many shots on target did Eastport have?',
  selectedClock: { period: 2, minute: 58 },
  period: 'match-so-far',
  datasetId: 'northbridge-eastport-analysis-demo',
  inputLanguage: 'en',
}
const constructedClaim = {
  id: 'claim-1',
  subject: 'Northbridge',
  playerSubject: null,
  playerMetric: null,
  text: 'Northbridge had more shots than Eastport.',
  intent: 'factual-claim',
  meaning: {
    category: 'factual-comparison',
    description: 'Northbridge recorded more shots than Eastport.',
    comparison: {
      opponent: 'Eastport',
      opponentPlayer: null,
      metric: 'shots',
      operator: 'greater-than',
    },
  },
  requiredEvidence: ['shots'],
  timePeriod: { kind: 'selected' },
  historicalEventAnchor: null,
  clarificationNeeds: [],
}

class SharedMemoryTable {
  entity = null
  revision = 0
  fail = false

  async getEntity(partitionKey, rowKey) {
    if (this.fail) throw new Error('test storage unavailable')
    if (!this.entity) throw { statusCode: 404, code: 'ResourceNotFound' }
    assert.equal(this.entity.partitionKey, partitionKey)
    assert.equal(this.entity.rowKey, rowKey)
    return { ...this.entity, etag: String(this.revision) }
  }

  async createEntity(entity) {
    if (this.fail) throw new Error('test storage unavailable')
    if (this.entity) throw { statusCode: 409, code: 'EntityAlreadyExists' }
    this.entity = structuredClone(entity)
    this.revision += 1
  }

  async updateEntity(entity, _mode, options) {
    if (this.fail) throw new Error('test storage unavailable')
    if (!this.entity || options.etag !== String(this.revision)) {
      throw { statusCode: 412, code: 'UpdateConditionNotSatisfied' }
    }
    this.entity = structuredClone(entity)
    this.revision += 1
  }

  async *listEntities() {
    if (this.fail) throw new Error('test storage unavailable')
    if (this.entity) {
      yield { ...this.entity, etag: String(this.revision) }
    }
  }
}

function request(body, { localRules = false, forwardedFor = '192.0.2.10' } = {}) {
  return {
    headers: {
      get(name) {
        if (name === 'x-analysis-mode') return localRules ? 'local' : null
        if (name === 'x-forwarded-for') return forwardedFor
        return null
      },
    },
    async json() {
      return body
    },
  }
}

function foundryProviderForClaim(claim, onRequest = () => {}) {
  return new FoundryInterpretationProvider(
    {
      baseUrl: publicEnvironment.FOUNDRY_OPENAI_BASE_URL,
      apiKey: testApiKey,
      deployment: publicEnvironment.FOUNDRY_MODEL_DEPLOYMENT,
    },
    async (_url, init) => {
      onRequest(JSON.parse(init.body))
      return new Response(
        JSON.stringify({
          choices: [{
            finish_reason: 'stop',
            message: { content: JSON.stringify({ claims: [claim] }) },
          }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    },
  )
}

function handlerFor({
  environment = publicEnvironment,
  table = new SharedMemoryTable(),
  provider,
  allowanceFailure,
  events = [],
  settings = allowanceSettings,
} = {}) {
  const allowance = new AzureTableFoundryAllowance(table, settings)
  let reservations = 0
  return {
    handler: createAnalyzeHandler(
      new LocalInterpretationProvider(),
      environment,
      () => ({
        async reserve(identity) {
          events.push('reserve')
          reservations += 1
          if (allowanceFailure) throw allowanceFailure
          await allowance.reserve(identity)
        },
      }),
      () => provider,
    ),
    table,
    reservations: () => reservations,
  }
}

test('anonymous analysis reserves shared allowance before its single Foundry request', async () => {
  const local = await analyzeOpinion(analysisRequest)
  const events = []
  let calls = 0
  const provider = foundryProviderForClaim(local.claims[0].claim, () => {
    events.push('model')
    calls += 1
  })
  const { handler, reservations } = handlerFor({ provider, events })
  const response = await handler(
    request(analysisRequest),
    { error() {} },
  )
  assert.equal(response.status, 200, JSON.stringify(response.jsonBody))
  assert.equal(response.jsonBody.provider, 'foundry')
  assert.equal(response.jsonBody.selectedTime, '58′')
  assert.equal(response.jsonBody.evidenceFoundation.dataset.id, analysisRequest.datasetId)
  assert.equal(calls, 1)
  assert.equal(reservations(), 1)
  assert.deepEqual(events, ['reserve', 'model'])
})

test('an explicit local-rules request bypasses Foundry and the allowance', async () => {
  let calls = 0
  const provider = foundryProviderForClaim({}, () => { calls += 1 })
  const { handler, reservations } = handlerFor({ provider })
  const response = await handler(
    request(analysisRequest, { localRules: true }),
    { error() {} },
  )
  assert.equal(response.status, 200)
  assert.equal(response.jsonBody.provider, 'local')
  assert.equal(calls, 0)
  assert.equal(reservations(), 0)
})

test('public AI remains local unless the server enables it', async () => {
  let calls = 0
  const provider = foundryProviderForClaim({}, () => { calls += 1 })
  const { handler, reservations } = handlerFor({
    provider,
    environment: { ...publicEnvironment, FOUNDRY_PUBLIC_ENABLED: 'false' },
  })
  const response = await handler(
    {
      headers: {
        get(name) {
          return name === 'x-foundry-judge-code' ? 'client-supplied-value' : null
        },
      },
      async json() {
        return analysisRequest
      },
    },
    { error() {} },
  )
  assert.equal(response.status, 200)
  assert.equal(response.jsonBody.provider, 'local')
  assert.equal(calls, 0)
  assert.equal(reservations(), 0)

  const providerField = await handler(
    request({ ...analysisRequest, provider: 'foundry' }),
    { error() {} },
  )
  assert.equal(providerField.status, 400)
  assert.equal(calls, 0)
  assert.equal(reservations(), 0)
})

test('missing Foundry configuration fails closed before allowance reservation', async () => {
  let calls = 0
  let reservations = 0
  const handler = createAnalyzeHandler(
    new LocalInterpretationProvider(),
    { FOUNDRY_PUBLIC_ENABLED: 'true' },
    () => {
      reservations += 1
      return { async reserve() {} }
    },
    () => {
      calls += 1
      throw new Error('missing server configuration')
    },
  )
  const response = await handler(request(analysisRequest), { error() {} })
  assert.equal(response.status, 503)
  assert.equal(response.jsonBody.errorCode, 'foundry_not_configured')
  assert.equal(calls, 1)
  assert.equal(reservations, 0)
})

test('exhaustion and storage failure reject anonymous AI before model transport', async () => {
  for (const [failure, expectedStatus, expectedCode] of [
    [new FoundryAllowanceExceededError('total'), 429, 'foundry_allowance_exhausted'],
    [new FoundryAllowanceUnavailableError(), 503, 'foundry_allowance_unavailable'],
  ]) {
    let calls = 0
    const provider = foundryProviderForClaim({}, () => { calls += 1 })
    const { handler } = handlerFor({ provider, allowanceFailure: failure })
    const response = await handler(
      request(analysisRequest),
      { error() {} },
    )
    assert.equal(response.status, expectedStatus)
    assert.equal(response.jsonBody.errorCode, expectedCode)
    assert.equal(calls, 0)
  }
})

test('a failed outbound attempt consumes one reservation and is never retried', async () => {
  const table = new SharedMemoryTable()
  let calls = 0
  const provider = new FoundryInterpretationProvider(
    {
      baseUrl: publicEnvironment.FOUNDRY_OPENAI_BASE_URL,
      apiKey: testApiKey,
      deployment: publicEnvironment.FOUNDRY_MODEL_DEPLOYMENT,
    },
    async () => {
      calls += 1
      throw new Error('test transport failure')
    },
  )
  const { handler } = handlerFor({ provider, table })
  const response = await handler(
    request(analysisRequest),
    { error() {} },
  )
  assert.equal(response.status, 502)
  assert.equal(response.jsonBody.errorCode, 'foundry_interpretation_failed')
  assert.equal(calls, 1)
  assert.equal(table.entity.totalCount, 1)
})

test('player selection uses the signed continuation without another allowance or model call', async () => {
  const priorKey = process.env.PLAYER_RESOLUTION_SIGNING_KEY
  process.env.PLAYER_RESOLUTION_SIGNING_KEY =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  try {
    const body = {
      ...analysisRequest,
      opinion: 'How good was Bruno today?',
    }
    const local = await analyzeOpinion(body)
    assert.equal(local.claims[0].assessment, 'clarification needed')
    let calls = 0
    const provider = foundryProviderForClaim(local.claims[0].claim, () => {
      calls += 1
    })
    const { handler, reservations } = handlerFor({ provider })
    const initial = await handler(request(body), { error() {} })
    assert.equal(initial.status, 200, JSON.stringify(initial.jsonBody))
    assert.equal(initial.jsonBody.claims[0].playerResolution.candidates.length, 2)
    const choice = initial.jsonBody.claims[0].playerResolution.candidates[0]
    const resolved = await handler(
      request({
        action: 'resolve-player',
        continuation: initial.jsonBody.claims[0].playerResolution.continuation,
        claimId: initial.jsonBody.claims[0].claim.id,
        playerId: choice.id,
      }),
      { error() {} },
    )
    assert.equal(resolved.status, 200)
    assert.equal(calls, 1)
    assert.equal(reservations(), 1)
    assert.equal(resolved.jsonBody.provider, 'foundry')
    assert.equal(resolved.jsonBody.claims[0].claim.playerSubject.id, choice.id)
    assert.equal(resolved.jsonBody.evidenceFoundation.dataset.id, body.datasetId)
  } finally {
    if (priorKey === undefined) delete process.env.PLAYER_RESOLUTION_SIGNING_KEY
    else process.env.PLAYER_RESOLUTION_SIGNING_KEY = priorKey
  }
})

test('all four fixtures use their own selected-time context and calculated evidence', async () => {
  for (const fixture of DATASET_CATALOG) {
    const body = {
      ...analysisRequest,
      opinion: `${fixture.teams[0]} had more shots than ${fixture.teams[1]}.`,
      datasetId: fixture.id,
    }
    const requestContext = []
    const provider = foundryProviderForClaim(
      constructedClaim,
      (modelRequest) => requestContext.push(modelRequest),
    )
    const { handler } = handlerFor({ provider })
    const response = await handler(request(body), { error() {} })
    assert.equal(response.status, 200, `${fixture.id}: ${JSON.stringify(response.jsonBody)}`)
    const result = response.jsonBody
    assert.equal(result.provider, 'foundry')
    assert.equal(result.evidenceFoundation.dataset.id, fixture.id)
    assert.equal(result.selectedTime, '58′')
    assert.equal(requestContext.length, 1)
    assert.ok(result.claims[0].statistics.length > 0)
    const userContext = requestContext[0].messages[1].content
    const fixtureData = resolveDataset(fixture.id)
    assert.ok(userContext.includes(fixtureData.evidence.players[0].name))
    assert.ok(userContext.includes(fixtureData.events[0].id))
    const parsedContext = JSON.parse(userContext)
    assert.deepEqual(
      parsedContext.availableTeams,
      [...new Set(fixtureData.evidence.players.map(({ team }) => team))],
    )
  }
})

test('atomic table reservations enforce shared and per-client caps across instances and restarts', async () => {
  const table = new SharedMemoryTable()
  const settings = { ...allowanceSettings, maxRequests: 5, maxPerClient: 3 }
  const firstInstance = new AzureTableFoundryAllowance(table, settings)
  const secondInstance = new AzureTableFoundryAllowance(table, settings)
  const outcomes = await Promise.allSettled(
    Array.from({ length: 20 }, (_, index) =>
      (index % 2 === 0 ? firstInstance : secondInstance).reserve(
        `client-${index % 4}`,
        1_800_000_000_000,
      ),
    ),
  )
  assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 5)
  assert.equal(table.entity.totalCount, 5)

  const afterRestart = new AzureTableFoundryAllowance(table, settings)
  await assert.rejects(
    afterRestart.reserve('new-client', 1_800_000_000_000),
    FoundryAllowanceExceededError,
  )
  const currentWindow = Math.floor(
    1_800_000_000_000 / (settings.windowHours * 60 * 60 * 1000),
  ) * settings.windowHours * 60 * 60 * 1000
  await afterRestart.reserve(
    'new-client',
    currentWindow + settings.windowHours * 60 * 60 * 1000 + 1,
  )
  assert.equal(table.entity.totalCount, 1)
  const rolledWindow = table.entity.windowStart
  await assert.rejects(
    afterRestart.reserve('late-old-window-client', currentWindow + 1),
    FoundryAllowanceUnavailableError,
  )
  assert.equal(table.entity.windowStart, rolledWindow)
  assert.equal(table.entity.totalCount, 1)
})

test('missing allowance configuration and storage fail closed', async () => {
  assert.throws(
    () => foundryAllowanceSettings({}),
    FoundryAllowanceConfigurationError,
  )
  assert.deepEqual(
    foundryAllowanceSettings({
      FOUNDRY_ALLOWANCE_TABLE_NAME: 'FoundryJudging',
      FOUNDRY_ALLOWANCE_MAX_REQUESTS: '200',
      FOUNDRY_ALLOWANCE_MAX_PER_CLIENT: '200',
      FOUNDRY_ALLOWANCE_WINDOW_HOURS: '8760',
    }),
    allowanceSettings,
  )
  const table = new SharedMemoryTable()
  table.fail = true
  const allowance = new AzureTableFoundryAllowance(table, allowanceSettings)
  await assert.rejects(allowance.checkAvailable(), FoundryAllowanceUnavailableError)
  await assert.rejects(
    allowance.reserve('client', 1_800_000_000_000),
    FoundryAllowanceUnavailableError,
  )
})

test('per-client identity is a stable hash of the first forwarded IP, with shared fallback', () => {
  const first = foundryClientIdentity('192.0.2.1, 198.51.100.2')
  assert.equal(first, foundryClientIdentity('192.0.2.1'))
  assert.notEqual(first, foundryClientIdentity('192.0.2.2'))
  assert.equal(foundryClientIdentity(null), foundryClientIdentity('not-an-ip'))
  assert.doesNotMatch(first, /192\.0\.2/u)
})

test('the public provider factory refuses an unprotected Foundry default', () => {
  assert.throws(
    () => createInterpretationProvider({ CLAIM_INTERPRETER_PROVIDER: 'foundry' }),
    /Public analysis must use local rules/u,
  )
})
