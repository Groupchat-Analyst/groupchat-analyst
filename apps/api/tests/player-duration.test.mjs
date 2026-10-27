import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { FoundryInterpretationProvider } from '../dist/api/src/providers/foundry.js'
import { RETURN_MATCH_EVIDENCE } from '../dist/shared/src/returnMatch.js'
import { elapsedMatchMinute } from '../dist/shared/src/matchClock.js'

const capturedCallThree = {
  claims: [
    {
      id: 'c1',
      subject: 'Northbridge',
      playerSubject: {
        id: 'north-player-09',
        name: 'Bukayo Saka',
        team: 'Northbridge',
      },
      playerMetric: null,
      text: 'Bukayo Saka has had a horrible game so far.',
      intent: 'subjective-judgement',
      meaning: {
        category: 'performance-judgement',
        description: "A subjective overall judgement of the player's performance during the match so far.",
        comparison: null,
      },
      requiredEvidence: ['player-events', 'passing', 'shots', 'goals'],
      timePeriod: { kind: 'selected', eventId: null },
      historicalEventAnchor: null,
      clarificationNeeds: [],
    },
  ],
}

function providerWithInterpretation(interpretation, observeContext = () => {}) {
  return new FoundryInterpretationProvider(
    {
      baseUrl: 'https://offline.invalid/openai/v1',
      apiKey: 'offline-stub',
      deployment: 'offline-replay',
    },
    async (_url, init) => {
      const request = JSON.parse(init.body)
      observeContext(JSON.parse(request.messages[1].content))
      return new Response(
        JSON.stringify({
          choices: [{
            finish_reason: 'stop',
            message: { content: JSON.stringify(interpretation) },
          }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    },
  )
}

function analysisRequest(selectedClock, period = 'match-so-far') {
  return {
    opinion: 'Saka has had a horrible game',
    selectedClock,
    period,
    datasetId: 'northbridge-eastport-return-demo',
  }
}

function durationTrace(result, playerId = 'north-player-09') {
  const claim = result.claims[0]
  return {
    claim,
    statistic: claim.playerStatistics.find(
      ({ playerId: id, metric }) => id === playerId && metric === 'minutes-played',
    ),
    trace: claim.playerCalculations.find(
      ({ playerId: id, metric }) => id === playerId && metric === 'minutes-played',
    ),
  }
}

test('replays the captured Foundry call 3 through transport, validation, and service with exact attribution and cutoff', async () => {
  let outboundRequests = 0
  let providerContext
  const provider = providerWithInterpretation(capturedCallThree, (context) => {
    outboundRequests += 1
    providerContext = context
  })
  const result = await analyzeOpinion(
    analysisRequest({ period: 2, minute: 60 }),
    provider,
  )
  const { claim, statistic, trace } = durationTrace(result)

  assert.equal(outboundRequests, 1)
  assert.equal(result.provider, 'foundry')
  assert.equal(result.evidenceFoundation.dataset.id, 'northbridge-eastport-return-demo')
  assert.equal(result.evidenceFoundation.dataset.version, '1.0.0')
  assert.equal(result.selectedTime, '60′')
  assert.equal(result.selectedPeriodLabel, 'Match so far through 60′')
  assert.equal(providerContext.selectedTime, '60′')
  assert.equal(providerContext.selectedPeriod, 'match-so-far')
  assert.ok(providerContext.availableEvents.length > 0)
  assert.ok(providerContext.availableEvents.every(
    ({ clock }) => elapsedMatchMinute(clock) <= elapsedMatchMinute({ period: 2, minute: 60 }),
  ))
  assert.ok(providerContext.availableEvents.some(({ id }) => id === 'return-event-08'))
  assert.ok(!providerContext.availableEvents.some(({ id }) => id === 'return-event-09'))
  assert.ok(!result.periodEvents.some(({ id }) => id === 'return-event-09'))
  assert.equal(claim.claim.playerSubject.id, 'north-player-09')
  assert.equal(claim.claim.playerSubject.name, 'Bukayo Saka')
  assert.equal(claim.claim.playerSubject.team, 'Northbridge')
  assert.ok(claim.playerStatistics.every(
    ({ playerId, playerName, team }) =>
      playerId === 'north-player-09' &&
      playerName === 'Bukayo Saka' &&
      team === 'Northbridge',
  ))
  assert.equal(statistic.value, 62)
  assert.equal(trace.numerator, 62)
  assert.equal(trace.denominator, 62)
  assert.deepEqual(trace.durationWindow, {
    recordedCoverageStart: '1′',
    recordedCoverageEnd: '90+4′',
    selectedWindowStart: '1′',
    selectedWindowEnd: '60′',
    participationStart: '1′',
    participationEnd: '60′',
  })
  assert.match(trace.denominatorDescription, /Selected analysis window \(match clock\): 1′–60′ \(elapsed interval \[1, 63\)\)/)
  assert.match(trace.denominatorDescription, /on-pitch overlap \(match clock\): 1′–60′ \(elapsed interval \[1, 63\)\)/)
  assert.match(trace.denominatorDescription, /Elapsed clock calculation: 63 − 1 = 62 minutes/)
  assert.match(trace.denominatorDescription, /added time is included and the half-time break is excluded/)
  assert.match(result.fanReply, /62 elapsed minutes in the selected recorded window 1′–60′/)
  assert.match(result.fanReply, /added time included, half-time excluded/)
  assert.match(result.summary, /on-pitch interval 1′–60′/)
  assert.equal(claim.playerStatistics.length, 9)
})

test('counts first-half added time as elapsed participation in recorded coverage', async () => {
  const result = await analyzeOpinion(
    analysisRequest({ period: 1, minute: 45, stoppageMinutes: 3 }),
    providerWithInterpretation(capturedCallThree),
  )
  const { statistic, trace } = durationTrace(result)

  assert.equal(statistic.value, 47)
  assert.equal(trace.denominator, 47)
  assert.deepEqual(trace.durationWindow, {
    recordedCoverageStart: '1′',
    recordedCoverageEnd: '90+4′',
    selectedWindowStart: '1′',
    selectedWindowEnd: '45+3′',
    participationStart: '1′',
    participationEnd: '45+3′',
  })
  assert.match(trace.denominatorDescription, /48 − 1 = 47 minutes/)
  assert.ok(!result.periodEvents.some(({ id }) => id === 'return-event-07'))
})

test('keeps the second-half boundary continuous while excluding future events', async () => {
  let providerContext
  const result = await analyzeOpinion(
    analysisRequest({ period: 2, minute: 46 }),
    providerWithInterpretation(capturedCallThree, (context) => {
      providerContext = context
    }),
  )
  const { statistic, trace } = durationTrace(result)

  assert.equal(statistic.value, 48)
  assert.deepEqual(trace.durationWindow, {
    recordedCoverageStart: '1′',
    recordedCoverageEnd: '90+4′',
    selectedWindowStart: '1′',
    selectedWindowEnd: '46′',
    participationStart: '1′',
    participationEnd: '46′',
  })
  assert.match(trace.denominatorDescription, /49 − 1 = 48 minutes/)
  assert.ok(providerContext.availableEvents.some(({ id }) => id === 'return-event-06'))
  assert.ok(!providerContext.availableEvents.some(({ id }) => id === 'return-event-07'))
})

test('clips a rolling window at its elapsed-time start and selected-time end', async () => {
  let providerContext
  const result = await analyzeOpinion(
    analysisRequest({ period: 2, minute: 60 }, 'last-10-minutes'),
    providerWithInterpretation(capturedCallThree, (context) => {
      providerContext = context
    }),
  )
  const { statistic, trace } = durationTrace(result)

  assert.equal(statistic.value, 10)
  assert.equal(trace.denominator, 10)
  assert.deepEqual(trace.durationWindow, {
    recordedCoverageStart: '1′',
    recordedCoverageEnd: '90+4′',
    selectedWindowStart: '50′',
    selectedWindowEnd: '60′',
    participationStart: '50′',
    participationEnd: '60′',
  })
  assert.match(trace.denominatorDescription, /63 − 53 = 10 minutes/)
  assert.ok(providerContext.availableEvents.every(
    ({ clock }) => elapsedMatchMinute(clock) <= elapsedMatchMinute({ period: 2, minute: 60 }),
  ))
})

test('clips participation at recorded substitutions for outgoing and incoming players', async () => {
  const outgoing = RETURN_MATCH_EVIDENCE.players.find(
    ({ id }) => id === 'north-player-10',
  )
  const incoming = RETURN_MATCH_EVIDENCE.players.find(
    ({ id }) => id === 'north-player-12',
  )
  assert.equal(outgoing.name, 'Eberechi Eze')
  assert.equal(incoming.name, 'Ben White')

  for (const [player, expectedMinutes, expectedInterval, expectedSubstitutionId] of [
    [outgoing, 72, ['1′', '70′'], 'substitution-01'],
    [incoming, 5, ['70′', '75′'], 'substitution-01'],
  ]) {
    const interpretation = structuredClone(capturedCallThree)
    const claim = interpretation.claims[0]
    claim.playerSubject = {
      id: player.id,
      name: player.name,
      team: player.team,
    }
    claim.text = `${player.name} has had a horrible game so far.`
    const result = await analyzeOpinion(
      {
        opinion: `${player.name} has had a horrible game`,
        selectedClock: { period: 2, minute: 75 },
        period: 'match-so-far',
        datasetId: 'northbridge-eastport-return-demo',
      },
      providerWithInterpretation(interpretation),
    )
    const { statistic, trace } = durationTrace(result, player.id)

    assert.equal(statistic.value, expectedMinutes)
    assert.deepEqual(
      [trace.durationWindow.participationStart, trace.durationWindow.participationEnd],
      expectedInterval,
    )
    assert.ok(trace.denominatorRecordIds.includes(expectedSubstitutionId))
    assert.ok(!result.periodEvents.some(({ id }) => id === 'return-event-13'))
  }
})
