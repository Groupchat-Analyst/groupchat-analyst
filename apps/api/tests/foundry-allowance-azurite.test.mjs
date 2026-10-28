import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { TableClient, TableServiceClient } from '@azure/data-tables'
import { analyzeOpinion } from '../dist/api/src/service.js'
import {
  FoundryAllowanceConfigurationError,
  FoundryAllowanceExceededError,
  createAzureTableFoundryAllowance,
  foundryClientIdentity,
} from '../dist/api/src/foundryAllowance.js'
import { createAnalyzeHandler } from '../dist/api/src/functions/analyze.js'
import { FoundryInterpretationProvider } from '../dist/api/src/providers/foundry.js'
import { LocalInterpretationProvider } from '../dist/api/src/providers/local.js'

const apiRoot = fileURLToPath(new URL('../', import.meta.url))
const azuriteEntry = path.join(
  apiRoot,
  'node_modules',
  'azurite',
  'dist',
  'src',
  'table',
  'main.js',
)
const workerEntry = fileURLToPath(
  new URL('./allowance-process-worker.mjs', import.meta.url),
)
const selectedTime = Date.now()
const emulatorClientOptions = { allowInsecureConnection: true }
const analysisBody = {
  opinion: 'How many shots on target did Eastport have?',
  selectedClock: { period: 2, minute: 58 },
  period: 'match-so-far',
  datasetId: 'northbridge-eastport-analysis-demo',
  inputLanguage: 'en',
}

async function unusedPort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  await new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  )
  return port
}

function allowanceEnvironment(connectionString, tableName, limits = {}) {
  return {
    FOUNDRY_PUBLIC_ENABLED: 'true',
    FOUNDRY_OPENAI_BASE_URL: 'https://foundry.example.test/openai/v1',
    FOUNDRY_API_KEY: randomBytes(32).toString('base64url'),
    FOUNDRY_MODEL_DEPLOYMENT: 'offline-azurite-stub',
    FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING: connectionString,
    FOUNDRY_ALLOWANCE_TABLE_NAME: tableName,
    FOUNDRY_ALLOWANCE_MAX_REQUESTS: String(limits.maxRequests ?? 6),
    FOUNDRY_ALLOWANCE_MAX_PER_CLIENT: String(limits.maxPerClient ?? 6),
    FOUNDRY_ALLOWANCE_WINDOW_HOURS: String(limits.windowHours ?? 24),
  }
}

function request(body, forwardedFor = '192.0.2.77') {
  return {
    headers: {
      get(name) {
        if (name === 'x-forwarded-for') return forwardedFor
        return null
      },
    },
    async json() {
      return body
    },
  }
}

function tableName(prefix = 'Foundry') {
  return `${prefix}${randomBytes(8).toString('hex')}`
}

function childEnvironment(additions) {
  const inherited = Object.fromEntries(
    ['SystemRoot', 'TEMP', 'TMP']
      .filter((name) => process.env[name])
      .map((name) => [name, process.env[name]]),
  )
  return { ...inherited, ...additions }
}

function judgeProvider(environment, fetcher) {
  return new FoundryInterpretationProvider(
    {
      baseUrl: environment.FOUNDRY_OPENAI_BASE_URL,
      apiKey: environment.FOUNDRY_API_KEY,
      deployment: environment.FOUNDRY_MODEL_DEPLOYMENT,
    },
    fetcher,
  )
}

function analyzeHandler(environment, provider) {
  return createAnalyzeHandler(
    new LocalInterpretationProvider(),
    environment,
    (settings) =>
      createAzureTableFoundryAllowance(settings, emulatorClientOptions),
    () => provider,
  )
}

