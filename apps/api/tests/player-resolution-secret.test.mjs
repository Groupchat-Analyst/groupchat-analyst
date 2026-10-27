import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { createAnalyzeHandler } from '../dist/api/src/functions/analyze.js'
import { playerResolutionSecret } from '../dist/api/src/playerResolution.js'
import { LocalInterpretationProvider } from '../dist/api/src/providers/local.js'

const serviceUrl = new URL('../dist/api/src/service.js', import.meta.url).href
const testKey = Buffer.alloc(32, 0x5a).toString('base64url')

function runResolutionInNewProcess(input, key) {
  const script = `
    import { analyzeOpinion } from ${JSON.stringify(serviceUrl)}
    let source = ''
    for await (const chunk of process.stdin) source += chunk
    try {
      const result = await analyzeOpinion(JSON.parse(source))
      process.stdout.write(JSON.stringify({
        provider: result.provider,
        player: result.claims[0].claim.playerSubject,
      }))
    } catch (error) {
      process.stdout.write(JSON.stringify({
        error: error instanceof Error ? error.message : 'Resolution failed.',
      }))
      process.exitCode = 1
    }
  `
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PLAYER_RESOLUTION_SIGNING_KEY: key,
    },
    input: JSON.stringify(input),
  })
}

test('production signing key requires canonical unpadded base64url for 32 bytes', () => {
  const priorNodeEnv = process.env.NODE_ENV
  const priorKey = process.env.PLAYER_RESOLUTION_SIGNING_KEY
  try {
    process.env.NODE_ENV = 'production'
    delete process.env.PLAYER_RESOLUTION_SIGNING_KEY
    assert.throws(playerResolutionSecret, /unavailable until PLAYER_RESOLUTION_SIGNING_KEY is configured/)

    process.env.PLAYER_RESOLUTION_SIGNING_KEY = testKey
    assert.equal(playerResolutionSecret(), testKey)

    for (const invalid of [
      '',
      'short',
      Buffer.alloc(31, 0x5a).toString('base64url'),
      Buffer.alloc(32, 0x5a).toString('base64'),
    ]) {
      process.env.PLAYER_RESOLUTION_SIGNING_KEY = invalid
      assert.throws(playerResolutionSecret, /32 random bytes encoded as unpadded base64url/)
    }
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = priorNodeEnv
    if (priorKey === undefined) delete process.env.PLAYER_RESOLUTION_SIGNING_KEY
    else process.env.PLAYER_RESOLUTION_SIGNING_KEY = priorKey
  }
})

test('production clarification request fails explicitly when the signing key is missing', async () => {
  const priorNodeEnv = process.env.NODE_ENV
  const priorKey = process.env.PLAYER_RESOLUTION_SIGNING_KEY
  try {
    process.env.NODE_ENV = 'production'
    delete process.env.PLAYER_RESOLUTION_SIGNING_KEY
    const handler = createAnalyzeHandler(new LocalInterpretationProvider())
    const response = await handler(
      {
        json: async () => ({
          opinion: 'How many passes did Bruno complete?',
          selectedClock: { period: 2, minute: 58 },
          period: 'match-so-far',
          datasetId: 'northbridge-eastport-analysis-demo',
        }),
      },
      { error() {} },
    )
    assert.equal(response.status, 502)
    assert.match(response.jsonBody.error, /unavailable until PLAYER_RESOLUTION_SIGNING_KEY is configured/)
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = priorNodeEnv
    if (priorKey === undefined) delete process.env.PLAYER_RESOLUTION_SIGNING_KEY
    else process.env.PLAYER_RESOLUTION_SIGNING_KEY = priorKey
  }
})

test('signed continuations resolve across processes only with the same configured key', async () => {
  const priorNodeEnv = process.env.NODE_ENV
  const priorKey = process.env.PLAYER_RESOLUTION_SIGNING_KEY
  try {
    process.env.NODE_ENV = 'production'
    process.env.PLAYER_RESOLUTION_SIGNING_KEY = testKey
    const initial = await analyzeOpinion({
      opinion: 'How many passes did Bruno complete?',
      datasetId: 'northbridge-eastport-analysis-demo',
      selectedClock: { period: 2, minute: 58 },
      period: 'match-so-far',
      inputLanguage: 'en',
    })
    const candidate = initial.claims[0].playerResolution.candidates[0]
    const payload = {
      action: 'resolve-player',
      continuation: initial.playerResolutionContinuation,
      claimId: initial.claims[0].claim.id,
      playerId: candidate.id,
    }

    const secondInstance = runResolutionInNewProcess(payload, testKey)
    assert.equal(secondInstance.status, 0, secondInstance.stderr)
    assert.deepEqual(JSON.parse(secondInstance.stdout), {
      provider: 'local',
      player: {
        id: candidate.id,
        name: candidate.name,
        team: candidate.team,
      },
    })

    const [body, signature] = initial.playerResolutionContinuation.split('.')
    const alteredGrant = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    alteredGrant.request.selectedClock.minute = 59
    const alteredContext = {
      ...payload,
      continuation: `${Buffer.from(JSON.stringify(alteredGrant)).toString('base64url')}.${signature}`,
    }
    const alteredBodyResult = runResolutionInNewProcess(alteredContext, testKey)
    assert.equal(alteredBodyResult.status, 1)
    assert.match(JSON.parse(alteredBodyResult.stdout).error, /token is invalid/)

    const changedSignature = {
      ...payload,
      continuation: `${body}.${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`,
    }
    const alteredSignatureResult = runResolutionInNewProcess(changedSignature, testKey)
    assert.equal(alteredSignatureResult.status, 1)
    assert.match(JSON.parse(alteredSignatureResult.stdout).error, /token is invalid/)

    const otherInstanceKey = Buffer.alloc(32, 0x33).toString('base64url')
    const differentKeyResult = runResolutionInNewProcess(payload, otherInstanceKey)
    assert.equal(differentKeyResult.status, 1)
    assert.match(JSON.parse(differentKeyResult.stdout).error, /token is invalid/)
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = priorNodeEnv
    if (priorKey === undefined) delete process.env.PLAYER_RESOLUTION_SIGNING_KEY
    else process.env.PLAYER_RESOLUTION_SIGNING_KEY = priorKey
  }
})
