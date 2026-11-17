import assert from 'node:assert/strict'
import test from 'node:test'
import { createAnalyzeHandler } from '../dist/api/src/functions/analyze.js'
import { LocalInterpretationProvider } from '../dist/api/src/providers/local.js'
import { FoundryInterpretationProvider } from '../dist/api/src/providers/foundry.js'
import { FoundryAllowanceExceededError } from '../dist/api/src/foundryAllowance.js'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const requestBody = {
  opinion: 'Arsenal were piling on the pressure in the ten minutes before Giroud scored.',
  selectedClock: { period: 2, minute: 86 },
  period: 'match-so-far',
  datasetId: 'arsenal-leicester-wyscout-2499719',
  inputLanguage: 'en',
}
const claim = {
  id: 'claim-1', subject: 'Northbridge', playerSubject: null, playerMetric: null,
  text: 'Northbridge were piling on the pressure before Giroud scored',
  intent: 'subjective-judgement',
  meaning: { category: 'performance-judgement', description: 'Attacking pressure in the ten minutes before the goal.', comparison: null },
  requiredEvidence: ['shots'],
  timePeriod: { kind: 'before-event', eventId: '177960902', lookbackSeconds: 600 },
  historicalEventAnchor: { eventId: '177960902', relationship: 'Giroud scored' },
  clarificationNeeds: [],
}
const environment = { FOUNDRY_PUBLIC_ENABLED: 'true' }
const request = { headers: { get: () => null }, json: async () => requestBody }

function harness({ reply = {
  text: 'Arsenal were still creating. [[SHOT_COUNTS]], and after [[GOAL_177960849]] they still came forward. [[SHOT_SAVE_CORNER]].',
  eventIds: ['177960786', '177960827', '177960831', '177960849', '177960899', '177960861', '177960900'],
}, failReserve = false, claims = [claim] } = {}) {
  const calls = []
  const errors = []
  let reservations = 0
  const provider = new FoundryInterpretationProvider(
    { baseUrl: 'https://example.invalid/openai/v1', apiKey: 'offline-only', deployment: 'stub' },
    async (_url, init) => {
      const body = JSON.parse(init.body)
      calls.push(body)
      const output = calls.length === 1 ? { claims } : reply
      if (output instanceof Error) throw output
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] }), { status: 200 })
    },
  )
  const handler = createAnalyzeHandler(new LocalInterpretationProvider(), environment, () => ({
    async reserve() {
      reservations++
      if (failReserve && reservations === 2) throw new FoundryAllowanceExceededError('total')
    },
  }), () => provider)
  return { handler, calls, errors, reservations: () => reservations, context: { invocationId: 'offline-request-123', error: (...args) => errors.push(args) } }
}

