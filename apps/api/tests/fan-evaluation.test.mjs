import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createAnalyzeHandler } from '../dist/api/src/functions/analyze.js'
import { LocalInterpretationProvider } from '../dist/api/src/providers/local.js'
import { FoundryInterpretationProvider } from '../dist/api/src/providers/foundry.js'
import { eventsAfterAnchor, eventsBeforeAnchor } from '../dist/shared/src/match.js'

const fixture = 'arsenal-leicester-wyscout-2499719'
const arsenalRows = JSON.parse(readFileSync(new URL('../../shared/src/data/arsenal-leicester-2499719.json', import.meta.url), 'utf8'))
const watfordRows = JSON.parse(readFileSync(new URL('../../shared/src/data/chelsea-watford-2499799.json', import.meta.url), 'utf8'))
const winner = arsenalRows.find(({ id }) => id === 177960902)
const preShots = arsenalRows.filter((row) => row.eventName === 'Shot' && row.matchPeriod === '2H' &&
  row.eventSec >= winner.eventSec - 600 && row.eventSec < winner.eventSec)
const rollingShots = arsenalRows.filter((row) => row.eventName === 'Shot' && row.matchPeriod === '2H' &&
  row.eventSec >= 1860 && row.eventSec <= 2460)
const counts = (rows) => [1609, 1631].map((teamId) => rows.filter((row) => row.teamId === teamId).length)
const sortedIds = (rows) => rows.map(({ id }) => String(id)).sort()
const local = createAnalyzeHandler(new LocalInterpretationProvider(), { FOUNDRY_PUBLIC_ENABLED: 'false' })
const context = { invocationId: 'offline-fan-evaluation', error: () => {} }
const request = (opinion, options = {}) => ({
  headers: { get: () => null },
  json: async () => ({
    opinion, datasetId: fixture, selectedClock: { period: 2, minute: 86 },
    period: 'match-so-far', inputLanguage: 'en', ...options,
  }),
})

test('source ledger freezes both Arsenal windows before route evaluation', () => {
  assert.equal(winner.eventSec.toFixed(6), '2374.620655')
  assert.deepEqual(counts(preShots), [5, 0])
  assert.deepEqual(sortedIds(preShots), ['177960786', '177960827', '177960831', '177960849', '177960899'])
  assert.deepEqual(counts(rollingShots), [6, 0])
  assert.deepEqual(sortedIds(rollingShots), [...sortedIds(preShots), '177960902'])
  const sequence = [177960899, 177960861, 177960900, 177960902].map((id) => arsenalRows.find((row) => row.id === id))
  assert.deepEqual(sequence.map(({ eventName }) => eventName), ['Shot', 'Save attempt', 'Free Kick', 'Shot'])
  assert.ok(sequence.every((row, i) => i === 0 || sequence[i - 1].eventSec < row.eventSec))
})

