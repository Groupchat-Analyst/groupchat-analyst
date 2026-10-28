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
import { createFoundryAccessHandler } from '../dist/api/src/functions/foundryAccess.js'
import { resolveDataset } from '../dist/api/src/datasets.js'
import { FoundryInterpretationProvider } from '../dist/api/src/providers/foundry.js'
import { createInterpretationProvider } from '../dist/api/src/providers/index.js'
import { LocalInterpretationProvider } from '../dist/api/src/providers/local.js'

const accessCode = randomBytes(32).toString('base64url')
const testApiKey = randomBytes(32).toString('base64url')
const judgeEnvironment = {
  FOUNDRY_JUDGE_ENABLED: 'true',
  FOUNDRY_JUDGE_ACCESS_CODE: accessCode,
  FOUNDRY_OPENAI_BASE_URL: 'https://foundry.example.test/openai/v1',
  FOUNDRY_API_KEY: testApiKey,
  FOUNDRY_MODEL_DEPLOYMENT: 'offline-stub',
}
const allowanceSettings = {
  tableName: 'FoundryRequestAllowance',
  maxRequests: 6,
  maxPerClient: 2,
  windowHours: 24,
}
const analysisRequest = {
  opinion: 'How many shots on target did Eastport have?',
  selectedClock: { period: 2, minute: 58 },
  period: 'match-so-far',
  datasetId: 'northbridge-eastport-analysis-demo',
  inputLanguage: 'en',
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
}