test('pundit generation follows engine calculation and reserves each call', async () => {
  const h = harness()
  const response = await h.handler(request, h.context)
  assert.equal(response.status, 200)
  assert.equal(h.reservations(), 2)
  assert.equal(h.calls.length, 2)
  const interpretation = h.calls[0]
  const context = JSON.parse(interpretation.messages[1].content)
  const properties = interpretation.response_format.json_schema.schema.properties.claims.items.properties
  assert.equal(context.opinion, 'Northbridge were piling on the pressure in the ten minutes before Giroud scored.')
  assert.deepEqual(context.availableTeams, ['Northbridge', 'Eastport'])
  assert.deepEqual(properties.subject.anyOf[0].enum, context.availableTeams)
  assert.deepEqual(context.availablePlayers, [])
  assert.deepEqual(context.winningGoal.scorerAliases, ['Giroud', 'Olivier Giroud'])
  const goal = context.availableEvents.find(({ id }) => id === '177960902')
  assert.deepEqual({ team: goal.team, playerId: goal.playerId, outcome: goal.outcome, scorerAliases: goal.scorerAliases }, {
    team: 'Northbridge', playerId: '26010', outcome: 'goal', scorerAliases: ['Giroud', 'Olivier Giroud'],
  })
  assert.deepEqual(properties.timePeriod.properties.lookbackSeconds.anyOf, [{ type: 'integer' }, { type: 'null' }])
  assert.ok(properties.playerSubject.anyOf.some(({ type }) => type === 'null'))
  assert.ok(properties.intent.enum.includes('subjective-judgement'))
  assert.match(interpretation.messages[0].content, /scorer mentioned only to identify a goal-based time window is not the subject/)
  assert.match(interpretation.messages[0].content, /multiple eligible goals plausibly match/)
  assert.match(interpretation.messages[0].content, /qualitative judgement about a team's play in the spell before a goal is instead subjective-judgement/)
  assert.match(interpretation.messages[0].content, /lookbackSeconds to the requested duration in seconds/)
  assert.equal(response.jsonBody.claims[0].claim.subject, 'Arsenal')
  assert.equal(response.jsonBody.claims[0].claim.playerSubject, null)
  assert.deepEqual(response.jsonBody.claims[0].claim.timePeriod, { kind: 'before-event', eventId: '177960902', lookbackSeconds: 600 })
  const facts = JSON.parse(h.calls[1].messages[1].content)
  const generationInstructions = h.calls[1].messages[0].content
  assert.match(generationInstructions, /2–3 natural, concise sentences/)
  assert.match(generationInstructions, /not a verdict/)
  assert.match(generationInstructions, /still creating/)
  assert.match(generationInstructions, /cannot establish overall tempo/)
  assert.match(generationInstructions, /Do not write raw coordinates, event IDs, precise timestamps/)
  assert.match(generationInstructions, /insert at least one supplied verifiedPhrases token/)
  assert.match(generationInstructions, /number words one through ten \(even idiomatically\)/)
  assert.deepEqual(facts.scoreAtStart, { Arsenal: 2, 'Leicester City': 3 })
  assert.equal(facts.window, '2H 29:34.620655 inclusive to 2H 39:34.620655 exclusive (goal 177960902).')
  assert.deepEqual(facts.shotCounts, { Arsenal: 5, 'Leicester City': 0 })
  assert.deepEqual(facts.shots.map(({ id }) => id), ['177960786', '177960827', '177960831', '177960849', '177960899'])
  assert.deepEqual(facts.shots.map(({ origin }) => origin.x), [73, 68, 92, 94, 90])
  assert.deepEqual(facts.sequence.map(({ id }) => id), ['177960899', '177960861', '177960900', '177960902'])
  assert.match(facts.sequence.at(-1).description, /after the exclusive window/)
  assert.ok(!facts.shots.some(({ id }) => id === '177960902'))
  assert.equal(facts.shots.find(({ id }) => id === '177960849').outcome, 'goal')
  assert.deepEqual(facts.verifiedPhrases, [
    { token: '[[SHOT_COUNTS]]', text: "Arsenal had 5 shots to Leicester City's 0 in the spell", eventIds: ['177960786', '177960827', '177960831', '177960849', '177960899'] },
    { token: '[[GOAL_177960849]]', text: 'Aaron Ramsey made it 3–3', eventIds: ['177960849'] },
    { token: '[[SHOT_SAVE_CORNER]]', text: 'Lacazette’s shot was followed by Schmeichel’s save and Xhaka’s corner', eventIds: ['177960899', '177960861', '177960900'] },
    { token: '[[WINNER_AFTER_SPELL]]', text: 'Giroud scored the winner after the counted spell', eventIds: ['177960902'] },
  ])
  assert.match(response.jsonBody.punditReply.text, /after Aaron Ramsey made it 3–3 they still came forward/)
  assert.match(response.jsonBody.punditReply.text, /Lacazette’s shot was followed by Schmeichel’s save and Xhaka’s corner/)
  assert.match(response.jsonBody.punditReply.text, /Overall tempo and tactical intent would require more evidence/)
  assert.doesNotMatch(response.jsonBody.punditReply.text, /\[\[|177960|origin|normalized|2H 39:|The recorded score at the start/)
  assert.equal(response.jsonBody.punditReply.text.match(/[.!?](?:\s|$)/g).length, 4)
  assert.match(response.jsonBody.punditReply.checked.join(' '), /Arsenal 5, Leicester City 0/)
  assert.match(response.jsonBody.punditReply.checked.join(' '), /origin \(94, 63\)/)
  assert.ok(response.jsonBody.punditReply.checked.some((line) => line.includes('177960902')))
  assert.equal(response.jsonBody.claims[0].assessment, 'insufficient evidence for a firm conclusion')
})

test('Leicester shot question uses scorer metadata for the window, not the player subject', async () => {
  const h = harness({ claims: [{
    ...claim, subject: 'Eastport', intent: 'statistical-request',
    text: 'Eastport recorded a shot before Giroud scored',
    meaning: { category: 'other', description: 'Recorded Eastport shots.', comparison: null },
  }] })
  const response = await h.handler({ ...request, json: async () => ({
    ...requestBody, opinion: 'Did Leicester get a shot off in the ten minutes before Giroud scored?',
  }) }, h.context)
  assert.equal(response.status, 200)
  const context = JSON.parse(h.calls[0].messages[1].content)
  assert.match(context.opinion, /^Did Eastport/)
  assert.deepEqual(context.availableEvents.find(({ id }) => id === '177960902').scorerAliases, ['Giroud', 'Olivier Giroud'])
  const result = response.jsonBody.claims[0]
  assert.equal(result.claim.subject, 'Leicester City')
  assert.equal(result.claim.playerSubject, null)
  assert.deepEqual(result.claim.timePeriod, { kind: 'before-event', eventId: '177960902', lookbackSeconds: 600 })
  assert.deepEqual(result.statistics, [{ team: 'Leicester City', metric: 'shots', value: 0 }])
  assert.equal(h.calls.length, 1)
})

test('unknown and future anchors are rejected by the normal route', async () => {
  for (const [id, minute] of [['unknown-goal', 86], ['177960902', 80]]) {
    const h = harness({ claims: [{
      ...claim,
      timePeriod: { kind: 'before-event', eventId: id, lookbackSeconds: 600 },
      historicalEventAnchor: { eventId: id, relationship: 'goal' },
    }] })
    const response = await h.handler({ ...request, json: async () => ({
      ...requestBody, selectedClock: { period: 2, minute },
    }) }, h.context)
    assert.equal(response.status, 502)
    assert.equal(response.jsonBody.failureType, 'semantic-validation')
    assert.equal(h.calls.length, 1)
    if (minute === 80) {
      const context = JSON.parse(h.calls[0].messages[1].content)
      assert.equal(context.winningGoal, undefined)
      assert.ok(!context.availableEvents.some(({ id: eventId }) => eventId === '177960902'))
    }
  }
})

test('a clarification at an earlier replay time does not disclose the later goal', async () => {
  const h = harness({ claims: [{
    ...claim, timePeriod: { kind: 'selected', eventId: null, lookbackSeconds: null },
    historicalEventAnchor: null, clarificationNeeds: ['Which spell do you mean?'],
  }] })
  const response = await h.handler({ ...request, json: async () => ({
    ...requestBody, selectedClock: { period: 2, minute: 80 },
  }) }, h.context)
  assert.equal(response.status, 200)
  const context = JSON.parse(h.calls[0].messages[1].content)
  assert.equal(context.winningGoal, undefined)
  assert.ok(!context.availableEvents.some(({ id }) => id === '177960902'))
  assert.equal(response.jsonBody.claims[0].assessment, 'clarification needed')
  assert.doesNotMatch(JSON.stringify(response.jsonBody), /177960902|39:34|winner|winning goal/i)
  assert.equal(h.calls.length, 1)
})

test('ambiguous unqualified goal asks for clarification and cannot generate a reply', async () => {
  const h = harness({ claims: [{
    ...claim, timePeriod: { kind: 'selected', eventId: null, lookbackSeconds: null },
    historicalEventAnchor: null, clarificationNeeds: ['Which goal do you mean?'],
  }] })
  const response = await h.handler({ ...request, json: async () => ({
    ...requestBody, opinion: 'Arsenal were piling on pressure in the ten minutes before the goal.',
  }) }, h.context)
  assert.equal(response.status, 200)
  const context = JSON.parse(h.calls[0].messages[1].content)
  assert.ok(context.availableEvents.filter((event) => event.outcome === 'goal').length > 1)
  assert.match(h.calls[0].messages[0].content, /multiple eligible goals plausibly match/)
  assert.equal(response.jsonBody.claims[0].assessment, 'clarification needed')
  assert.equal(response.jsonBody.punditReply, undefined)
  assert.equal(h.calls.length, 1)
})

test('rolling ten-minute request through the route includes the winner', async () => {
  const h = harness({ claims: [{
    ...claim, intent: 'statistical-request',
    meaning: { category: 'factual-comparison', description: 'Compare recorded shots.', comparison: {
      opponent: 'Eastport', opponentPlayer: null, metric: 'shots', operator: 'comparison-request',
    } },
    text: 'Compare shots', timePeriod: { kind: 'selected', eventId: null, lookbackSeconds: null },
    historicalEventAnchor: null,
  }] })
  const response = await h.handler({ ...request, json: async () => ({
    ...requestBody, opinion: 'Who had more shots in the last ten minutes?', period: 'last-10-minutes',
  }) }, h.context)
  assert.equal(response.status, 200)
  assert.equal(JSON.parse(h.calls[0].messages[1].content).selectedPeriod, 'last-10-minutes')
  assert.deepEqual(response.jsonBody.claims[0].statistics.map(({ team, value }) => [team, value]),
    [['Arsenal', 6], ['Leicester City', 0]])
  assert.ok(response.jsonBody.claims[0].calculations[0].numeratorRecordIds.includes('177960902'))
  assert.equal(h.calls.length, 1)
})

test('real player subjects still resolve from availablePlayers', async () => {
  const calls = []
  const provider = new FoundryInterpretationProvider(
    { baseUrl: 'https://example.invalid/openai/v1', apiKey: 'offline-only', deployment: 'stub' },
    async (_url, init) => {
      const body = JSON.parse(init.body)
      calls.push(body)
      const context = JSON.parse(body.messages[1].content)
      const saka = context.availablePlayers.find(({ name }) => name === 'Bukayo Saka')
      assert.ok(saka)
      assert.match(body.messages[0].content, /Resolve player subjects only from availablePlayers/)
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ claims: [{
        id: 'claim-1', subject: saka.team, playerSubject: { id: saka.id, name: saka.name, team: saka.team },
        playerMetric: 'shots', text: 'How many shots did Bukayo Saka have?', intent: 'statistical-request',
        meaning: { category: 'other', description: 'Recorded player shots.', comparison: null },
        requiredEvidence: ['shots'], timePeriod: { kind: 'selected', eventId: null, lookbackSeconds: null },
        historicalEventAnchor: null, clarificationNeeds: [],
      }] }) } }] }), { status: 200 })
    },
  )
  const handler = createAnalyzeHandler(new LocalInterpretationProvider(), environment,
    () => ({ reserve: async () => {} }), () => provider)
  const response = await handler({ ...request, json: async () => ({
    opinion: 'How many shots did Bukayo Saka have?', selectedClock: { period: 2, minute: 58 },
    period: 'match-so-far', datasetId: 'northbridge-eastport-analysis-demo', inputLanguage: 'en',
  }) }, { error: () => {} })
  assert.equal(response.status, 200)
  assert.equal(response.jsonBody.claims[0].claim.playerSubject.name, 'Bukayo Saka')
  assert.equal(response.jsonBody.claims[0].claim.playerSubject.id, 'north-player-09')
  assert.equal(calls.length, 1)
})