test('local route: counts, comparisons, aliases, false premises and compound claims', async (t) => {
  const cases = [
    { question: 'How many shots did Arsenal have?', period: 'last-10-minutes', assessment: 'statistics provided', expected: [['Arsenal', 6]] },
    { question: 'How many shots did Leicester City have?', period: 'last-10-minutes', assessment: 'statistics provided', expected: [['Leicester City', 0]] },
    { question: 'Who had more shots?', period: 'last-10-minutes', assessment: 'statistics provided', expected: [['Arsenal', 6], ['Leicester City', 0]] },
    { question: 'How many shots did Leicester have in the ten minutes before Giroud scored?', assessment: 'statistics provided', expected: [['Leicester City', 0]], anchor: true },
    { question: 'How many shots did Leicester City have in the ten minutes before Olivier Giroud scored?', assessment: 'statistics provided', expected: [['Leicester City', 0]], anchor: true },
    { question: 'How many shots did Arsenal have in the ten minutes before Giroud scored?', assessment: 'statistics provided', expected: [['Arsenal', 5]], anchor: true },
    { question: 'Who had more shots in the ten minutes before Giroud scored?', assessment: 'statistics provided', expected: [['Arsenal', 5], ['Leicester City', 0]], anchor: true },
    { question: 'Leicester had no shots.', period: 'last-10-minutes', assessment: 'supported', expected: [['Leicester City', 0]] },
    { question: 'Arsenal had no shots.', period: 'last-10-minutes', assessment: 'contradicted', expected: [['Arsenal', 6]] },
  ]
  for (const item of cases) await t.test(item.question, async () => {
    const response = await local(request(item.question, { period: item.period ?? 'match-so-far' }), context)
    assert.equal(response.status, 200, 'route status')
    const result = response.jsonBody.claims[0]
    assert.equal(result.assessment, item.assessment, 'assessment')
    assert.deepEqual(result.statistics.map(({ team, value }) => [team, value]), item.expected, 'calculated counts')
    if (item.anchor) {
      assert.equal(result.claim.playerSubject, null, 'scorer is not player subject')
      assert.deepEqual(result.claim.timePeriod, { kind: 'before-event', eventId: '177960902', lookbackSeconds: 600 }, 'scope')
    }
  })
  const compound = await local(request('Arsenal had more shots and Leicester had no shots.', { period: 'last-10-minutes' }), context)
  assert.deepEqual(compound.jsonBody.claims.map(({ assessment }) => assessment), ['supported', 'supported'])
  assert.deepEqual(compound.jsonBody.claims[1].statistics.map(({ team, value }) => [team, value]), [['Leicester City', 0]])
  const opposingCompound = await local(request('Arsenal had no shots and Leicester had no shots.', { period: 'last-10-minutes' }), context)
  assert.deepEqual(opposingCompound.jsonBody.claims.map(({ assessment }) => assessment), ['contradicted', 'supported'])
})

test('local route: player records, ambiguity and future anchors', async () => {
  const player = await local(request('How many shots did Bukayo Saka have?', {
    datasetId: 'northbridge-eastport-analysis-demo', selectedClock: { period: 2, minute: 58 },
  }), context)
  const result = player.jsonBody.claims[0]
  assert.equal(result.claim.playerSubject.id, 'north-player-09')
  assert.equal(result.assessment, 'statistics provided')
  assert.ok(result.playerStatistics.every(({ playerId }) => playerId === 'north-player-09'))
  assert.equal(result.playerStatistics.find(({ metric }) => metric === 'shots').value, 2)
  assert.deepEqual(result.statistics, [])
  const shortName = await local(request('How many shots did Saka have?', {
    datasetId: 'northbridge-eastport-analysis-demo', selectedClock: { period: 2, minute: 58 },
  }), context)
  assert.equal(shortName.jsonBody.claims[0].claim.playerSubject.id, 'north-player-09')
  assert.equal(shortName.jsonBody.claims[0].playerStatistics.find(({ metric }) => metric === 'shots').value, 2)
  const ambiguous = await local(request('How many passes did Bruno complete?', {
    datasetId: 'northbridge-eastport-analysis-demo', selectedClock: { period: 2, minute: 58 },
  }), context)
  assert.equal(ambiguous.jsonBody.claims[0].assessment, 'clarification needed')
  assert.match(ambiguous.jsonBody.claims[0].claim.clarificationNeeds.join(' '), /Bruno Fernandes/)
  assert.match(ambiguous.jsonBody.claims[0].claim.clarificationNeeds.join(' '), /Bruno Guimarães/)
  const future = await local(request('Who had more shots in the ten minutes before Giroud scored?', {
    selectedClock: { period: 2, minute: 80 },
  }), context)
  assert.equal(future.jsonBody.claims[0].assessment, 'clarification needed')
  assert.doesNotMatch(JSON.stringify(future.jsonBody), /177960902|39:34|winner|winning goal/i)
  const unclear = await local(request('Were they in control before the goal?'), context)
  assert.equal(unclear.jsonBody.claims[0].assessment, 'clarification needed')
  assert.match(unclear.jsonBody.claims[0].claim.clarificationNeeds.join(' '), /Which team/)
  assert.match(unclear.jsonBody.claims[0].claim.clarificationNeeds.join(' '), /Which goal/)
})

