import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { createAnalyzeHandler } from '../dist/api/src/functions/analyze.js'
import { FoundryInterpretationProvider } from '../dist/api/src/providers/foundry.js'

// Constructed offline regression cases, not captured live model responses.
const request = (opinion) => ({
  opinion,
  selectedClock: { period: 2, minute: 90, stoppageMinutes: 4 },
  period: 'match-so-far',
})

async function sourceClaim(opinion) {
  const result = await analyzeOpinion(request(opinion))
  return structuredClone(result.claims[0].claim)
}

async function withClaims(opinion, claims) {
  return createAnalyzeHandler({
    name: 'foundry',
    async interpret() { return { claims } },
  })({ async json() { return request(opinion) } }, { error() {} })
}

function assertRejected(response, message) {
  assert.equal(response.status, 502)
  assert.equal(response.jsonBody.failureType, 'semantic-validation')
  assert.match(response.jsonBody.error, message)
  assert.equal(response.jsonBody.summary, undefined)
  assert.equal(response.jsonBody.claims, undefined)
}

for (const keepAnchor of [true, false]) {
  test(`rejects a historical circumstance without an exclusive cutoff (anchor ${keepAnchor ? 'present' : 'absent'})`, async () => {
    const claim = await sourceClaim('Northbridge scored against the run of play.')
    claim.timePeriod = { kind: 'selected' }
    if (!keepAnchor) claim.historicalEventAnchor = null
    assertRejected(
      await withClaims(claim.text, [claim]),
      /exclusive before-event period/,
    )
  })
}

test('a missing cutoff cannot bypass the scorer check through neutral wording', async () => {
  const claim = await sourceClaim('Saka scored against the run of play.')
  claim.playerSubject = {
    id: 'north-player-06', name: 'Declan Rice', team: 'Northbridge',
  }
  claim.timePeriod = { kind: 'selected' }
  claim.text = 'Assess this historical scoring circumstance.'
  assertRejected(
    await withClaims(claim.text, [claim]),
    /historical anchor must use its exclusive before-event period/,
  )
})

for (const intent of ['subjective-judgement', 'coaching-question', 'unrecognized-language']) {
  test(`rejects a precise comparison with incompatible intent ${intent}`, async () => {
    const claim = await sourceClaim('Eastport had more shots on target than Northbridge.')
    claim.intent = intent
    assertRejected(
      await withClaims(claim.text, [claim]),
      /comparison is incompatible with its declared intent/,
    )
  })
}

for (const [metric, kind] of [
  ['recoveries', 'player-events'],
  ['pressure-observations', 'player-events'],
  ['minutes-played', 'lineups'],
]) {
  test(`rejects a team ${metric} comparison without a defined team calculator`, async () => {
    const claim = await sourceClaim('Eastport had more shots on target than Northbridge.')
    claim.meaning.comparison.metric = metric
    claim.requiredEvidence = [kind]
    claim.text = `Eastport had more ${metric} than Northbridge.`
    claim.meaning.description = claim.text
    assertRejected(
      await withClaims(claim.text, [claim]),
      /supported team comparison calculator/,
    )
  })
}

test('does not treat team possession percentage as a player statistic', async () => {
  const claim = await sourceClaim('How many shots did Saka have?')
  claim.playerMetric = 'possession-percentage'
  claim.requiredEvidence = ['possession', 'player-events']
  assertRejected(
    await withClaims('What was Saka\'s possession percentage?', [claim]),
    /possession percentage is defined for teams/,
  )
})

test('rejects an empty model interpretation for a non-empty question', async () => {
  assertRejected(
    await withClaims('How many goals did Saka score?', []),
    /at least one claim or clarification/,
  )
})

test('keeps the empty initial request available without making a model request', async () => {
  let calls = 0
  const result = await analyzeOpinion(request('   '), {
    name: 'foundry',
    async interpret() { calls += 1; throw new Error('Must not call provider') },
  })
  assert.equal(calls, 0)
  assert.deepEqual(result.claims, [])
  assert.equal(result.score.Northbridge, 1)
  assert.equal(result.score.Eastport, 2)
})

test('rejects duplicate IDs instead of returning ambiguous claim references', async () => {
  const one = await sourceClaim('Northbridge had more shots on target than Eastport.')
  const two = await sourceClaim('Northbridge scored against the run of play.')
  two.id = one.id
  assertRejected(
    await withClaims(`${one.text}. ${two.text}.`, [one, two]),
    /ID must be unique/,
  )
})

test('a valid negated player comparison retains its operator and player-attributed values', async () => {
  const claim = await sourceClaim('Saka did not have a higher pass completion rate than Amad.')
  const response = await withClaims(claim.text, [claim])
  assert.equal(response.status, 200)
  assert.equal(response.jsonBody.claims[0].assessment, 'supported')
  assert.equal(response.jsonBody.claims[0].claim.meaning.comparison.operator, 'less-or-equal')
  assert.deepEqual(
    response.jsonBody.claims[0].playerStatistics
      .filter(({ metric }) => metric === 'pass-completion-percentage')
      .map(({ playerName, value }) => [playerName, value]),
    [['Bukayo Saka', 50], ['Amad', 66.7]],
  )
})

function providerWithFetch(fetchImplementation) {
  return new FoundryInterpretationProvider({
    baseUrl: 'https://example.invalid/openai/v1',
    apiKey: 'mock-key',
    deployment: 'mock-deployment',
  }, fetchImplementation)
}

for (const [finishReason, category] of [
  ['content_filter', 'refusal'],
  ['tool_calls', 'incomplete-output'],
  [undefined, 'incomplete-output'],
]) {
  test(`rejects ${String(finishReason)} completion even if content is valid JSON`, async () => {
    const claim = await sourceClaim('How many shots did Saka have?')
    const provider = providerWithFetch(async () => new Response(JSON.stringify({
      choices: [{
        ...(finishReason === undefined ? {} : { finish_reason: finishReason }),
        message: { content: JSON.stringify({ claims: [claim] }) },
      }],
    }), { status: 200 }))
    await assert.rejects(
      analyzeOpinion(request(claim.text), provider),
      (error) => error.category === category,
    )
  })
}

for (const errorName of ['TimeoutError', 'AbortError']) {
  test(`classifies body-read ${errorName} as transport instead of schema failure`, async () => {
    let calls = 0
    const provider = providerWithFetch(async () => {
      calls += 1
      return {
        ok: true,
        async json() { throw new DOMException('Body transfer interrupted', errorName) },
      }
    })
    await assert.rejects(
      analyzeOpinion(request('How many goals did Saka score?'), provider),
      (error) => {
        assert.equal(error.category, 'transport')
        assert.match(error.message, errorName === 'TimeoutError' ? /timed out/ : /interrupted/)
        return true
      },
    )
    assert.equal(calls, 1)
  })
}
