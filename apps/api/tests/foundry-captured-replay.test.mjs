import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { FoundryInterpretationProvider } from '../dist/api/src/providers/foundry.js'

// Captured-output replay: structured outputs recorded in the cf10c74 live run,
// replayed through a stubbed transport. This is not live Foundry verification.
const captured = JSON.parse(
  await readFile(new URL('./fixtures/foundry-cf10c74-interpretations.json', import.meta.url), 'utf8'),
)

const request = (opinion, minute) => ({
  opinion,
  selectedClock: { period: 2, minute },
  period: 'match-so-far',
})

function replay(content) {
  return new FoundryInterpretationProvider(
    { baseUrl: 'https://example.invalid/openai/v1', apiKey: 'mock-key', deployment: 'mock' },
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  )
}

test('captured shots outputs replay with the expected figures', async () => {
  const at57 = await analyzeOpinion(request('Eastport had more shots on target.', 57), replay(captured[0]))
  const at58 = await analyzeOpinion(request('Eastport had more shots on target.', 58), replay(captured[1]))
  assert.equal(at57.claims[0].assessment, 'contradicted')
  assert.equal(at58.claims[0].assessment, 'supported')
  assert.match(at57.fanReply, /^No — /)
})

test('captured "parked the bus" reply does not use a possession template', async () => {
  const result = await analyzeOpinion(request('Northbridge parked the bus.', 57), replay(captured[2]))
  assert.equal(result.claims[0].assessment, 'insufficient evidence for a firm conclusion')
  assert.doesNotMatch(result.fanReply, /possession part|backs up|goes against|Possession alone/i)
  assert.match(result.fanReply, /For context only:.*does not support or contradict defensive shape/s)
  assert.match(result.fanReply, /defensive shape/)
  assert.doesNotMatch(JSON.stringify(result.claims[0].limitation), /possession-majority/)
})

test('a defensive-shape claim is not given a possession template regardless of wording', async () => {
  const variant = structuredClone(captured[2])
  variant.claims[0].text = 'Northbridge sat deep and defended in a low block.'
  const result = await analyzeOpinion(request('Northbridge sat deep.', 57), replay(variant))
  assert.doesNotMatch(result.fanReply, /possession part|backs up/i)
  assert.match(result.fanReply, /defensive shape/)
})