test('local coverage gaps are explicit and never substitute unrelated evidence', async () => {
  for (const opinion of [
    'Did Leicester have a shot?',
    'Arsenal had 0 shots in the ten minutes before Giroud scored.',
    'Arsenal had more shots than Leicester in the ten minutes before Giroud scored.',
  ]) {
    const response = await local(request(opinion, { period: 'last-10-minutes' }), context)
    assert.equal(response.status, 200)
    const claim = response.jsonBody.claims[0]
    assert.equal(claim.assessment, 'unrecognized language', opinion)
    assert.deepEqual(claim.statistics, [], opinion)
    assert.deepEqual(claim.evidence, [], opinion)
  }
  const possession = await local(request('What was Arsenal possession?'), context)
  const claim = possession.jsonBody.claims[0]
  assert.notEqual(claim.assessment, 'statistics provided')
  assert.match(claim.limitation, /possession.*unavailable/i)
  assert.ok(!claim.statistics.some(({ metric }) => metric === 'possession-percentage' || metric === 'shots'))
})

test('exact boundaries include the start and exclude an anchor at equal precision', () => {
  const anchor = { id: 'goal', clock: { period: 2, minute: 85 }, sourcePeriodSeconds: winner.eventSec, team: 'Northbridge', type: 'shot', outcome: 'goal', description: 'goal' }
  const event = (id, seconds) => ({ ...anchor, id, sourcePeriodSeconds: seconds, outcome: 'unclassified' })
  const start = winner.eventSec - 600
  assert.deepEqual(eventsBeforeAnchor([
    event('before', start - 0.000001), event('start', start), event('inside', winner.eventSec - 0.000001),
    anchor, event('same-time', winner.eventSec), event('later', winner.eventSec + 0.000001),
  ], anchor, 600).map(({ id }) => id), ['start', 'inside'])
  const end = winner.eventSec + 600
  assert.deepEqual(eventsAfterAnchor([
    event('before', winner.eventSec - 0.000001), anchor, event('same-time', winner.eventSec),
    event('after', winner.eventSec + 0.000001), event('end', end), event('later', end + 0.000001),
  ], anchor, 48 * 60 + end).map(({ id }) => id), ['after', 'end'])
})

test('Watford source: identify the equaliser among the same scorer’s two goals', () => {
  const goals = watfordRows.filter((row) => row.eventName === 'Shot' && row.tags.some(({ id }) => id === 101))
  const scored = goals.filter(({ playerId }) => playerId === 38093)
  assert.deepEqual(scored.map(({ id }) => id), [198369306, 198369664])
  const equaliser = scored[0]
  assert.deepEqual(goals.filter((row) => row.matchPeriod === '1H' || (row.matchPeriod === '2H' && row.eventSec < equaliser.eventSec)).map(({ teamId }) => teamId), [1610, 1644, 1644])
  const window = watfordRows.filter((row) => row.matchPeriod === '2H' && row.eventSec >= equaliser.eventSec - 600 && row.eventSec < equaliser.eventSec)
  const shots = window.filter(({ eventName }) => eventName === 'Shot')
  assert.deepEqual(shots.map(({ id }) => id), [198369169, 198369222])
  assert.ok(shots.every((row) => row.teamId === 1644 && row.tags.some(({ id }) => id === 2101) && row.tags.some(({ id }) => id === 1802)))
  assert.deepEqual(window.filter(({ subEventName }) => subEventName === 'Corner').map(({ id }) => id), [198369163, 198369166, 198369226])
})

function anchoredClaim(subject = 'Northbridge') {
  return {
    id: 'claim-1', subject, playerSubject: null, playerMetric: null,
    text: 'Control during the spell', intent: 'subjective-judgement',
    meaning: { category: 'performance-judgement', description: 'Control of the attack', comparison: null },
    requiredEvidence: ['shots', 'possession'], timePeriod: { kind: 'before-event', eventId: '177960902', lookbackSeconds: 600 },
    historicalEventAnchor: { eventId: '177960902', relationship: 'scored' }, clarificationNeeds: [],
  }
}