test('opposing claims can use the same anchored evidence without a definitive verdict', async () => {
  const opposing = [
    { ...claim, id: 'claim-1', subject: 'Eastport', text: 'Eastport were comfortable in the spell' },
    { ...claim, id: 'claim-2', text: 'Northbridge were just taking potshots' },
  ]
  const h = harness({ claims: opposing, reply: {
    text: 'Arsenal were still creating. [[SHOT_COUNTS]], and [[GOAL_177960849]]. [[SHOT_SAVE_CORNER]] after that. The records cannot establish the wider tactical picture.',
    eventIds: ['177960786', '177960827', '177960831', '177960849', '177960899', '177960861', '177960900'],
  } })
  const response = await h.handler({ ...request, json: async () => ({
    ...requestBody, opinion: 'Leicester were comfortable in the ten minutes before Giroud scored. Arsenal were just taking potshots in that spell.',
  }) }, h.context)
  assert.equal(response.status, 200)
  assert.equal(h.calls.length, 2)
  const facts = JSON.parse(h.calls[1].messages[1].content)
  assert.deepEqual(facts.shotCounts, { Arsenal: 5, 'Leicester City': 0 })
  assert.deepEqual(response.jsonBody.claims.map((item) => item.claim.timePeriod.eventId), ['177960902', '177960902'])
  assert.match(response.jsonBody.punditReply.text, /still creating/)
  assert.match(response.jsonBody.punditReply.checked.join(' '), /origin \(94, 63\)/)
})

