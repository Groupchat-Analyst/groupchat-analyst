import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

const request = (opinion, minute = 57, stoppageMinutes) => ({
  opinion,
  selectedClock: { period: 2, minute, ...(stoppageMinutes ? { stoppageMinutes } : {}) },
  period: 'match-so-far',
})

// Offline stand-in for the Foundry path: returns a validated interpretation without any network call.
const stubProvider = (claims) => ({
  name: 'foundry',
  async interpret() {
    return { claims: structuredClone(claims) }
  },
})

const claim = (overrides) => ({
  id: 'claim-1',
  subject: 'Eastport',
  playerSubject: null,
  playerMetric: null,
  text: 'Eastport had more shots on target.',
  intent: 'factual-claim',
  meaning: {
    category: 'factual-comparison',
    description: 'Compare shots on target.',
    comparison: {
      opponent: 'Northbridge',
      opponentPlayer: null,
      metric: 'shots-on-target',
      operator: 'greater-than',
    },
  },
  requiredEvidence: ['shots-on-target'],
  timePeriod: { kind: 'selected' },
  historicalEventAnchor: null,
  clarificationNeeds: [],
  ...overrides,
})

const BANNED = /the assertion|statistics provided|selected synthetic fixture|supported\/contradicted|truth verdict|this synthetic fixture/i

test('direct comparisons answer first, then give the decisive figures, without the scope trailer', async () => {
  const before = await analyzeOpinion(request('Eastport had more shots on target.', 57), stubProvider([claim()]))
  const after = await analyzeOpinion(request('Eastport had more shots on target.', 58), stubProvider([claim()]))

  assert.equal(before.fanReply, "No — Eastport and Northbridge are level on 2 shots on target each.")
  assert.equal(after.fanReply, "Yes — Eastport have 3 shots on target to Northbridge's 2.")
  assert.equal(before.claims[0].assessment, 'contradicted')
  assert.equal(after.claims[0].assessment, 'supported')
  for (const result of [before, after]) {
    assert.doesNotMatch(result.fanReply, BANNED)
    assert.doesNotMatch(result.fanReply, /Selected period|fictional match/)
    assert.doesNotMatch(result.fanReply, /event-\d+|north-player|east-player/)
  }
})

test('the legacy technical summary is preserved alongside the conversational reply', async () => {
  const result = await analyzeOpinion(request('Eastport had more shots on target than Northbridge.', 58))
  assert.match(result.summary, /^Yes — Eastport recorded 3 shots on target, compared with Northbridge's 2 shots on target\./)
  assert.match(result.summary, /Selected period: Match so far through 58′/)
  assert.equal(result.fanReply, "Yes — Eastport have 3 shots on target to Northbridge's 2.")
})

test('a half-time goal reads naturally and keeps its first-half basis', async () => {
  const result = await analyzeOpinion(request('Northbridge scored before half-time.', 57))
  assert.equal(
    result.fanReply,
    "Yes — Northbridge scored before half-time, at 45+3′. That's judged on first-half goals, whichever window is selected.",
  )
  const denial = await analyzeOpinion(request('Northbridge did not score before half-time.', 57))
  assert.match(denial.fanReply, /^No — Northbridge did score before half-time, at 45\+3′\./)
})

test('clarification asks one short question', async () => {
  const result = await analyzeOpinion(request('it was a good game'))
  assert.equal(result.claims[0].assessment, 'clarification needed')
  assert.equal(result.fanReply, 'Which team is this claim about?')
})

test('unavailable data is stated plainly without substituting figures', async () => {
  const result = await analyzeOpinion(request('Eastport ran further than Northbridge.'))
  assert.match(result.fanReply, /^I can't tell you that one\. Running distance/)
  assert.doesNotMatch(result.fanReply, /shots|passes|possession|km|miles/i)
  assert.doesNotMatch(result.fanReply, BANNED)
})

test('a defensive-approach take is recognised and limited honestly, not refused or backed by unrelated figures', async () => {
  const result = await analyzeOpinion(request('Northbridge parked the bus.'))
  assert.equal(result.claims[0].claim.intent, 'subjective-judgement')
  assert.equal(result.claims[0].assessment, 'insufficient evidence for a firm conclusion')
  assert.match(result.fanReply, /defensive shape or positioning/)
  assert.doesNotMatch(result.fanReply, /couldn't match|\d+%|shots|passes/i)
})

test('genuinely unrecognised wording is not silently reinterpreted', async () => {
  const result = await analyzeOpinion(request('Northbridge zibbled the quux.'))
  assert.equal(result.claims[0].assessment, 'unrecognized language')
  assert.match(result.fanReply, /couldn't match that/)
  assert.doesNotMatch(result.fanReply, /possession|shots|passes/i)
})

test('qualified opinions separate the statistical fact from the broader judgement', async () => {
  const result = await analyzeOpinion(
    request(
      'Eastport dominated possession during this game and Northbridge scored against the run of play. It was a comfortable match for Eastport.',
      90,
      4,
    ),
  )
  assert.match(result.fanReply, /^Eastport had 44% of recorded possession to Northbridge's 56%\./)
  assert.match(result.fanReply, /Possession alone doesn't settle overall dominance\./)
  assert.match(result.fanReply, /The records can't settle whether Northbridge scored against the run of play\./)
  assert.match(result.fanReply, /bigger football opinion than the match events can settle/)
  assert.doesNotMatch(result.fanReply, BANNED)
})

test('possession comparisons keep their definition caveat in plain language', async () => {
  const result = await analyzeOpinion(request('Eastport had more possession than Northbridge.'))
  assert.match(result.fanReply, /^No — Eastport had 44\.6% of recorded possession to Northbridge's 55\.4%\./)
  assert.match(result.fanReply, /only counts recorded controlled time/)
})