function mockRoute(claims, reply) {
  const calls = []
  let reservations = 0
  const provider = new FoundryInterpretationProvider(
    { baseUrl: 'https://example.invalid/openai/v1', apiKey: 'offline-only', deployment: 'stub' },
    async (_url, init) => {
      calls.push(JSON.parse(init.body))
      if (calls.length > 1 && reply instanceof Error) throw reply
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(calls.length === 1 ? { claims } : reply) } }] }), { status: 200 })
    },
  )
  const handler = createAnalyzeHandler(new LocalInterpretationProvider(), { FOUNDRY_PUBLIC_ENABLED: 'true' },
    () => ({ reserve: async () => { reservations++ } }), () => provider)
  return { handler, calls, reservations: () => reservations }
}

test('opposing takes reach generation with the same evidence and limitations', async (t) => {
  const ids = [...sortedIds(preShots), '177960861', '177960900']
  for (const item of [
    { subject: 'Northbridge', opinion: 'Arsenal were piling on the pressure in the ten minutes before Giroud scored.' },
    { subject: 'Eastport', opinion: 'Leicester had Arsenal under control in the ten minutes before Giroud scored.' },
  ]) await t.test(item.opinion, async () => {
    const reply = { text: 'Arsenal were still creating. [[SHOT_COUNTS]], and [[GOAL_177960849]]. [[SHOT_SAVE_CORNER]] after that suggests the attack remained a threat.', eventIds: ids }
    const h = mockRoute([anchoredClaim(item.subject)], reply)
    const response = await h.handler(request(item.opinion), context)
    assert.equal(response.status, 200)
    assert.equal(h.reservations(), 2)
    assert.equal(response.jsonBody.claims[0].assessment, 'insufficient evidence for a firm conclusion')
    const facts = JSON.parse(h.calls[1].messages[1].content)
    assert.deepEqual([facts.shotCounts.Arsenal, facts.shotCounts['Leicester City']], counts(preShots))
    assert.deepEqual(facts.shots.map(({ id }) => id).sort(), sortedIds(preShots))
    assert.ok(!facts.shots.some(({ id }) => id === String(winner.id)))
    assert.match(facts.verifiedPhrases.find(({ token }) => token === '[[GOAL_177960849]]').text, /3–3/)
    assert.deepEqual(facts.sequence.map(({ id }) => id), ['177960899', '177960861', '177960900', '177960902'])
    assert.match(facts.limitations.join(' '), /possession intervals, passing, pressure observations/)
    assert.match(response.jsonBody.punditReply.text, /still creating/)
    assert.match(response.jsonBody.punditReply.text, /remained a threat/)
    assert.match(response.jsonBody.punditReply.checked.join(' '), /Source:.*7770599/)
    assert.match(response.jsonBody.punditReply.checked.join(' '), /29:34\.620655 inclusive.*39:34\.620655 exclusive/)
    assert.match(response.jsonBody.punditReply.checked.join(' '), /No tracking/)
  })
})

test('offline model failure and rejected text retain the factual answer', async () => {
  for (const reply of [new Error('offline transport'), { text: 'An unsupported claim. [[MISSING]]', eventIds: ['177960849'] }]) {
    const h = mockRoute([anchoredClaim()], reply)
    const response = await h.handler(request('Arsenal were piling on the pressure in the ten minutes before Giroud scored.'), context)
    assert.equal(response.status, 200)
    assert.equal(response.jsonBody.punditReply, undefined)
    assert.ok(response.jsonBody.fanReply)
    assert.match(response.jsonBody.punditNotice, /factual answer/)
    assert.equal(response.jsonBody.claims[0].assessment, 'insufficient evidence for a firm conclusion')
    assert.ok(response.jsonBody.claims[0].evidenceAvailability.some(({ kind, available }) => kind === 'possession' && !available))
  }
})