test('a genuine possession-dominance judgement keeps its possession wording', async () => {
  const variant = structuredClone(captured[2])
  variant.claims[0].text = 'Northbridge dominated possession.'
  const result = await analyzeOpinion(request('Northbridge dominated possession.', 57), replay(variant))
  assert.match(result.fanReply, /possession part of the take/)
  assert.match(result.fanReply, /Possession alone doesn't settle overall dominance/)
})

test('captured Bruno request returns the explicit clarification without guessing', async () => {
  const result = await analyzeOpinion(request('How many passes did Bruno complete?', 58), replay(captured[3]))
  const claim = result.claims[0]
  assert.equal(claim.assessment, 'clarification needed')
  assert.equal(claim.claim.playerSubject, null)
  assert.match(result.fanReply, /Bruno Fernandes \(Eastport\) or Bruno Guimarães \(Northbridge\)/)
  assert.doesNotMatch(result.fanReply, /\d+ (?:completed )?passes?/i)
})

test('latest captured Bruno interpretation replays unchanged through Foundry validation and service', async () => {
  const latest = JSON.parse(
    await readFile(
      new URL('./fixtures/foundry-2026-10-27-call4-interpretation.json', import.meta.url),
      'utf8',
    ),
  )
  assert.equal(captured[3].claims[0].playerMetric, null)
  assert.equal(latest.claims[0].playerMetric, 'pass-completions')
  assert.equal(captured[3].claims[0].playerSubject, null)
  assert.equal(latest.claims[0].playerSubject, null)
  let outboundRequests = 0
  const provider = new FoundryInterpretationProvider(
    { baseUrl: 'https://example.invalid/openai/v1', apiKey: 'mock-key', deployment: 'mock' },
    async () => {
      outboundRequests += 1
      return new Response(
        JSON.stringify({
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(latest) } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    },
  )
  const result = await analyzeOpinion(request('How many passes did Bruno complete?', 58), provider)
  const claim = result.claims[0]

  assert.equal(outboundRequests, 1)
  assert.equal(result.provider, 'foundry')
  assert.equal(result.evidenceFoundation.dataset.id, 'northbridge-eastport-analysis-demo')
  assert.equal(result.evidenceFoundation.dataset.version, '3.0.0')
  assert.equal(result.selectedTime, '58′')
  assert.equal(result.selectedPeriodLabel, 'Match so far through 58′')
  assert.equal(claim.claim.text, latest.claims[0].text)
  assert.equal(claim.claim.intent, 'statistical-request')
  assert.equal(claim.claim.playerMetric, 'pass-completions')
  assert.equal(claim.claim.subject, null)
  assert.equal(claim.claim.playerSubject, null)
  assert.equal(claim.assessment, 'clarification needed')
  assert.deepEqual(claim.statistics, [])
  assert.deepEqual(claim.playerStatistics, [])
  assert.deepEqual(claim.calculations, [])
  assert.deepEqual(claim.evidence, [])
  assert.match(result.fanReply, /Which Bruno do you mean: Bruno Fernandes \(Eastport\) or Bruno Guimarães \(Northbridge\)\?/)
  assert.doesNotMatch(result.fanReply, /\d+ (?:completed )?passes?/i)
})

test('unresolved statistical entity without clarification is still rejected', async () => {
  const variant = JSON.parse(
    await readFile(
      new URL('./fixtures/foundry-2026-10-27-call4-interpretation.json', import.meta.url),
      'utf8',
    ),
  )
  variant.claims[0].clarificationNeeds = []
  await assert.rejects(
    analyzeOpinion(request('How many passes did Bruno complete?', 58), replay(variant)),
    /needs clarification|intent does not match its evidence request/,
  )
})

test('a known requested player metric is not a guessed identity and must match its evidence', async () => {
  const knownMetric = structuredClone(captured[3])
  knownMetric.claims[0].playerMetric = 'pass-completions'
  const result = await analyzeOpinion(
    request('How many passes did Bruno complete?', 58),
    replay(knownMetric),
  )
  assert.equal(result.claims[0].claim.playerMetric, 'pass-completions')
  assert.equal(result.claims[0].claim.playerSubject, null)
  assert.deepEqual(result.claims[0].playerStatistics, [])

  const mismatched = structuredClone(captured[3])
  mismatched.claims[0].playerMetric = 'pass-completions'
  mismatched.claims[0].requiredEvidence = ['possession']
  await assert.rejects(
    analyzeOpinion(request('How many passes did Bruno complete?', 58), replay(mismatched)),
    /intent does not match its evidence request/,
  )
})

test('clarification rejects contradictory identity and incompatible claim shape', async () => {
  const contradictoryIdentity = structuredClone(captured[3])
  contradictoryIdentity.claims[0].playerSubject = {
    id: 'east-player-08',
    name: 'Bruno Fernandes',
    team: 'Eastport',
  }
  contradictoryIdentity.claims[0].playerMetric = 'pass-completions'
  await assert.rejects(
    analyzeOpinion(request('How many passes did Bruno complete?', 58), replay(contradictoryIdentity)),
  )

  const incompatibleIntent = structuredClone(captured[3])
  incompatibleIntent.claims[0].intent = 'factual-claim'
  incompatibleIntent.claims[0].playerMetric = 'pass-completions'
  await assert.rejects(
    analyzeOpinion(request('How many passes did Bruno complete?', 58), replay(incompatibleIntent)),
  )
})

test('explicitly named Bruno receives only his own completed-pass evidence', async () => {
  const explicitlyNamed = structuredClone(captured[3])
  explicitlyNamed.claims[0].subject = 'Eastport'
  explicitlyNamed.claims[0].playerSubject = {
    id: 'east-player-08',
    name: 'Bruno Fernandes',
    team: 'Eastport',
  }
  explicitlyNamed.claims[0].clarificationNeeds = []
  const result = await analyzeOpinion(
    request('How many passes did Bruno Fernandes complete?', 58),
    replay(explicitlyNamed),
  )
  const claim = result.claims[0]
  assert.equal(claim.assessment, 'statistics provided')
  assert.equal(claim.claim.playerSubject.id, 'east-player-08')
  assert.ok(claim.playerStatistics.length > 0)
  assert.ok(claim.playerStatistics.every(({ playerId }) => playerId === 'east-player-08'))
})

test('call-3 interpretation from the 90b7e97 run quotes the user wording, not the model paraphrase', async () => {
  const saved = JSON.parse(
    await readFile(new URL('./fixtures/foundry-90b7e97-call3-interpretation.json', import.meta.url), 'utf8'),
  )
  assert.match(saved.claims[0].text, /extremely defensive, low-block/)
  const result = await analyzeOpinion(request('Northbridge parked the bus.', 57), replay(saved))
  assert.match(result.fanReply, /“Northbridge parked the bus”/)
  assert.doesNotMatch(result.fanReply, /extremely defensive|low-block/)
  assert.match(result.fanReply, /defensive shape/)
  assert.equal(result.claims[0].claim.text, saved.claims[0].text)
})
