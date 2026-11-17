import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { FoundryInterpretationProvider } from '../dist/api/src/providers/foundry.js'
import { analyzeMatch } from '../dist/shared/src/match.js'

const DATASET_ID = 'arsenal-leicester-wyscout-2499719'
const WINNING_GOAL_ID = 177960902
const SHOT_IDS = [
  177960786,
  177960827,
  177960831,
  177960849,
  177960899,
]
const source = JSON.parse(
  readFileSync(
    new URL('../../shared/src/data/arsenal-leicester-2499719.json', import.meta.url),
    'utf8',
  ),
)

const isGoal = (event) => event.tags.some(({ id }) => id === 101)

test('raw Wyscout window independently identifies the 4–3 winner and counts shots', async () => {
  const goal = source.find((event) => event.id === WINNING_GOAL_ID)
  assert.ok(goal)
  assert.equal(goal.eventName, 'Shot')
  assert.equal(goal.matchId, 2499719)
  assert.equal(goal.matchPeriod, '2H')
  assert.equal(Number(goal.eventSec.toFixed(6)), 2374.620655)
  assert.equal(goal.teamId, 1609)
  assert.ok(isGoal(goal))
  const finalGoal = source
    .filter((event) => event.eventName === 'Shot' && isGoal(event))
    .sort((left, right) =>
      left.matchPeriod === right.matchPeriod
        ? left.eventSec - right.eventSec
        : left.matchPeriod === '1H' ? -1 : 1,
    )
    .at(-1)
  assert.equal(finalGoal.id, WINNING_GOAL_ID)

  const windowStart = goal.eventSec - 600
  const windowShots = source.filter(
    (event) =>
      event.eventName === 'Shot' &&
      event.matchId === goal.matchId &&
      event.matchPeriod === goal.matchPeriod &&
      event.eventSec >= windowStart &&
      event.eventSec < goal.eventSec,
  )
  const rawCounts = Object.fromEntries(
    [1609, 1631].map((teamId) => [
      teamId,
      windowShots.filter((event) => event.teamId === teamId).length,
    ]),
  )
  assert.deepEqual(windowShots.map(({ id }) => id).sort((a, b) => a - b), SHOT_IDS)
  assert.deepEqual(rawCounts, { 1609: 5, 1631: 0 })

  const result = await analyzeOpinion({
    opinion: 'Who had more shots in the ten minutes before Giroud’s winner?',
    selectedClock: { period: 2, minute: 85 },
    period: 'match-so-far',
    datasetId: DATASET_ID,
  })
  const claim = result.claims[0]
  assert.equal(claim.assessment, 'statistics provided')
  assert.equal(claim.claim.intent, 'statistical-request')
  assert.equal(claim.claim.timePeriod.kind, 'before-event')
  assert.equal(claim.claim.timePeriod.eventId, String(WINNING_GOAL_ID))
  assert.equal(claim.claim.timePeriod.lookbackSeconds, 600)
  assert.match(claim.periodLabel, /2H 29:34\.621 inclusive up to, but excluding, 2H 39:34\.621/)
  assert.deepEqual(
    claim.statistics.map(({ team, value }) => [team, value]),
    [['Arsenal', rawCounts[1609]], ['Leicester City', rawCounts[1631]]],
  )
  assert.match(result.fanReply, /Arsenal.*5.*Leicester City.*0/)
  assert.deepEqual(
    claim.calculations.map(({ team, numerator, denominator, numeratorRecordIds }) => [
      team,
      numerator,
      denominator,
      numeratorRecordIds.map(Number).sort((a, b) => a - b),
    ]),
    [
      ['Arsenal', 5, 5, SHOT_IDS],
      ['Leicester City', 0, 0, []],
    ],
  )
  const citedIds = new Set(claim.evidence.map(({ reference }) => Number(reference.id)))
  for (const id of [...SHOT_IDS, WINNING_GOAL_ID]) assert.ok(citedIds.has(id), `missing source event ${id}`)
  assert.ok(Object.values(result.periodStatistics).every(({ shotsOnTarget }) => shotsOnTarget === null))
  assert.equal(result.evidenceFoundation.dataset.provenance, 'observed')
  assert.match(result.evidenceFoundation.dataset.source, /Luca Pappalardo and Emanuele Massucco/)
  assert.match(result.evidenceFoundation.dataset.source, /CC BY 4\.0/)

  const at86 = await analyzeOpinion({
    opinion: 'Who had more shots in the ten minutes before Giroud’s winner?',
    selectedClock: { period: 2, minute: 86 },
    period: 'match-so-far',
    datasetId: DATASET_ID,
  })
  assert.deepEqual(at86.claims[0].statistics.map(({ team, value }) => [team, value]),
    [['Arsenal', 5], ['Leicester City', 0]])
  assert.deepEqual(at86.claims[0].calculations[0].numeratorRecordIds.map(Number).sort((a, b) => a - b),
    SHOT_IDS)
})

