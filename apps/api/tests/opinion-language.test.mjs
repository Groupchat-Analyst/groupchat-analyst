import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { classifyOpinion } from '../dist/shared/src/opinionTopics.js'

const ask = (opinion, minute = 57) =>
  analyzeOpinion({
    opinion,
    selectedClock: { period: 2, minute },
    period: 'match-so-far',
  })

const SAKA = 'Bukayo Saka'

test('the original failure: “Saka has had a horrible game” keeps Saka, the take and the time', async () => {
  const result = await ask('Saka has had a horrible game')
  const claim = result.claims[0].claim
  assert.equal(claim.intent, 'subjective-judgement')
  assert.equal(claim.playerSubject.id, 'north-player-09')
  assert.equal(claim.text, 'Saka has had a horrible game')
  assert.equal(result.claims[0].assessment, 'insufficient evidence for a firm conclusion')
  assert.match(result.fanReply, /Bukayo Saka scored 1 goal, had 2 shots on target, completed 1 of 2 passes/)
  assert.match(result.fanReply, /do not add up to a performance rating/)
  assert.doesNotMatch(result.fanReply, /couldn't match|Which player/)
  assert.match(result.summary, /57′/)
})

test('praise and criticism receive the same evidential standard', async () => {
  const bad = await ask('Saka has had a horrible game')
  const good = await ask('Saka has had a brilliant game')
  const strip = (reply) => reply.replace(/“good” or “bad”/, '')
  assert.equal(strip(bad.fanReply), strip(good.fanReply))
  assert.equal(bad.claims[0].assessment, good.claims[0].assessment)
})

test('negated variants are still evidence-limited, and say so', async () => {
  const result = await ask("Saka hasn't had a horrible game")
  assert.equal(result.claims[0].assessment, 'insufficient evidence for a firm conclusion')
  assert.match(result.fanReply, /Negating a take doesn't change what the records can show/)
})

test('poor passing is not given a verdict without a benchmark, and is not overall performance', async () => {
  const result = await ask("Saka's passing has been poor")
  assert.equal(result.claims[0].assessment, 'insufficient evidence for a firm conclusion')
  assert.deepEqual(result.claims[0].claim.requiredEvidence, ['passing'])
  assert.match(result.fanReply, /completed 1 of 2 recorded passes/)
  assert.match(result.fanReply, /No benchmark or comparison defines “poor” or “tidy” passing/)
  assert.doesNotMatch(result.fanReply, /shots|goal/i)
})

test('overall performance is not reduced to pass completion alone', async () => {
  const result = await ask('Saka has been brilliant')
  assert.ok(result.claims[0].claim.requiredEvidence.includes('shots'))
  assert.ok(result.claims[0].claim.requiredEvidence.includes('passing'))
  assert.match(result.fanReply, /shots on target/)
})

test('possession losses, finishing and attacking output retrieve their own evidence', async () => {
  const losses = await ask('Saka keeps giving it away')
  assert.deepEqual(losses.claims[0].claim.requiredEvidence, ['possession-losses', 'passing'])
  assert.match(losses.fanReply, /lost possession 1 time through recorded incomplete passes/)
  const finishing = await ask('Saka is wasteful in front of goal')
  assert.match(finishing.fanReply, /No chance-quality or expected-goals data/)
  const attack = await ask("Eastport aren't testing the keeper")
  assert.equal(attack.claims[0].claim.subject, 'Eastport')
  assert.match(attack.fanReply, /not chance quality or attacking threat/)
})

test('an explicit possessive statistic is still a statistic, not an opinion', async () => {
  const result = await ask("Saka's pass completion")
  assert.equal(result.claims[0].claim.intent, 'statistical-request')
  assert.equal(result.claims[0].assessment, 'statistics provided')
  assert.match(result.fanReply, /completed 1 of 2 passes \(50%\)/)
})

test('unsupported tactical, physical and predictive wording is limited specifically', async () => {
  const shape = await ask('Northbridge parked the bus')
  assert.match(shape.fanReply, /defensive shape or positioning/)
  const pinned = await ask('Eastport are pinned back')
  assert.match(pinned.fanReply, /field position, territory and pressing intensity are not recorded/)
  const injured = await ask('Saka is injured')
  assert.equal(injured.claims[0].assessment, 'unavailable data')
  assert.match(injured.fanReply, /Fitness, injury and exertion are not recorded/)
  const prediction = await ask('Northbridge will win')
  assert.match(prediction.fanReply, /prediction about what happens next/)
  assert.doesNotMatch(prediction.fanReply, /couldn't match/)
})

test('a pronoun with no known player asks which player, not for one already supplied', async () => {
  const unknown = await ask('He has had a horrible game')
  assert.equal(unknown.claims[0].assessment, 'clarification needed')
  assert.match(unknown.fanReply, /Which player does “he” refer to/)
  const known = await ask('Saka has had a horrible game')
  assert.doesNotMatch(known.fanReply, /Which player/)
})

test('topic classification is by semantic class, not by exact sentence', () => {
  const cases = {
    'overall-performance': ['Saka has been awful today', 'Rice played really well', 'what a nightmare for Saka'],
    involvement: ['Saka has been invisible', 'Saka is barely involved'],
    'passing-quality': ['tidy passing from Rice', 'Saka is struggling to string passes together'],
    'possession-losses': ['Saka is sloppy on the ball', 'Rice keeps giving the ball away'],
    'attacking-output': ['Eastport have no attacking threat', 'Saka is not testing the keeper'],
    finishing: ['Saka missed a sitter', 'poor finishing from Eastport'],
    'defensive-approach': ['Northbridge are sitting deep', 'Eastport stayed behind the ball'],
    'pressure-progression': ['Eastport are pinned back', 'Northbridge cannot get out of their half'],
  }
  for (const [topic, texts] of Object.entries(cases)) {
    for (const text of texts) {
      assert.equal(classifyOpinion(text)?.topic, topic, text)
    }
  }
  assert.equal(classifyOpinion('Eastport had more shots on target'), undefined)
  assert.equal(SAKA, 'Bukayo Saka')
})

test('comparisons and the 57′→58′ walkthrough are unchanged by the language repair', async () => {
  const before = await ask('Eastport had more shots on target than Northbridge.', 57)
  const after = await ask('Eastport had more shots on target than Northbridge.', 58)
  assert.equal(before.claims[0].assessment, 'contradicted')
  assert.equal(after.claims[0].assessment, 'supported')
  assert.equal(before.fanReply, 'No — Eastport and Northbridge are level on 2 shots on target each.')
  assert.equal(after.fanReply, "Yes — Eastport have 3 shots on target to Northbridge's 2.")
})