test('opposing control take with an evidence-only clarification reaches the same pundit evidence', async () => {
  const control = {
    ...claim, subject: 'Eastport', text: 'Eastport had Northbridge under control',
    requiredEvidence: ['shots', 'possession', 'passing'],
    clarificationNeeds: ['Possession, pressure and passing data are unavailable.'],
    clarificationReason: 'unavailable-evidence',
  }
  const h = harness({ claims: [control], reply: {
    text: 'Arsenal were still creating. [[SHOT_COUNTS]], and [[GOAL_177960849]]. [[SHOT_SAVE_CORNER]] after that. The records do not establish the entire tactical picture.',
    eventIds: ['177960786', '177960827', '177960831', '177960849', '177960899', '177960861', '177960900'],
  } })
  const response = await h.handler({ ...request, json: async () => ({
    ...requestBody, opinion: 'Leicester had Arsenal under control in the ten minutes before Giroud scored',
  }) }, h.context)
  assert.equal(response.status, 200)
  assert.equal(h.calls.length, 2)
  const instructions = h.calls[0].messages[0].content
  assert.match(instructions, /one team had the other under control is a single team performance judgement/)
  assert.match(instructions, /Missing evidence alone is not a reason to clarify/)
  assert.match(instructions, /Explicit requests for unavailable metrics must report unavailability/)
  const schema = h.calls[0].response_format.json_schema.schema.properties.claims.items
  assert.ok(schema.required.includes('clarificationReason'))
  assert.ok(schema.properties.clarificationReason.anyOf[0].enum.includes('unavailable-evidence'))
  const result = response.jsonBody.claims[0]
  assert.equal(result.claim.subject, 'Leicester City')
  assert.deepEqual(result.claim.timePeriod, { kind: 'before-event', eventId: '177960902', lookbackSeconds: 600 })
  assert.deepEqual(result.claim.clarificationNeeds, [])
  assert.equal(result.assessment, 'insufficient evidence for a firm conclusion')
  assert.ok(result.evidenceAvailability.some(({ kind, available }) => kind === 'possession' && !available))
  assert.ok(result.evidenceAvailability.some(({ kind, available }) => kind === 'passing' && !available))
  const facts = JSON.parse(h.calls[1].messages[1].content)
  assert.deepEqual(facts.shotCounts, { Arsenal: 5, 'Leicester City': 0 })
  assert.deepEqual(facts.shots.map(({ id }) => id), ['177960786', '177960827', '177960831', '177960849', '177960899'])
  assert.ok(!facts.shots.some(({ id }) => id === '177960902'))
  assert.match(facts.window, /29:34\.620655 inclusive to 2H 39:34\.620655 exclusive/)
  assert.deepEqual(facts.sequence.map(({ id }) => id), ['177960899', '177960861', '177960900', '177960902'])
  assert.match(facts.verifiedPhrases.find(({ token }) => token === '[[GOAL_177960849]]').text, /3–3/)
  assert.match(facts.limitations.join(' '), /possession intervals, passing, pressure observations/)
  assert.match(response.jsonBody.punditReply.text, /still creating/)
  assert.match(response.jsonBody.punditReply.text, /Aaron Ramsey made it 3–3/)
  assert.match(response.jsonBody.punditReply.text, /Schmeichel’s save and Xhaka’s corner/)
})