const capturedRolling = {
  id: 'c1', subject: 'Northbridge', playerSubject: null, playerMetric: null,
  text: 'Compare Northbridge and Eastport for shots in the 10 minutes before 86:00.',
  intent: 'statistical-request',
  meaning: { category: 'factual-comparison', description: 'Which team had more shot attempts (shots) in the 10-minute window ending at 86:00?', comparison: { opponent: 'Eastport', opponentPlayer: null, metric: 'shots', operator: 'comparison-request' } },
  requiredEvidence: ['shots'], timePeriod: { kind: 'selected', eventId: null, lookbackSeconds: 600 },
  historicalEventAnchor: null, clarificationNeeds: [], clarificationReason: null,
}
const capturedRamsey = {
  id: 'c1', subject: 'Northbridge', playerSubject: null, playerMetric: null,
  text: "Northbridge eased off after Ramsey's goal that made it 3–3.", intent: 'subjective-judgement',
  meaning: { category: 'performance-judgement', description: 'Whether Northbridge reduced intensity or eased off in play after the equalising goal.', comparison: null },
  requiredEvidence: ['shots', 'goals'], timePeriod: { kind: 'selected', eventId: null, lookbackSeconds: null },
  historicalEventAnchor: null,
  clarificationNeeds: ['Which “Ramsey” goal do you mean? No available event lists a Ramsey goal — do you mean the equaliser around 85\' (a Northbridge goal credited to “Giroud”) or a different goal/minute?'],
  clarificationReason: 'ambiguous-reference',
}
const capturedPossession = {
  id: 'c1', subject: 'Eastport', playerSubject: null, playerMetric: null,
  text: "Eastport possession percentage in the ten minutes before Giroud's goal.", intent: 'unavailable-metric',
  meaning: { category: 'other', description: "Request the possession share (possession percentage) for Eastport during the 10-minute window before Giroud's goal.", comparison: null },
  requiredEvidence: ['possession', 'goals'],
  timePeriod: { kind: 'before-event', eventId: '177960902', lookbackSeconds: 600 },
  historicalEventAnchor: { eventId: '177960902', relationship: 'goal-scored' },
  clarificationNeeds: ['Possession intervals (possession percentage) are not available for this match — the possession-intervals capability is not recorded.'],
  clarificationReason: 'unavailable-evidence',
}

test('captured rolling output is accepted and independently overrides the selected UI period', async () => {
  const h = mockRoute([capturedRolling])
  const response = await h.handler(request('At 86:00, who was getting more efforts away over the last ten minutes?'), context)
  assert.equal(response.status, 200)
  assert.equal(h.reservations(), 1)
  const result = response.jsonBody.claims[0]
  assert.deepEqual(result.claim.timePeriod, { kind: 'selected', lookbackSeconds: 600 })
  assert.deepEqual(result.statistics.map(({ team, value }) => [team, value]), [['Arsenal', 6], ['Leicester City', 0]])
  assert.deepEqual(result.presentation.scope, { kind: 'rolling-window', lookbackSeconds: 600, through: { period: 2, minute: 86 } })
  assert.ok(result.calculations.find(({ team }) => team === 'Arsenal').numeratorRecordIds.includes('177960902'))
  const outbound = h.calls[0]
  const schema = outbound.response_format.json_schema.schema.properties.claims.items.properties.timePeriod
  assert.ok(schema.properties.kind.enum.includes('selected'))
  assert.match(outbound.messages[0].content, /rolling duration ending at the replay clock/)
  assert.match(outbound.messages[0].content, /lookbackSeconds/)
  assert.equal(JSON.parse(outbound.messages[1].content).selectedPeriod, 'match-so-far')
})