async function runWorker(
  environment,
  workerId,
  barrierDirectory,
  clientId,
  attempts = 1,
) {
  const child = spawn(process.execPath, [workerEntry], {
    cwd: apiRoot,
    env: childEnvironment({
      ...environment,
      ALLOWANCE_WORKER_ID: workerId,
      ALLOWANCE_BARRIER_DIRECTORY: barrierDirectory ?? '',
      ALLOWANCE_CLIENT_ID: clientId,
      ALLOWANCE_NOW: String(selectedTime),
      ALLOWANCE_ATTEMPTS: String(attempts),
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
  const timer = setTimeout(() => child.kill(), 25_000)
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', resolve)
  }).finally(() => clearTimeout(timer))
  assert.equal(exitCode, 0, `Allowance worker failed: ${stderr}`)
  return JSON.parse(stdout)
}

function startAzurite(location, port, accountName, accountKey) {
  const child = spawn(
    process.execPath,
    [
      azuriteEntry,
      '--disableTelemetry',
      '--location',
      location,
      '--tableHost',
      '127.0.0.1',
      '--tablePort',
      String(port),
    ],
    {
      cwd: apiRoot,
      env: childEnvironment({
        AZURITE_ACCOUNTS: `${accountName}:${accountKey}`,
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let output = ''
  child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk })
  child.stderr.setEncoding('utf8').on('data', (chunk) => { output += chunk })
  const ready = new Promise((resolve, reject) => {
    let settled = false
    const fail = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    }
    const timer = setTimeout(
      () => fail(new Error(`Azurite Table did not start: ${output}`)),
      45_000,
    )
    child.once('error', fail)
    child.once('close', (code) =>
      fail(new Error(`Azurite Table exited (${code}): ${output}`)),
    )
    const check = () => {
      if (settled) return
      const socket = net.createConnection({ host: '127.0.0.1', port })
      socket.once('connect', () => {
        socket.destroy()
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (!settled) setTimeout(check, 100)
      })
    }
    check()
  })
  return { child, ready }
}

async function tableServiceReady(service) {
  const deadline = Date.now() + 10_000
  let lastError
  while (Date.now() < deadline) {
    try {
      for await (const _table of service.listTables()) break
      return
    } catch (error) {
      lastError = error
      await delay(50)
    }
  }
  throw lastError ?? new Error('Azurite Table endpoint did not become ready.')
}

test('real Azure Table adapter preserves and enforces the allowance on Azurite', {
  timeout: 90_000,
}, async (t) => {
  const workspace = await mkdtemp(
    path.join(os.tmpdir(), 'foundry-allowance-azurite-'),
  )
  const accountName = `judge${randomBytes(8).toString('hex')}`
  const accountKey = randomBytes(32).toString('base64')
  const port = await unusedPort()
  const connectionString = [
    'DefaultEndpointsProtocol=http',
    `AccountName=${accountName}`,
    `AccountKey=${accountKey}`,
    `TableEndpoint=http://127.0.0.1:${port}/${accountName}`,
  ].join(';')
  const azurite = startAzurite(
    path.join(workspace, 'data'),
    port,
    accountName,
    accountKey,
  )

  try {
    await azurite.ready
    const tableService = TableServiceClient.fromConnectionString(
      connectionString,
      emulatorClientOptions,
    )
    await tableServiceReady(tableService)

    await t.test('first write, updates, serialization and exhaustion', async () => {
      const name = tableName()
      await tableService.createTable(name)
      const environment = allowanceEnvironment(connectionString, name, {
        maxRequests: 2,
        maxPerClient: 2,
      })
      const allowance = createAzureTableFoundryAllowance(
        environment,
        emulatorClientOptions,
      )
      const table = TableClient.fromConnectionString(
        connectionString,
        name,
        emulatorClientOptions,
      )
      const client = foundryClientIdentity('192.0.2.77')

      await allowance.checkAvailable()
      await allowance.reserve(client, selectedTime)
      const first = await table.getEntity('foundry-judge', 'allowance')
      assert.equal(first.partitionKey, 'foundry-judge')
      assert.equal(first.rowKey, 'allowance')
      assert.equal(typeof first.etag, 'string')
      assert.equal(typeof first.windowStart, 'number')
      assert.equal(typeof first.totalCount, 'number')
      assert.equal(first.totalCount, 1)
      assert.deepEqual(JSON.parse(first.clientCounts), { [client]: 1 })

      await allowance.reserve(client, selectedTime)
      const updated = await table.getEntity('foundry-judge', 'allowance')
      assert.equal(updated.totalCount, 2)
      assert.deepEqual(JSON.parse(updated.clientCounts), { [client]: 2 })
      await assert.rejects(
        allowance.reserve(client, selectedTime),
        FoundryAllowanceExceededError,
      )
      assert.equal(
        (await table.getEntity('foundry-judge', 'allowance')).totalCount,
        2,
      )
    })

    await t.test('Azurite rejects a stale entity ETag', async () => {
      const name = tableName()
      await tableService.createTable(name)
      const environment = allowanceEnvironment(connectionString, name)
      const allowance = createAzureTableFoundryAllowance(
        environment,
        emulatorClientOptions,
      )
      const table = TableClient.fromConnectionString(
        connectionString,
        name,
        emulatorClientOptions,
      )
      await allowance.reserve('etag-test-client', selectedTime)
      const first = await table.getEntity('foundry-judge', 'allowance')
      const stale = await table.getEntity('foundry-judge', 'allowance')
      const update = (entity, totalCount) => ({
        partitionKey: entity.partitionKey,
        rowKey: entity.rowKey,
        windowStart: entity.windowStart,
        totalCount,
        clientCounts: entity.clientCounts,
      })

      await table.updateEntity(
        update(first, first.totalCount + 1),
        'Replace',
        { etag: first.etag },
      )
      await assert.rejects(
        table.updateEntity(
          update(stale, stale.totalCount + 1),
          'Replace',
          { etag: stale.etag },
        ),
        (error) => error.statusCode === 412,
      )
    })

    await t.test('two independent processes resolve a real ETag race and share the ceiling', async () => {
      const name = tableName()
      await tableService.createTable(name)
      const environment = allowanceEnvironment(connectionString, name, {
        maxRequests: 4,
        maxPerClient: 4,
      })
      const allowance = createAzureTableFoundryAllowance(
        environment,
        emulatorClientOptions,
      )
      const table = TableClient.fromConnectionString(
        connectionString,
        name,
        emulatorClientOptions,
      )
      await allowance.reserve('initial-client', selectedTime)
      const barrierDirectory = path.join(workspace, 'process-barrier')
      await mkdir(barrierDirectory)
      const results = await Promise.all([
        runWorker(environment, 'first', barrierDirectory, 'process-one', 3),
        runWorker(environment, 'second', barrierDirectory, 'process-two', 3),
      ])
      assert.deepEqual(results.map(({ synchronized }) => synchronized), [true, true])
      assert.equal(
        results.reduce((sum, { reserved }) => sum + reserved, 0),
        3,
      )
      assert.equal(
        results.reduce((sum, { exhausted }) => sum + exhausted, 0),
        3,
      )
      assert.ok(
        results.reduce((sum, { conflictCount }) => sum + conflictCount, 0) >= 1,
        JSON.stringify(results),
      )
      const conflictLog = await readFile(
        path.join(barrierDirectory, 'etag-conflicts'),
        'utf8',
      )
      assert.match(conflictLog, /first|second/u)
      assert.equal(
        (await table.getEntity('foundry-judge', 'allowance')).totalCount,
        4,
      )

      const restarted = await runWorker(environment, 'restart', null, 'after-restart')
      assert.equal(restarted.reserved, 0)
      assert.equal(restarted.exhausted, 1)
      assert.equal(
        (await table.getEntity('foundry-judge', 'allowance')).totalCount,
        4,
      )

      let modelAttempts = 0
      const provider = judgeProvider(environment, async () => {
        modelAttempts += 1
        throw new Error('The exhausted allowance must block transport.')
      })
      const handler = analyzeHandler(environment, provider)
      const exhausted = await handler(
        request(analysisBody),
        { error() {} },
      )
      assert.equal(exhausted.status, 429)
      assert.equal(modelAttempts, 0)
    })

    await t.test('missing table and storage outage make no model attempts', async () => {
      let modelAttempts = 0
      const provider = judgeProvider(
        allowanceEnvironment(connectionString, tableName()),
        async () => {
          modelAttempts += 1
          throw new Error('No model request is expected.')
        },
      )

      const missingName = tableName()
      const missingEnvironment = allowanceEnvironment(
        connectionString,
        missingName,
      )
      const missingTableHandler = analyzeHandler(missingEnvironment, provider)
      const missingTable = await missingTableHandler(
        request(analysisBody),
        { error() {} },
      )
      assert.equal(missingTable.status, 503)

      const closedPort = await unusedPort()
      const unavailableEnvironment = allowanceEnvironment(
        connectionString.replace(
          `:${port}/${accountName}`,
          `:${closedPort}/${accountName}`,
        ),
        tableName(),
      )
      const unavailableHandler = analyzeHandler(unavailableEnvironment, provider)
      const unavailable = await unavailableHandler(
        request(analysisBody),
        { error() {} },
      )
      assert.equal(unavailable.status, 503)
      assert.equal(modelAttempts, 0)
    })

    await t.test('failed outbound attempts remain reserved and are not retried', async () => {
      const name = tableName()
      await tableService.createTable(name)
      const environment = allowanceEnvironment(connectionString, name)
      const local = await analyzeOpinion(analysisBody)
      assert.ok(local.claims.length > 0)
      let modelAttempts = 0
      const provider = judgeProvider(environment, async () => {
        modelAttempts += 1
        throw new Error('stubbed offline transport failure')
      })
      const handler = analyzeHandler(environment, provider)
      const response = await handler(
        request(analysisBody),
        { error() {} },
      )
      assert.equal(response.status, 502)
      assert.equal(modelAttempts, 1)
      const table = TableClient.fromConnectionString(
        connectionString,
        name,
        emulatorClientOptions,
      )
      const stored = await table.getEntity('foundry-judge', 'allowance')
      assert.equal(stored.totalCount, 1)
      assert.equal(JSON.parse(stored.clientCounts)[
        foundryClientIdentity('192.0.2.77')
      ], 1)
    })

    await t.test('the legacy Functions host setting cannot configure the allowance adapter', () => {
      assert.throws(
        () =>
          createAzureTableFoundryAllowance({
            AzureWebJobsStorage: connectionString,
            FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING: '',
            FOUNDRY_ALLOWANCE_TABLE_NAME: tableName(),
            FOUNDRY_ALLOWANCE_MAX_REQUESTS: '2',
            FOUNDRY_ALLOWANCE_MAX_PER_CLIENT: '2',
            FOUNDRY_ALLOWANCE_WINDOW_HOURS: '24',
          }),
        FoundryAllowanceConfigurationError,
      )
    })
  } finally {
    azurite.child.kill()
    await new Promise((resolve) => {
      if (azurite.child.exitCode !== null) resolve()
      else azurite.child.once('close', resolve)
    })
    await rm(workspace, { recursive: true, force: true })
  }
})