test('86:00 replay last ten minutes is distinct from the pre-winner window', async () => {
  const shots = source.filter((event) =>
    event.matchPeriod === '2H' && event.eventSec >= 1860 &&
    event.eventSec <= 2460 && event.eventName === 'Shot')
  assert.deepEqual(shots.filter((event) => event.teamId === 1609).map((event) => event.id),
    [...SHOT_IDS, WINNING_GOAL_ID])
  assert.equal(shots.filter((event) => event.teamId === 1631).length, 0)
  const result = await analyzeOpinion({
    opinion: 'Who had more shots?',
    selectedClock: { period: 2, minute: 86 },
    period: 'last-10-minutes',
    datasetId: DATASET_ID,
  })
  assert.equal(result.periodStatistics.Arsenal.shots, 6)
  assert.equal(result.periodStatistics['Leicester City'].shots, 0)
})

test('historical replay uses exact source seconds at both boundaries', () => {
  const event = (id, seconds) => ({
    id, clock: { period: 2, minute: Math.floor(seconds / 60) + 46 },
    sourcePeriodSeconds: seconds, team: 'Northbridge', type: 'shot',
    outcome: 'unclassified', description: 'test',
  })
  const analysis = analyzeMatch([
    event('before-start', 1859.999),
    event('start', 1860),
    event('end', 2460),
    event('after-end', 2460.001),
  ], { period: 2, minute: 86 }, 'last-10-minutes')
  assert.deepEqual(analysis.periodEvents.map(({ id }) => id), ['start', 'end'])
})

test('raw source preserves the pre-winner score, shot origins and late sequence', () => {
  const byId = (id) => {
    const row = source.find((event) => event.id === id)
    assert.ok(row, `missing source event ${id}`)
    return row
  }
  const start = byId(WINNING_GOAL_ID).eventSec - 600
  const goalsBeforeStart = source.filter((event) => event.eventName === 'Shot' && isGoal(event) &&
    (event.matchPeriod === '1H' || (event.matchPeriod === '2H' && event.eventSec < start)))
  assert.deepEqual(goalsBeforeStart.map((event) => event.teamId), [1609, 1631, 1631, 1609, 1631])
  assert.deepEqual(SHOT_IDS.map((id) => byId(id).positions[0]), [
    { y: 66, x: 73 }, { y: 54, x: 68 }, { y: 32, x: 92 },
    { y: 63, x: 94 }, { y: 34, x: 90 },
  ])
  const sequence = [177960899, 177960861, 177960900, 177960902].map(byId)
  assert.deepEqual(sequence.map((event) => [event.eventName, event.subEventName, event.playerId]), [
    ['Shot', 'Shot', 25413], ['Save attempt', 'Reflexes', 8480],
    ['Free Kick', 'Corner', 49876], ['Shot', 'Shot', 26010],
  ])
  assert.ok(sequence.every((event, index) => index === 0 || sequence[index - 1].eventSec < event.eventSec))
  assert.ok(sequence[1].tags.some(({ id }) => id === 1801))
  assert.ok(isGoal(sequence[3]))
})

test('a named scorer window cannot anchor to an opponent goal or reveal a future goal', async () => {
  const request = {
    opinion: 'Leicester were comfortable in the ten minutes before Giroud scored.',
    selectedClock: { period: 2, minute: 86 },
    period: 'match-so-far',
    datasetId: DATASET_ID,
  }
  const result = await analyzeOpinion(request)
  assert.deepEqual(result.claims[0].claim.timePeriod, {
    kind: 'before-event', eventId: '177960902', lookbackSeconds: 600,
  })
  const earlier = await analyzeOpinion({ ...request, selectedClock: { period: 2, minute: 80 } })
  assert.equal(earlier.claims[0].assessment, 'clarification needed')
  assert.match(earlier.claims[0].claim.clarificationNeeds.join(' '), /Which spell/)
  assert.doesNotMatch(JSON.stringify(earlier), /177960902|39:34|winner|winning goal/i)
})