test('captured Ramsey clarification remains a clarification; corrected interpretation uses verified goal context', async () => {
  const opinion = 'Once Ramsey made it 3–3, did Arsenal ease off?'
  const old = mockRoute([capturedRamsey])
  const original = await old.handler(request(opinion), context)
  assert.equal(original.jsonBody.claims[0].assessment, 'clarification needed')
  assert.equal(old.reservations(), 1)
  const input = JSON.parse(old.calls[0].messages[1].content)
  const ramsey = input.availableEvents.find(({ id }) => id === '177960849')
  const giroud = input.availableEvents.find(({ id }) => id === '177960902')
  assert.deepEqual(ramsey.scorerAliases, ['Ramsey', 'Aaron Ramsey'])
  assert.deepEqual(ramsey.scoreAfter, { Northbridge: 3, Eastport: 3 })
  assert.deepEqual(giroud.scorerAliases, ['Giroud', 'Olivier Giroud'])
  assert.deepEqual(giroud.scoreAfter, { Northbridge: 4, Eastport: 3 })
  assert.match(old.calls[0].messages[0].content, /after-event/)
  assert.ok(old.calls[0].response_format.json_schema.schema.properties.claims.items.properties.timePeriod.properties.kind.enum.includes('after-event'))

  const corrected = { ...capturedRamsey, timePeriod: { kind: 'after-event', eventId: '177960849', lookbackSeconds: null },
    historicalEventAnchor: { eventId: '177960849', relationship: 'equaliser' }, clarificationNeeds: [], clarificationReason: null }
  const h = mockRoute([corrected], {
    text: 'Arsenal were still creating. [[GOAL_177960849]]. [[SHOT_SAVE_CORNER]] suggests Arsenal remained a threat.',
    eventIds: ['177960849', '177960899', '177960861', '177960900'],
  })
  const response = await h.handler(request(opinion), context)
  assert.equal(response.status, 200)
  assert.equal(h.reservations(), 2)
  assert.equal(response.jsonBody.claims[0].claim.timePeriod.kind, 'after-event')
  assert.equal(response.jsonBody.claims[0].claim.timePeriod.eventId, '177960849')
  const facts = JSON.parse(h.calls[1].messages[1].content)
  assert.deepEqual(facts.scoreAtStart, { Arsenal: 3, 'Leicester City': 3 })
  assert.deepEqual(facts.shots.map(({ id }) => id), ['177960899', '177960902'])
  assert.deepEqual(facts.sequence.map(({ id }) => id), ['177960849', '177960899', '177960861', '177960900', '177960902'])
  assert.match(facts.window, /37:11\.119656.*exclusive.*86:00/)
  assert.match(response.jsonBody.punditReply.text, /remained a threat/)
  assert.match(response.jsonBody.punditReply.text, /Overall tempo and tactical intent would require more evidence/)
  assert.match(response.jsonBody.punditReply.checked.join(' '), /177960849.*excluded/)
})

test('captured unavailable possession retains its requested pre-goal window', async () => {
  const h = mockRoute([capturedPossession])
  const response = await h.handler(request('How much of the ball did Leicester have in the ten minutes before Giroud scored?'), context)
  assert.equal(response.status, 200)
  assert.equal(h.reservations(), 1)
  const result = response.jsonBody.claims[0]
  assert.equal(result.assessment, 'unavailable data')
  assert.deepEqual(result.claim.timePeriod, { kind: 'before-event', eventId: '177960902', lookbackSeconds: 600 })
  assert.match(response.jsonBody.fanReply, /possession.*unavailable/i)
  assert.equal(result.presentation.answer.metric, 'possession-percentage')
  assert.equal(result.presentation.scope.kind, 'before-goal-window')
  assert.deepEqual(result.statistics, [])
  const input = JSON.parse(h.calls[0].messages[1].content)
  assert.ok(input.availableEvidenceCapabilities.some(({ id, status }) => id === 'possession-intervals' && status === 'not-recorded'))
  assert.match(h.calls[0].messages[0].content, /Unavailability is not ambiguity/)
})

test('after-event anchor validation rejects future, unknown and non-goal events', async () => {
  for (const [id, minute] of [['177960902', 80], ['unknown', 86], ['177960899', 86]]) {
    const claim = { ...capturedRamsey, timePeriod: { kind: 'after-event', eventId: id, lookbackSeconds: null },
      historicalEventAnchor: { eventId: id, relationship: 'goal' }, clarificationNeeds: [], clarificationReason: null }
    const h = mockRoute([claim])
    const response = await h.handler(request('Arsenal after the goal', { selectedClock: { period: 2, minute } }), context)
    assert.equal(response.status, 502)
    assert.equal(h.reservations(), 1)
    const events = JSON.parse(h.calls[0].messages[1].content).availableEvents
    if (minute === 80) assert.ok(!events.some((event) => event.id === id))
  }
})
