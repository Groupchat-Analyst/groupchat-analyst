import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

const request = (opinion, datasetId = 'northbridge-eastport-analysis-demo') => ({
  opinion,
  selectedClock: { period: 2, minute: 58 },
  period: 'match-so-far',
  datasetId,
  inputLanguage: 'ar',
})

test('Arabic shared-name aliases preserve Bruno and Martin ambiguity', async () => {
  const cases = [
    {
      opinion: 'كم تمريرة أكمل برونو؟',
      datasetId: 'northbridge-eastport-analysis-demo',
      expected: ['north-player-18', 'east-player-08'],
    },
    {
      opinion: 'How many passes did مارتن complete?',
      datasetId: 'northbridge-eastport-return-demo',
      expected: ['north-player-07', 'north-player-08'],
    },
    {
      opinion: 'كم تمريرة أكمل بيدرو؟',
      datasetId: 'westhaven-kingswell-demo',
      expected: ['north-player-09', 'north-player-11'],
    },
  ]

  for (const { opinion, datasetId, expected } of cases) {
    const result = await analyzeOpinion(request(opinion, datasetId))
    assert.equal(result.claims[0].assessment, 'clarification needed')
    assert.deepEqual(
      result.claims[0].playerResolution.candidates.map(({ id }) => id).sort(),
      expected.sort(),
    )
    assert.equal(result.claims[0].claim.playerMetric, 'pass-completions')
    assert.deepEqual(result.claims[0].playerStatistics, [])
  }
})

test('full Arabic player names resolve directly and selected explanations identify the player', async () => {
  for (const [opinion, datasetId, id, expectedName] of [
    ['كم تمريرة أكمل برونو فيرنانديز؟', 'northbridge-eastport-return-demo', 'east-player-08', 'Bruno Fernandes'],
    ['كم تمريرة أكمل برونو غيماريش؟', 'northbridge-eastport-return-demo', 'north-player-18', 'Bruno Guimarães'],
    ['How many passes did مارتين زوبيميندي complete?', 'northbridge-eastport-return-demo', 'north-player-07', 'Martín Zubimendi'],
    ['How many passes did مارتن أوديغارد complete?', 'northbridge-eastport-return-demo', 'north-player-08', 'Martin Ødegaard'],
    ['كم تمريرة أكمل جواو بيدرو؟', 'westhaven-kingswell-demo', 'north-player-11', 'Joao Pedro'],
    ['كم تمريرة أكمل بيدرو نيتو؟', 'westhaven-kingswell-demo', 'north-player-09', 'Pedro Neto'],
  ]) {
    const result = await analyzeOpinion(request(opinion, datasetId))
    assert.equal(result.claims[0].claim.playerSubject.id, id)
    assert.equal(result.claims[0].claim.playerSubject.name, expectedName)
    assert.equal(result.claims[0].playerResolution, undefined)
    assert.match(result.claims[0].claim.meaning.description, new RegExp(expectedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.doesNotMatch(result.claims[0].claim.meaning.description, /undefined/u)
  }
})

test('an ambiguous Arabic Bruno continuation updates the explanation without another interpreter call', async () => {
  let calls = 0
  const provider = {
    name: 'local',
    async interpret(opinion, context) {
      calls += 1
      const { LocalInterpretationProvider } = await import('../dist/api/src/providers/local.js')
      return new LocalInterpretationProvider().interpret(opinion, context)
    },
  }
  const initial = await analyzeOpinion(request('كم تمريرة أكمل برونو؟'), provider)
  const option = initial.claims[0].playerResolution.candidates.find(
    ({ id }) => id === 'east-player-08',
  )
  const resolved = await analyzeOpinion({
    action: 'resolve-player',
    continuation: initial.claims[0].playerResolution.continuation,
    claimId: initial.claims[0].claim.id,
    playerId: option.id,
  })

  assert.equal(calls, 1)
  assert.equal(resolved.claims[0].claim.playerSubject.name, 'Bruno Fernandes')
  assert.match(resolved.claims[0].claim.meaning.description, /Bruno Fernandes/u)
  assert.match(resolved.claims[0].claim.meaning.description, /pass completions/u)
  assert.doesNotMatch(resolved.claims[0].claim.meaning.description, /undefined/u)
})

test('Arabic fixture-team aliases resolve while canonical fixture identities stay unchanged', async () => {
  const result = await analyzeOpinion(
    request('وستهافن had more shots than كينغزويل سيتي.', 'westhaven-kingswell-demo'),
  )
  assert.equal(result.evidenceFoundation.dataset.id, 'westhaven-kingswell-demo')
  assert.equal(result.claims[0].claim.subject, 'Westhaven FC')
  assert.equal(result.claims[0].claim.meaning.comparison.opponent, 'Kingswell City')
})

test('natural Arabic supported claims preserve their metric, negation, zero, and player attribution', async () => {
  const shots = await analyzeOpinion(
    request('سجل إيستبورت تسديدات أكثر على المرمى من نورثبريدج.'),
  )
  assert.equal(shots.claims[0].assessment, 'supported')
  assert.equal(shots.claims[0].claim.meaning.comparison.metric, 'shots-on-target')
  assert.equal(shots.claims[0].claim.subject, 'Eastport')
  assert.equal(shots.claims[0].claim.meaning.comparison.opponent, 'Northbridge')

  const negated = await analyzeOpinion(
    request('لم يسجل إيستبورت تسديدات على المرمى أكثر من نورثبريدج.'),
  )
  assert.equal(negated.claims[0].assessment, 'contradicted')
  assert.equal(negated.claims[0].claim.meaning.comparison.metric, 'shots-on-target')

  const zero = await analyzeOpinion(
    request('لم يسجل كينغزويل سيتي أي تسديدة على المرمى.', 'westhaven-kingswell-demo'),
  )
  assert.equal(zero.claims[0].assessment, 'supported')
  assert.equal(zero.claims[0].claim.subject, 'Kingswell City')
  assert.ok(zero.claims[0].claim.requiredEvidence.includes('shots-on-target'))

  const playerJudgement = await analyzeOpinion(
    request('قدم ساكا مباراة سيئة للغاية.', 'northbridge-eastport-return-demo'),
  )
  assert.equal(playerJudgement.claims[0].assessment, 'insufficient evidence for a firm conclusion')
  assert.equal(playerJudgement.claims[0].claim.playerSubject.name, 'Bukayo Saka')
  assert.doesNotMatch(playerJudgement.claims[0].claim.meaning.description, /undefined/u)
})