test('Foundry receives fixture teams and an eligible goal for a bounded shot question', async () => {
  const opinion = 'Did Leicester get a shot off in the ten minutes before Giroud scored?'
  const request = {
    opinion,
    selectedClock: { period: 2, minute: 85 },
    period: 'match-so-far',
    datasetId: DATASET_ID,
  }
  const anchor = { eventId: String(WINNING_GOAL_ID), relationship: 'Giroud scored the winning goal' }
  const interpretation = {
    claims: [{
      id: 'claim-1',
      subject: 'Eastport',
      playerSubject: null,
      playerMetric: null,
      text: 'How many shots did Eastport have?',
      intent: 'statistical-request',
      meaning: {
        category: 'other',
        description: 'Recorded Eastport shots in the ten minutes before Giroud scored.',
        comparison: null,
      },
      requiredEvidence: ['shots'],
      timePeriod: { kind: 'before-event', eventId: anchor.eventId, lookbackSeconds: 600 },
      historicalEventAnchor: anchor,
      clarificationNeeds: [],
    }],
  }
  const sent = []
  const provider = new FoundryInterpretationProvider(
    { baseUrl: 'https://example.invalid/openai/v1', apiKey: 'offline-only', deployment: 'stub' },
    async (_url, init) => {
      sent.push(JSON.parse(init.body))
      return new Response(JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(interpretation) } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  )

  const result = await analyzeOpinion(request, provider)
  assert.equal(sent.length, 1)
  const body = sent[0]
  const claimSchema = body.response_format.json_schema.schema.properties.claims.items
  const periodSchema = claimSchema.properties.timePeriod
  assert.deepEqual(periodSchema.required, ['kind', 'eventId', 'lookbackSeconds'])
  assert.deepEqual(periodSchema.properties.lookbackSeconds.anyOf, [
    { type: 'integer' }, { type: 'null' },
  ])
  assert.deepEqual(claimSchema.properties.subject.anyOf[0].enum, ['Northbridge', 'Eastport'])
  assert.match(body.messages[0].content, /A yes\/no question asking whether a team recorded any actions/)
  assert.match(body.messages[0].content, /statistic about one team may be scoped before the other team's goal/)
  const context = JSON.parse(body.messages[1].content)
  assert.deepEqual(context.availableTeams, ['Northbridge', 'Eastport'])
  assert.deepEqual(context.availablePlayers, [])
  assert.deepEqual(context.winningGoal, {
    eventId: '177960902',
    sourcePlayerId: '26010',
    scorerAliases: ['Giroud', 'Olivier Giroud'],
  })
  assert.ok(context.availableEvents.some(({ id, type, outcome, playerId }) =>
    id === '177960902' && type === 'shot' && outcome === 'goal' && playerId === '26010'))
  assert.equal(result.provider, 'foundry')
  const claim = result.claims[0]
  assert.equal(claim.claim.subject, 'Leicester City')
  assert.deepEqual(claim.claim.requiredEvidence, ['shots'])
  assert.deepEqual(claim.claim.timePeriod, {
    kind: 'before-event',
    eventId: '177960902',
    lookbackSeconds: 600,
  })
  assert.match(claim.periodLabel, /2H 29:34\.621 inclusive up to, but excluding, 2H 39:34\.621/)
  assert.deepEqual(claim.statistics, [{ team: 'Leicester City', metric: 'shots', value: 0 }])
  assert.deepEqual(
    claim.calculations.map(({ team, metric, numerator, denominator, numeratorRecordIds }) => ({
      team, metric, numerator, denominator, numeratorRecordIds,
    })),
    [{ team: 'Leicester City', metric: 'shots', numerator: 0, denominator: 0, numeratorRecordIds: [] }],
  )

  const beforeGoal = { ...request, selectedClock: { period: 2, minute: 84 } }
  await assert.rejects(analyzeOpinion(beforeGoal, provider), {
    category: 'semantic-validation',
    message: 'Claim 1 time period is invalid or references an unavailable event.',
  })
  const earlierContext = JSON.parse(sent[1].messages[1].content)
  assert.equal(earlierContext.winningGoal, undefined)
  assert.ok(!earlierContext.availableEvents.some(({ id }) => id === '177960902'))

  interpretation.claims[0].timePeriod.eventId = 'unknown-goal'
  interpretation.claims[0].historicalEventAnchor.eventId = 'unknown-goal'
  await assert.rejects(analyzeOpinion(request, provider), {
    category: 'semantic-validation',
    message: 'Claim 1 time period is invalid or references an unavailable event.',
  })

  interpretation.claims[0].timePeriod = {
    kind: 'selected', eventId: null, lookbackSeconds: null,
  }
  interpretation.claims[0].historicalEventAnchor = null
  const selected = await analyzeOpinion(request, provider)
  assert.deepEqual(selected.claims[0].claim.timePeriod, { kind: 'selected' })

  interpretation.claims[0].timePeriod = {
    kind: 'before-event', eventId: String(WINNING_GOAL_ID), lookbackSeconds: null,
  }
  interpretation.claims[0].historicalEventAnchor = {
    eventId: String(WINNING_GOAL_ID), relationship: 'Giroud scored the winning goal',
  }
  const before = await analyzeOpinion(request, provider)
  assert.deepEqual(before.claims[0].claim.timePeriod, {
    kind: 'before-event', eventId: String(WINNING_GOAL_ID),
  })

  for (const invalid of [0, -1, 3601, 1.5, '600']) {
    interpretation.claims[0].timePeriod.lookbackSeconds = invalid
    await assert.rejects(analyzeOpinion(request, provider), {
      category: 'semantic-validation',
      message: 'Claim 1 time period is invalid or references an unavailable event.',
    })
  }
  interpretation.claims[0].timePeriod = {
    kind: 'selected', eventId: null, lookbackSeconds: 600,
  }
  interpretation.claims[0].historicalEventAnchor = null
  const rolling = await analyzeOpinion(request, provider)
  assert.deepEqual(rolling.claims[0].claim.timePeriod, { kind: 'selected', lookbackSeconds: 600 })
})