test('explicit possession comparison remains unavailable and does not generate from shots', async () => {
  const h = harness({ claims: [{
    ...claim, intent: 'statistical-request',
    text: 'Compare possession', meaning: { category: 'factual-comparison', description: 'Possession comparison.', comparison: {
      opponent: 'Eastport', opponentPlayer: null, metric: 'possession-percentage', operator: 'comparison-request',
    } },
    requiredEvidence: ['possession'], clarificationReason: null,
  }] })
  const response = await h.handler({ ...request, json: async () => ({
    ...requestBody, opinion: 'What was Arsenal and Leicester possession in the ten minutes before Giroud scored?',
  }) }, h.context)
  assert.equal(response.status, 200)
  assert.equal(response.jsonBody.claims[0].assessment, 'unavailable data')
  assert.ok(response.jsonBody.claims[0].evidenceAvailability.some(({ kind, available }) => kind === 'possession' && !available))
  assert.ok(!response.jsonBody.claims[0].statistics.some(({ metric }) => metric === 'shots'))
  assert.equal(response.jsonBody.punditReply, undefined)
  assert.equal(h.calls.length, 1)
})

test('classified reference or meaning ambiguity is never treated as missing evidence', async () => {
  for (const [reason, subject, period, anchor] of [
    ['ambiguous-reference', null, { kind: 'selected', eventId: null, lookbackSeconds: null }, null],
    ['ambiguous-reference', 'Eastport', { kind: 'selected', eventId: null, lookbackSeconds: null }, null],
    ['ambiguous-meaning', 'Eastport', claim.timePeriod, claim.historicalEventAnchor],
    ['unavailable-evidence', null, { kind: 'selected', eventId: null, lookbackSeconds: null }, null],
  ]) {
    const h = harness({ claims: [{
      ...claim, subject, timePeriod: period, historicalEventAnchor: anchor,
      clarificationNeeds: ['Please clarify the reference or meaning.'], clarificationReason: reason,
    }] })
    const response = await h.handler({ ...request, json: async () => ({
      ...requestBody, opinion: 'They had them under control before the goal.',
    }) }, h.context)
    assert.equal(response.status, 200)
    assert.equal(response.jsonBody.claims[0].assessment, 'clarification needed')
    assert.equal(response.jsonBody.punditReply, undefined)
    assert.equal(h.calls.length, 1)
  }
})