function request(body, code, forwardedFor = '192.0.2.10') {
  return {
    headers: {
      get(name) {
        if (name === 'x-foundry-judge-code') return code ?? null
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
      baseUrl: judgeEnvironment.FOUNDRY_OPENAI_BASE_URL,
      apiKey: judgeEnvironment.FOUNDRY_API_KEY,
      deployment: judgeEnvironment.FOUNDRY_MODEL_DEPLOYMENT,
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
  environment = judgeEnvironment,
  table = new SharedMemoryTable(),
  provider,
  allowanceFailure,
} = {}) {
  const allowance = new AzureTableFoundryAllowance(table, allowanceSettings)
  let reservations = 0
  return {
    handler: createAnalyzeHandler(
      new LocalInterpretationProvider(),
      environment,
      () => ({
        async reserve(identity) {
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

test('invalid judge access codes produce no interpreter request or allowance reservation', async () => {
  let calls = 0
  const provider = foundryProviderForClaim({}, () => { calls += 1 })
  const { handler, reservations } = handlerFor({ provider })
  const response = await handler(
    request(analysisRequest, 'wrong-judge-test-code'),
    { error() {} },
  )
  assert.equal(response.status, 401)
  assert.equal(response.jsonBody.errorCode, 'foundry_access_denied')
  assert.equal(calls, 0)
  assert.equal(reservations(), 0)
})

test('one authorized request reserves once and sends one Foundry interpreter request', async () => {
  const local = await analyzeOpinion(analysisRequest)
  let calls = 0
  let modelContext
  const provider = foundryProviderForClaim(local.claims[0].claim, (body) => {
    calls += 1
    modelContext = body.messages.map(({ content }) => content).join('\n')
  })
  const { handler, reservations } = handlerFor({ provider })
  const response = await handler(
    request(analysisRequest, accessCode),
    { error() {} },
  )
  assert.equal(response.status, 200, JSON.stringify(response.jsonBody))
  assert.equal(response.jsonBody.provider, 'foundry')
  assert.equal(response.jsonBody.selectedTime, '58′')
  assert.equal(response.jsonBody.evidenceFoundation.dataset.id, analysisRequest.datasetId)
  assert.equal(calls, 1)
  assert.equal(reservations(), 1)
  assert.match(modelContext, /Eastport/)
})

test('player selection uses the signed continuation and makes no second interpreter request', async () => {
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
    const { handler } = handlerFor({ provider })
    const initial = await handler(
      request(body, accessCode),
      { error() {} },
    )
    assert.equal(initial.status, 200, JSON.stringify(initial.jsonBody))
    assert.equal(initial.jsonBody.claims[0].playerResolution.candidates.length, 2)
    const chosen = initial.jsonBody.claims[0].playerResolution.candidates[0]
    const resolved = await handler(
      request({
        action: 'resolve-player',
        continuation: initial.jsonBody.claims[0].playerResolution.continuation,
        claimId: initial.jsonBody.claims[0].claim.id,
        playerId: chosen.id,
      }, accessCode),
      { error() {} },
    )
    assert.equal(resolved.status, 200)
    assert.equal(calls, 1)
    assert.equal(resolved.jsonBody.provider, 'foundry')
    assert.equal(resolved.jsonBody.claims[0].claim.playerSubject.id, chosen.id)
    assert.equal(resolved.jsonBody.evidenceFoundation.dataset.id, body.datasetId)
  } finally {
    if (priorKey === undefined) delete process.env.PLAYER_RESOLUTION_SIGNING_KEY
    else process.env.PLAYER_RESOLUTION_SIGNING_KEY = priorKey
  }
})

test('exhaustion and storage failure reject judge requests before model transport', async () => {
  for (const [failure, expectedStatus, expectedCode] of [
    [new FoundryAllowanceExceededError('total'), 429, 'foundry_allowance_exhausted'],
    [new FoundryAllowanceUnavailableError(), 503, 'foundry_allowance_unavailable'],
  ]) {
    let calls = 0
    const provider = foundryProviderForClaim({}, () => { calls += 1 })
    const { handler } = handlerFor({ provider, allowanceFailure: failure })
    const response = await handler(
      request(analysisRequest, accessCode),
      { error() {} },
    )
    assert.equal(response.status, expectedStatus)
    assert.equal(response.jsonBody.errorCode, expectedCode)
    assert.equal(calls, 0)
  }
})

test('a failed outbound Foundry attempt consumes one reservation and is not retried', async () => {
  const table = new SharedMemoryTable()
  let calls = 0
  const provider = new FoundryInterpretationProvider(
    {
      baseUrl: judgeEnvironment.FOUNDRY_OPENAI_BASE_URL,
      apiKey: testApiKey,
      deployment: judgeEnvironment.FOUNDRY_MODEL_DEPLOYMENT,
    },
    async () => {
      calls += 1
      throw new Error('test transport failure')
    },
  )
  const { handler } = handlerFor({ provider, table })
  const response = await handler(
    request(analysisRequest, accessCode),
    { error() {} },
  )
  assert.equal(response.status, 502)
  assert.equal(calls, 1)
  assert.equal(table.entity.totalCount, 1)
})

test('the public analysis path remains local without an access code', async () => {
  let calls = 0
  const provider = foundryProviderForClaim({}, () => { calls += 1 })
  const { handler, reservations } = handlerFor({ provider })
  const response = await handler(
    request(analysisRequest, null),
    { error() {} },
  )
  assert.equal(response.status, 200)
  assert.equal(response.jsonBody.provider, 'local')
  assert.equal(calls, 0)
  assert.equal(reservations(), 0)
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

test('all four fixtures provide their own selected-time context and calculated evidence offline', async () => {
  for (const fixture of DATASET_CATALOG) {
    const local = await analyzeOpinion({
      ...analysisRequest,
      opinion: `How many shots did ${fixture.teams[0]} have?`,
      datasetId: fixture.id,
    })
    const requestContext = []
    const provider = foundryProviderForClaim(
      {
        ...local.claims[0].claim,
        subject: 'Northbridge',
      },
      (body) => requestContext.push(body),
    )
    const body = {
      ...analysisRequest,
      opinion: `How many shots did ${fixture.teams[0]} have?`,
      datasetId: fixture.id,
    }
    const { handler } = handlerFor({ provider })
    const response = await handler(
      request(body, accessCode),
      { error() {} },
    )
    assert.equal(response.status, 200, fixture.id)
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
    assert.ok(
      requestContext[0].response_format.json_schema.schema.properties.claims.items.properties.subject.anyOf[0].enum.includes('Northbridge'),
    )
  }
})

test('access verification fails closed when judge AI is not enabled or configured', async () => {
  const handler = createFoundryAccessHandler({
    ...judgeEnvironment,
    FOUNDRY_JUDGE_ENABLED: 'false',
  })
  const response = await handler(
    { async json() { return { code: accessCode } } },
    { error() {} },
  )
  assert.equal(response.status, 503)
  assert.equal(response.jsonBody.errorCode, 'foundry_not_configured')
})

test('valid judge access only checks the pre-provisioned allowance store and returns no credential', async () => {
  let availabilityChecks = 0
  const handler = createFoundryAccessHandler(
    judgeEnvironment,
    () => ({
      async checkAvailable() {
        availabilityChecks += 1
      },
    }),
  )
  const response = await handler(
    { async json() { return { code: accessCode } } },
    { error() {} },
  )
  assert.equal(response.status, 200)
  assert.deepEqual(response.jsonBody, { enabled: true })
  assert.equal(availabilityChecks, 1)
})

test('missing quota configuration and missing table access fail closed', async () => {
  assert.throws(
    () => foundryAllowanceSettings({}),
    FoundryAllowanceConfigurationError,
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