test('invalid clarification classification fails explicitly', async () => {
  const h = harness({ claims: [{ ...claim, clarificationReason: 'unknown' }] })
  const response = await h.handler(request, h.context)
  assert.equal(response.status, 502)
  assert.equal(response.jsonBody.failureType, 'semantic-validation')
  assert.equal(h.calls.length, 1)
})

test('evidence-only label cannot erase unresolved goal or player clarifications', async () => {
  for (const overrides of [
    { timePeriod: { kind: 'before-event', eventId: 'unknown-goal', lookbackSeconds: 600 }, historicalEventAnchor: { eventId: 'unknown-goal', relationship: 'goal' } },
    { playerSubject: { id: '26010', name: 'Olivier Giroud', team: 'Northbridge' } },
  ]) {
    const h = harness({ claims: [{
      ...claim, ...overrides, clarificationNeeds: ['Please clarify the subject or spell.'],
      clarificationReason: 'unavailable-evidence',
    }] })
    const response = await h.handler(request, h.context)
    assert.equal(response.status, 502)
    assert.equal(h.calls.length, 1)
  }
})

test('phrases follow the selected window and never borrow a missing sequence', async () => {
  const narrowClaim = {
    ...claim,
    timePeriod: { kind: 'before-event', eventId: '177960902', lookbackSeconds: 10 },
  }
  const h = harness({ claims: [narrowClaim], reply: {
    text: 'It is difficult to make a firm judgement. [[SHOT_SAVE_CORNER]] would be useful context.',
    eventIds: ['177960900'],
  } })
  const response = await h.handler(request, h.context)
  assert.equal(response.status, 200)
  const facts = JSON.parse(h.calls[1].messages[1].content)
  assert.deepEqual(facts.scoreAtStart, { Arsenal: 3, 'Leicester City': 3 })
  assert.deepEqual(facts.shotCounts, { Arsenal: 0, 'Leicester City': 0 })
  assert.deepEqual(facts.sequence.map(({ id }) => id), ['177960900', '177960902'])
  assert.ok(!facts.verifiedPhrases.some(({ token }) => token === '[[SHOT_SAVE_CORNER]]' || token === '[[GOAL_177960849]]'))
  assert.equal(response.jsonBody.punditReply, undefined)
  assert.match(response.jsonBody.punditNotice, /factual answer/)
})

test('invalid reply and failed generation retain the factual answer', async () => {
  for (const reply of [
    { text: 'No — Arsenal did not ease off. [[SHOT_SAVE_CORNER]].', eventIds: ['177960899', '177960861', '177960900'] },
    { text: 'Arsenal slowed down after the equaliser. [[SHOT_SAVE_CORNER]].', eventIds: ['177960899', '177960861', '177960900'] },
    { text: '[[SHOT_SAVE_CORNER]]. The team maintained its intensity.', eventIds: ['177960899', '177960861', '177960900'] },
    { text: '[[SHOT_SAVE_CORNER]]. Arsenal did not ease off, although the tempo is uncertain.', eventIds: ['177960899', '177960861', '177960900'] },
    { text: 'I would challenge that take. [[SHOT_SAVE_CORNER]].', eventIds: ['177960899', '177960861', '177960900'] },
    { text: 'Arsenal scored 99 goals. [[GOAL_177960849]]', eventIds: ['177960849'] },
    { text: 'Ramsey scored from thirty yards. [[GOAL_177960849]]', eventIds: ['177960849'] },
    { text: 'This is a plausible opinion. [[GOAL_177960849]]', eventIds: ['not-a-record'] },
    { text: 'This is a plausible opinion. [[UNKNOWN_TOKEN]]', eventIds: ['177960849'] },
    { text: 'This is a plausible opinion. [[SHOT_SAVE_CORNER]]', eventIds: ['177960899'] },
    { text: 'This is a plausible opinion. [[GOAL_177960849]', eventIds: ['177960849'] },
    new Error('offline'),
  ]) {
    const h = harness({ reply })
    const response = await h.handler(request, h.context)
    assert.equal(response.status, 200)
    assert.equal(response.jsonBody.punditReply, undefined)
    assert.ok(response.jsonBody.fanReply)
    assert.match(response.jsonBody.punditNotice, /factual answer/)
    assert.equal(h.reservations(), 2)
    assert.equal(h.errors.length, 1)
  }
})

test('one used idiomatically is explicitly rejected and captured with the request and failed rule', async () => {
  const originalCwd = process.cwd()
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'pundit-diagnostic-'))
  try {
    process.chdir(temporaryDirectory)
    const reply = { text: 'One thing is clear: [[GOAL_177960849]]. The wider picture remains uncertain.', eventIds: ['177960849'] }
    const calls = []
    const errors = []
    let reservations = 0
    const provider = new FoundryInterpretationProvider(
      { baseUrl: 'https://example.invalid/openai/v1', apiKey: 'secret-not-for-capture', deployment: 'stub' },
      async (_url, init) => {
        calls.push(JSON.parse(init.body))
        return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(calls.length === 1 ? { claims: [claim] } : reply) } }] }), { status: 200 })
      },
    )
    const handler = createAnalyzeHandler(new LocalInterpretationProvider(),
      { ...environment, FOUNDRY_CAPTURE_RAW_OUTPUT: 'true' },
      () => ({ reserve: async () => { reservations++ } }), () => provider)
    const response = await handler(request, { invocationId: 'offline-request-123', error: (...args) => errors.push(args) })
    assert.equal(response.status, 200)
    assert.equal(reservations, 2)
    assert.equal(response.jsonBody.punditReply, undefined)
    assert.ok(response.jsonBody.fanReply)
    assert.match(response.jsonBody.punditNotice, /factual answer/)
    assert.match(errors[0][0], /requestId=offline-request-123 field=text rule=number-word-outside-token/)
    const record = JSON.parse((await readFile(join(temporaryDirectory, '.local-captures', 'foundry-raw-output.jsonl'), 'utf8')).trim())
    assert.equal(record.kind, 'pundit-generation')
    assert.equal(record.requestId, 'offline-request-123')
    assert.deepEqual(JSON.parse(record.structuredOutput), reply)
    assert.deepEqual(record.rejection, { field: 'text', rule: 'number-word-outside-token' })
    assert.doesNotMatch(JSON.stringify(record), /secret-not-for-capture|api-key/i)
  } finally {
    process.chdir(originalCwd)
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})

test('invalid JSON generation is captured as a provider schema rejection', async () => {
  const originalCwd = process.cwd()
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'pundit-schema-'))
  try {
    process.chdir(temporaryDirectory)
    let calls = 0
    const errors = []
    const provider = new FoundryInterpretationProvider(
      { baseUrl: 'https://example.invalid/openai/v1', apiKey: 'offline-only', deployment: 'stub' },
      async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
        content: ++calls === 1 ? JSON.stringify({ claims: [claim] }) : '{broken-json',
      } }] }), { status: 200 }),
    )
    const handler = createAnalyzeHandler(new LocalInterpretationProvider(),
      { ...environment, FOUNDRY_CAPTURE_RAW_OUTPUT: 'true' }, () => ({ reserve: async () => {} }), () => provider)
    const response = await handler(request, { invocationId: 'offline-schema-123', error: (...args) => errors.push(args) })
    assert.equal(response.status, 200)
    assert.equal(response.jsonBody.punditReply, undefined)
    assert.match(response.jsonBody.punditNotice, /factual answer/)
    assert.match(errors[0][0], /field=response rule=provider-schema/)
    const record = JSON.parse((await readFile(join(temporaryDirectory, '.local-captures', 'foundry-raw-output.jsonl'), 'utf8')).trim())
    assert.equal(record.structuredOutput, '{broken-json')
    assert.deepEqual(record.rejection, { field: 'response', rule: 'provider-schema' })
  } finally {
    process.chdir(originalCwd)
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})

test('valid generated reply is captured with no rejection when diagnostics are enabled', async () => {
  const originalCwd = process.cwd()
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'pundit-valid-'))
  try {
    process.chdir(temporaryDirectory)
    const reply = { text: 'The record gives us this: [[GOAL_177960849]].', eventIds: ['177960849'] }
    let calls = 0
    const provider = new FoundryInterpretationProvider(
      { baseUrl: 'https://example.invalid/openai/v1', apiKey: 'offline-only', deployment: 'stub' },
      async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
        content: JSON.stringify(++calls === 1 ? { claims: [claim] } : reply),
      } }] }), { status: 200 }),
    )
    const handler = createAnalyzeHandler(new LocalInterpretationProvider(),
      { ...environment, FOUNDRY_CAPTURE_RAW_OUTPUT: 'true' }, () => ({ reserve: async () => {} }), () => provider)
    const response = await handler(request, { invocationId: 'offline-valid-123', error: () => assert.fail('Unexpected error') })
    assert.match(response.jsonBody.punditReply.text, /Aaron Ramsey made it 3–3/)
    const record = JSON.parse((await readFile(join(temporaryDirectory, '.local-captures', 'foundry-raw-output.jsonl'), 'utf8')).trim())
    assert.equal(record.requestId, 'offline-valid-123')
    assert.deepEqual(JSON.parse(record.structuredOutput), reply)
    assert.equal(record.rejection, null)
  } finally {
    process.chdir(originalCwd)
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})

test('no generation call occurs if the second allowance reservation fails', async () => {
  const h = harness({ failReserve: true })
  const response = await h.handler(request, h.context)
  assert.equal(response.status, 200)
  assert.equal(h.calls.length, 1)
  assert.equal(h.reservations(), 2)
  assert.equal(response.jsonBody.punditReply, undefined)
  assert.match(response.jsonBody.punditNotice, /factual answer/)
})

test('a clarification at an earlier replay time never invokes generation or reveals the goal', async () => {
  const h = harness({ claims: [{
    ...claim,
    timePeriod: { kind: 'selected', eventId: null, lookbackSeconds: null },
    historicalEventAnchor: null,
    clarificationNeeds: ['Which spell do you mean?'],
  }] })
  const response = await h.handler({ ...request, json: async () => ({
    ...requestBody, selectedClock: { period: 2, minute: 80 },
  }) }, h.context)
  assert.equal(response.status, 200)
  assert.equal(h.calls.length, 1)
  assert.equal(h.reservations(), 1)
  assert.equal(response.jsonBody.punditReply, undefined)
  assert.doesNotMatch(JSON.stringify(response.jsonBody), /177960902|39:34|winner|winning goal/i)
  assert.equal(response.jsonBody.claims[0].assessment, 'clarification needed')
})

test('a statistical request does not acquire a pundit verdict or consume a second call', async () => {
  const h = harness({ claims: [{
    ...claim, intent: 'statistical-request',
    meaning: { category: 'other', description: 'Report the recorded shots.', comparison: null },
  }] })
  const response = await h.handler(request, h.context)
  assert.equal(response.status, 200)
  assert.equal(response.jsonBody.claims[0].assessment, 'statistics provided')
  assert.equal(response.jsonBody.punditReply, undefined)
  assert.equal(h.reservations(), 1)
  assert.equal(h.calls.length, 1)
})
