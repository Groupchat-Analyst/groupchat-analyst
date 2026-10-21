import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { SYNTHETIC_MATCH_EVIDENCE } from '../dist/shared/src/evidence.js'
import { elapsedMatchMinute, SYNTHETIC_MATCH_EVENTS } from '../dist/shared/src/match.js'

const acceptanceOpinion =
  'Eastport controlled possession of the game, Northbridge scored against the run of play.'

function request(opinion = acceptanceOpinion, selectedClock = {
  period: 2,
  minute: 90,
  stoppageMinutes: 4,
}, period = 'match-so-far') {
  return { opinion, selectedClock, period }
}

test('interprets the exact compound opinion as two distinct evidence requests', async () => {
  const result = await analyzeOpinion(request())

  assert.equal(result.provider, 'local')
  assert.match(result.providerLabel, /no model connection/)
  assert.equal(result.claims.length, 2)
  assert.deepEqual(
    result.claims.map(({ claim }) => [claim.subject, claim.text]),
    [
      ['Eastport', 'Eastport controlled possession of the game'],
      ['Northbridge', 'Northbridge scored against the run of play'],
    ],
  )
  assert.deepEqual(result.claims[0].claim.requiredEvidence, ['possession'])
  assert.deepEqual(result.claims[0].claim.timePeriod, { kind: 'selected' })
  assert.equal(result.claims[1].claim.meaning.category, 'historical-circumstance')
  assert.deepEqual(result.claims[1].claim.requiredEvidence, [
    'possession',
    'territorial-control',
    'attacking-events',
  ])
  assert.deepEqual(result.claims[1].claim.timePeriod, {
    kind: 'before-event',
    eventId: 'event-07',
  })
  assert.match(result.summary, /Claim 1 — Eastport/)
  assert.match(result.summary, /Claim 2 — Northbridge/)
  assert.match(result.summary, /event-07 \(Northbridge, 45\+3′\)/)
  assert.match(result.summary, /not continuous field-position/)
  assert.doesNotMatch(result.summary, /criteria|you did not provide/i)
})

test('uses synthetic possession evidence without substituting shooting statistics', async () => {
  const result = await analyzeOpinion(request())
  const eastportClaim = result.claims[0]
  const northbridgeClaim = result.claims[1]

  assert.equal(
    eastportClaim.assessment,
    'insufficient evidence for a firm conclusion',
  )
  assert.ok(eastportClaim.statistics.some(({ metric }) => metric === 'possession-percentage'))
  assert.ok(eastportClaim.evidenceAvailability.some(
    ({ kind, available }) => kind === 'possession' && available,
  ))
  assert.ok(eastportClaim.evidence.every(({ reference }) => !reference.id.startsWith('event-')))
  assert.ok(eastportClaim.statistics.every(({ metric }) => !metric.includes('shot')))
  assert.match(eastportClaim.limitation, /do not establish the full subjective judgement/i)
  assert.ok(
    northbridgeClaim.statistics.every(
      ({ metric }) => metric !== 'shots' && metric !== 'shots-on-target',
    ),
  )
  assert.ok(
    northbridgeClaim.evidenceAvailability.some(
      ({ kind, available }) => kind === 'possession' && available,
    ),
  )
  assert.ok(
    northbridgeClaim.evidenceAvailability.some(
      ({ kind, available }) => kind === 'territorial-control' && !available,
    ),
  )
  assert.ok(
    northbridgeClaim.evidenceAvailability.some(
      ({ kind, available }) => kind === 'attacking-events' && available,
    ),
  )
})

test('anchors run-of-play evidence to the 45+3 goal and excludes the goal from the BEFORE period', async () => {
  const result = await analyzeOpinion(request())
  const claim = result.claims[1]
  const anchor = claim.evidence.find(({ role }) => role === 'anchor')
  const periodEvidence = claim.evidence.filter(({ role }) => role !== 'anchor')

  assert.equal(anchor.reference.id, 'event-07')
  assert.equal(anchor.reference.time, '45+3′')
  assert.match(claim.periodLabel, /strictly before 45\+3′/)
  assert.deepEqual(
    periodEvidence.map(({ reference: item }) => [item.id, item.time]),
    [
      ['event-01', '12′'],
      ['event-02', '18′'],
      ['event-03', '27′'],
      ['event-04', '31′'],
      ['event-05', '38′'],
      ['event-06', '45+2′'],
    ].concat(
      periodEvidence
        .filter(({ reference: item }) => item.id.startsWith('sequence-'))
        .map(({ reference: item }) => [item.id, item.time]),
    ),
  )
  assert.ok(periodEvidence.every(({ reference: item }) =>
    item.id !== 'event-07' &&
    item.id !== 'event-08',
  ))
})

test('historical before-goal evidence is not narrowed by the selected recent-minutes filter', async () => {
  const result = await analyzeOpinion(request(
    acceptanceOpinion,
    { period: 2, minute: 58 },
    'last-10-minutes',
  ))
  const claim = result.claims[1]

  assert.equal(result.selectedPeriodLabel, 'Last 10 minutes ending 58′')
  assert.match(claim.periodLabel, /strictly before 45\+3′/)
  assert.deepEqual(
    claim.evidence
      .filter(
        ({ role, reference }) =>
          role !== 'anchor' && reference.id.startsWith('event-'),
      )
      .map(({ reference: item }) => item.id),
    ['event-01', 'event-02', 'event-03', 'event-04', 'event-05', 'event-06'],
  )
})

test('excludes future events from interpretation, match totals, and claim references', async () => {
  const result = await analyzeOpinion(
    request(
      acceptanceOpinion,
      { period: 1, minute: 45, stoppageMinutes: 2 },
    ),
  )

  assert.deepEqual(result.score, { Northbridge: 0, Eastport: 0 })
  assert.ok(result.periodEvents.every(({ id }) => id !== 'event-07'))
  assert.ok(
    result.claims.every((claim) =>
      claim.evidence.every(({ reference: item }) => item.id !== 'event-07'),
    ),
  )
  const throughSelectedTime = (time) => {
    const [clock, stoppage = '0'] = time.replace('′', '').split('+')
    const elapsed =
      Number(clock) +
      (time.startsWith('45+') ? Number(stoppage) : 0)
    return elapsed <= 47
  }
  assert.ok(result.evidenceFoundation.passReferences.every(({ time }) => throughSelectedTime(time)))
  assert.ok(result.evidenceFoundation.turnoverReferences.every(({ time }) => throughSelectedTime(time)))
  assert.ok(result.evidenceFoundation.possessionIntervals.every(
    ({ end, endReason }) => throughSelectedTime(end) && (!endReason || end !== '45+3′'),
  ))
  assert.deepEqual(result.claims[1].claim.timePeriod, { kind: 'selected' })
  assert.ok(result.claims[1].claim.clarificationNeeds.length > 0)
})

test('rejects invalid model interpretation instead of returning a success-shaped result', async () => {
  const invalidProvider = {
    name: 'foundry',
    async interpret() {
      return {
        claims: [
          {
            id: 'claim-1',
            subject: 'Rovers',
            text: 'Rovers had more shots',
          },
        ],
      }
    },
  }

  await assert.rejects(
    analyzeOpinion(request('Northbridge had more shots'), invalidProvider),
    /missing or unexpected fields/,
  )
})

test('rejects client-supplied statistics and invalid selected times', async () => {
  await assert.rejects(
    analyzeOpinion({ ...request(''), statistics: { Northbridge: 99 } }),
    /must contain only opinion, selectedClock, and period/,
  )
  await assert.rejects(
    analyzeOpinion(request('', { period: 1, minute: 46 })),
    /Selected match time is invalid/,
  )
})

test('keeps precise count comparisons and negation on the server-side path', async () => {
  const supported = await analyzeOpinion(
    request('Eastport had more shots on target than Northbridge', {
      period: 2,
      minute: 58,
    }),
  )
  const negated = await analyzeOpinion(
    request('Northbridge did not have more shots than Eastport', {
      period: 2,
      minute: 58,
    }),
  )

  assert.equal(supported.claims[0].assessment, 'supported')
  assert.deepEqual(
    supported.claims[0].statistics.map(({ team, value }) => [team, value]),
    [
      ['Northbridge', 2],
      ['Eastport', 3],
    ],
  )
  assert.equal(negated.claims[0].assessment, 'supported')
  assert.equal(negated.claims[0].claim.meaning.comparison.operator, 'less-or-equal')
})

test('assesses an explicit possession comparison from interval-derived percentages', async () => {
  const result = await analyzeOpinion(
    request('Northbridge had more possession than Eastport'),
  )
  const claim = result.claims[0]
  const possessionStats = claim.statistics.filter(
    ({ metric }) => metric === 'possession-percentage',
  )

  assert.equal(claim.assessment, 'supported')
  assert.deepEqual(
    possessionStats.map(({ team, value }) => [team, value]),
    [
      ['Northbridge', 56],
      ['Eastport', 44],
    ],
  )
  assert.ok(claim.evidence.some(({ reference }) => reference.id.startsWith('sequence-')))
  assert.match(claim.limitation, /controlled-possession minutes/i)
  assert.equal(result.evidenceFoundation.dataset.provenance, 'synthetic')
  assert.equal(result.evidenceFoundation.possessionDenominatorMinutes, 91)
  assert.equal(result.evidenceFoundation.possessionCoverageComplete, true)
})

test('returns build-up loss locations for a coaching question without claiming tactical causes', async () => {
  const result = await analyzeOpinion(
    request('Where is Northbridge losing possession during build-up?'),
  )
  const claim = result.claims[0]

  assert.equal(claim.claim.subject, 'Northbridge')
  assert.equal(claim.claim.meaning.category, 'coaching-question')
  assert.equal(claim.assessment, 'insufficient evidence for a firm conclusion')
  assert.ok(claim.evidence.some(({ reference }) => reference.id.startsWith('turnover-')))
  assert.match(claim.limitation, /defensive-third/i)
  assert.match(claim.limitation, /do not establish why possession was lost/i)
  assert.ok(result.evidenceFoundation.teams.Northbridge.possessionLosses['defensive-third'] > 0)
  assert.ok(result.evidenceFoundation.teams.Northbridge.finalThirdEntries > 0)
})

test('answers the unassigned “we” coaching question for both teams without guessing a side', async () => {
  const result = await analyzeOpinion(
    request('Where are we losing possession during build-up?'),
  )
  const claim = result.claims[0]

  assert.equal(claim.claim.subject, null)
  assert.deepEqual(claim.claim.clarificationNeeds, [])
  assert.equal(claim.assessment, 'insufficient evidence for a firm conclusion')
  assert.ok(claim.evidence.some(({ reference }) => reference.id.startsWith('turnover-')))
  assert.match(claim.limitation, /selected-sample build-up annotations/i)
  assert.match(claim.limitation, /do not establish why possession was lost/i)
})

test('assesses equal-goal claims at the selected time without including later goals', async () => {
  const opinion = 'Eastport have the same number of goals as Northbridge.'
  const beforeEastportGoal = await analyzeOpinion(
    request(opinion, { period: 2, minute: 57 }),
  )
  const afterEastportGoal = await analyzeOpinion(
    request(opinion, { period: 2, minute: 58 }),
  )

  assert.equal(beforeEastportGoal.claims[0].claim.meaning.category, 'factual-comparison')
  assert.equal(beforeEastportGoal.score.Northbridge, 1)
  assert.equal(beforeEastportGoal.score.Eastport, 0)
  assert.equal(beforeEastportGoal.claims[0].assessment, 'contradicted')
  assert.ok(
    beforeEastportGoal.claims[0].evidence.every(
      ({ reference: item }) => item.id !== 'event-10',
    ),
  )

  assert.equal(afterEastportGoal.score.Northbridge, 1)
  assert.equal(afterEastportGoal.score.Eastport, 1)
  assert.equal(afterEastportGoal.claims[0].assessment, 'supported')
  assert.ok(
    afterEastportGoal.claims[0].evidence.every(({ reference: item }) =>
      ['event-07', 'event-10'].includes(item.id),
    ),
  )
})

test('resolves explicit team mentions before an initial match pronoun in a compound opinion', async () => {
  const opinion =
    'Eastport dominated possession during this game and Northbridge scored against the run of play. It was a comfortable match for Eastport.'
  const result = await analyzeOpinion(request(opinion))

  assert.equal(result.claims.length, 3)
  assert.deepEqual(
    result.claims.map(({ claim }) => [claim.subject, claim.text]),
    [
      ['Eastport', 'Eastport dominated possession during this game'],
      ['Northbridge', 'Northbridge scored against the run of play'],
      ['Eastport', 'It was a comfortable match for Eastport'],
    ],
  )
  const comfortableClaim = result.claims[2]
  assert.notEqual(
    comfortableClaim.claim.meaning.category,
    'factual-comparison',
  )
  assert.equal(
    comfortableClaim.assessment,
    'insufficient evidence for a firm conclusion',
  )
  assert.ok(comfortableClaim.evidence.some(({ role }) => role === 'context'))
  assert.match(
    comfortableClaim.limitation,
    /do not establish the full subjective judgement/i,
  )
  assert.doesNotMatch(comfortableClaim.limitation, /scoreline|shot counts prove/i)
  assert.deepEqual(result.claims[1].claim.timePeriod, {
    kind: 'before-event',
    eventId: 'event-07',
  })
})

test('resolves a single explicitly named team in an otherwise match-referential sentence', async () => {
  const result = await analyzeOpinion(
    request('It was a comfortable match for Eastport'),
  )
  const claim = result.claims[0]

  assert.equal(claim.claim.subject, 'Eastport')
  assert.equal(claim.assessment, 'insufficient evidence for a firm conclusion')
  assert.ok(claim.evidence.some(({ role }) => role === 'context'))
  assert.match(claim.limitation, /full subjective judgement/i)
})

test('asks a focused clarification and withholds unrelated evidence for an ambiguous subject', async () => {
  const result = await analyzeOpinion(request('It was comfortable for them.'))
  const claim = result.claims[0]

  assert.equal(claim.claim.subject, null)
  assert.equal(claim.assessment, 'clarification needed')
  assert.match(claim.claim.clarificationNeeds[0], /Which team does “them” refer to/)
  assert.equal(claim.statistics.length, 0)
  assert.equal(claim.evidenceAvailability.length, 0)
  assert.equal(claim.evidence.length, 0)
})

test('treats a pass-completion comparison as one statistical request across a team conjunction', async () => {
  const result = await analyzeOpinion(
    request("Compare Northbridge and Eastport's pass completion rates."),
  )
  const claim = result.claims[0]
  const traces = claim.calculations

  assert.equal(result.claims.length, 1)
  assert.equal(claim.claim.intent, 'statistical-request')
  assert.equal(claim.claim.subject, 'Northbridge')
  assert.equal(claim.claim.meaning.category, 'factual-comparison')
  assert.equal(claim.assessment, 'statistics provided')
  assert.deepEqual(
    claim.statistics.map(({ team, metric, value }) => [team, metric, value]),
    [
      ['Northbridge', 'pass-attempts', 38],
      ['Northbridge', 'pass-completions', 30],
      ['Northbridge', 'pass-completion-percentage', 78.9],
      ['Eastport', 'pass-attempts', 32],
      ['Eastport', 'pass-completions', 23],
      ['Eastport', 'pass-completion-percentage', 71.9],
    ],
  )
  for (const team of ['Northbridge', 'Eastport']) {
    const trace = traces.find(
      ({ team: traceTeam }) => traceTeam === team,
    )
    const fixturePassIds = result.evidenceFoundation.passReferences
      .filter(({ team: passTeam }) => passTeam === team)
      .map(({ id }) => id)
    assert.equal(trace.denominator, fixturePassIds.length)
    assert.deepEqual(trace.denominatorRecordIds, fixturePassIds)
    assert.equal(trace.numeratorRecordIds.length, trace.numerator)
    assert.match(trace.denominatorDescription, /all .* recorded pass attempts/i)
  }
  assert.equal(
    claim.evidence.filter(({ role }) => role === 'calculation').length,
    result.evidenceFoundation.passReferences.length,
  )
  assert.match(result.summary, /Northbridge 30\/38 \(78\.9%\)/)
  assert.match(result.summary, /Eastport 23\/32 \(71\.9%\)/)
  assert.doesNotMatch(result.summary, /denominator all 38 recorded passes/)
  assert.match(result.summary, /Example references \(abbreviated\)/)
  assert.match(result.summary, /statistics provided/)
})

test('recognizes a running-distance comparison but returns only the specific unavailable-data limitation', async () => {
  const result = await analyzeOpinion(
    request('Eastport ran further than Northbridge.'),
  )
  const claim = result.claims[0]

  assert.equal(result.claims.length, 1)
  assert.equal(claim.claim.intent, 'unavailable-metric')
  assert.equal(claim.claim.subject, 'Eastport')
  assert.equal(claim.claim.meaning.comparison.metric, 'running-distance')
  assert.equal(claim.assessment, 'unavailable data')
  assert.deepEqual(claim.statistics, [])
  assert.deepEqual(claim.evidence, [])
  assert.match(claim.limitation, /running distance.*not recorded/i)
  assert.doesNotMatch(claim.limitation, /shots|shooting/i)
  assert.equal(claim.evidenceAvailability.length, 1)
  assert.equal(claim.evidenceAvailability[0].kind, 'physical-measurements')
})

test('limits Eastport build-up question evidence to its turnovers and their linked passes', async () => {
  const result = await analyzeOpinion(
    request('Where are Eastport losing possession during build-up?'),
  )
  const claim = result.claims[0]
  const expectedTurnoverIds = SYNTHETIC_MATCH_EVIDENCE.buildUpAnnotations
    .filter(({ team }) => team === 'Eastport')
    .flatMap(({ turnoverIds }) => turnoverIds)
  const evidenceTurnoverIds = claim.evidence
    .map(({ reference }) => reference.id)
    .filter((id) => id.startsWith('turnover-'))
  const evidencePassIds = claim.evidence
    .map(({ reference }) => reference.id)
    .filter((id) => id.startsWith('pass-'))
  const linkedPassIds = claim.evidence
    .filter(({ reference }) => reference.id.startsWith('turnover-'))
    .map(({ reference }) => reference.description.match(/linked pass (pass-\d+)/i)?.[1])

  assert.equal(claim.claim.subject, 'Eastport')
  assert.equal(claim.claim.intent, 'coaching-question')
  assert.deepEqual(evidenceTurnoverIds, expectedTurnoverIds)
  assert.equal(evidencePassIds.length, expectedTurnoverIds.length)
  assert.ok(linkedPassIds.every((id) => id && evidencePassIds.includes(id)))
  assert.equal(new Set(evidencePassIds).size, evidencePassIds.length)
  assert.equal(claim.calculations.length, 3)
  assert.deepEqual(
    claim.calculations.map(({ area, value }) => [area, value]),
    [
      ['defensive-third', 0],
      ['middle-third', 2],
      ['final-third', 1],
    ],
  )
  assert.ok(claim.calculations.every(({ denominator }) => denominator === 3))
  assert.match(claim.limitation, /selected-sample build-up annotations/i)
  assert.match(claim.limitation, /filtered result/i)
  assert.match(claim.limitation, /do not establish why possession was lost/i)
  assert.match(
    result.summary,
    /Eastport: defensive-third 0, middle-third 2, final-third 1 \(3 recorded turnovers\)/,
  )
  assert.match(result.summary, /Example references \(abbreviated\): turnover-/)
  assert.match(result.summary, /pass-\d+ \(Eastport,/)
})

test('identifies Eastport possession counterevidence without reducing broader dominance to possession', async () => {
  const result = await analyzeOpinion(
    request(
      'Eastport dominated possession during this game and Northbridge scored against the run of play. It was a comfortable match for Eastport.',
    ),
  )
  const [dominance, runOfPlay, comfortable] = result.claims

  assert.equal(result.claims.length, 3)
  assert.deepEqual(
    result.claims.map(({ claim }) => [claim.subject, claim.intent]),
    [
      ['Eastport', 'subjective-judgement'],
      ['Northbridge', 'factual-claim'],
      ['Eastport', 'subjective-judgement'],
    ],
  )
  assert.deepEqual(
    dominance.statistics.map(({ team, value }) => [team, value]),
    [
      ['Northbridge', 56],
      ['Eastport', 44],
    ],
  )
  assert.match(dominance.limitation, /Eastport recorded 44%.*Northbridge's 56%/)
  assert.match(dominance.limitation, /challenges the possession-majority aspect/)
  assert.ok(dominance.evidence.some(({ role, reference }) =>
    role === 'supporting' && reference.team === 'Northbridge',
  ))
  assert.ok(dominance.evidence.some(({ role, reference }) =>
    role === 'challenging' && reference.team === 'Eastport',
  ))
  assert.equal(runOfPlay.claim.historicalEventAnchor.eventId, 'event-07')
  assert.ok(runOfPlay.evidence.every(({ role, reference }) =>
    role === 'anchor' || !reference.id.startsWith('event-') || reference.id < 'event-07',
  ))
  assert.equal(comfortable.claim.subject, 'Eastport')
  assert.equal(comfortable.assessment, 'insufficient evidence for a firm conclusion')
  assert.match(comfortable.limitation, /do not establish the full subjective judgement/i)
  assert.ok(
    result.claims[1].evidence
      .filter(({ role }) => role !== 'anchor')
      .filter(({ reference }) => reference.id.startsWith('pass-') || reference.id.startsWith('turnover-'))
      .every(({ reference }) => {
        const match = reference.time.match(/^(\d+)(?:\+(\d+))?′$/)
        if (!match) return true
        const elapsed = Number(match[1]) + Number(match[2] ?? 0)
        return elapsed < 48
      }),
  )
})

test('keeps team coordination inside statistical requests but splits separate team claims', async () => {
  const paraphrase = await analyzeOpinion(
    request('How do Northbridge and Eastport compare on passing accuracy?'),
  )
  const compound = await analyzeOpinion(
    request(
      "Compare Northbridge and Eastport's pass completion rates. Eastport had more shots than Northbridge.",
    ),
  )

  assert.equal(paraphrase.claims.length, 1)
  assert.equal(paraphrase.claims[0].claim.intent, 'statistical-request')
  assert.equal(compound.claims.length, 2)
  assert.equal(compound.claims[0].claim.intent, 'statistical-request')
  assert.equal(compound.claims[1].claim.intent, 'factual-claim')
})

test('labels unsupported explicit-team wording as unrecognized without retrieving unrelated evidence', async () => {
  const result = await analyzeOpinion(request('Eastport glimmered under the moon.'))
  const claim = result.claims[0]

  assert.equal(claim.claim.intent, 'unrecognized-language')
  assert.equal(claim.assessment, 'unrecognized language')
  assert.deepEqual(claim.statistics, [])
  assert.deepEqual(claim.evidenceAvailability, [])
  assert.deepEqual(claim.evidence, [])
  assert.match(claim.limitation, /cannot reliably identify/i)
})

test('assesses pass-completion assertions from passing evidence in either direction', async () => {
  const eastportHigher = await analyzeOpinion(
    request('Eastport completed a higher percentage of their passes than Northbridge.'),
  )
  const northbridgeHigher = await analyzeOpinion(
    request('Northbridge completed a higher percentage of their passes than Eastport.'),
  )

  assert.equal(eastportHigher.claims[0].assessment, 'contradicted')
  assert.equal(northbridgeHigher.claims[0].assessment, 'supported')
  for (const result of [eastportHigher, northbridgeHigher]) {
    const claim = result.claims[0]
    assert.equal(claim.claim.meaning.comparison.metric, 'pass-completion-percentage')
    assert.ok(claim.evidenceAvailability.some(
      ({ kind, available }) => kind === 'passing' && available,
    ))
    assert.deepEqual(
      claim.statistics.map(({ team, value }) => [team, value]),
      [
        ['Northbridge', 78.9],
        ['Eastport', 71.9],
      ],
    )
    assert.deepEqual(
      claim.calculations.map(({ team, numerator, denominator, value }) =>
        [team, numerator, denominator, value]),
      [
        ['Northbridge', 30, 38, 78.9],
        ['Eastport', 23, 32, 71.9],
      ],
    )
    assert.equal(claim.calculations[0].denominatorRecordIds.length, 38)
    assert.equal(claim.calculations[1].denominatorRecordIds.length, 32)
  }
})

test('preserves player comparison roles and negation in either player order', async () => {
  const cases = [
    ['Amad completed a higher percentage of his passes than Saka.', 'supported', 'Amad', 'Saka', 'pass-completion-percentage', 'greater-than'],
    ['Amad had more shots than Saka.', 'contradicted', 'Amad', 'Saka', 'shots', 'greater-than'],
    ['Saka did not have a higher pass completion rate than Amad.', 'supported', 'Saka', 'Amad', 'pass-completion-percentage', 'less-or-equal'],
    ['Saka had no more shots than Amad.', 'contradicted', 'Saka', 'Amad', 'shots', 'less-or-equal'],
  ]
  for (const [text, assessment, subject, opponent, metric, operator] of cases) {
    const result = await analyzeOpinion(request(text))
    const claim = result.claims[0]
    assert.equal(claim.assessment, assessment, text)
    assert.equal(claim.claim.playerSubject.name.endsWith(subject), true, text)
    assert.equal(claim.claim.meaning.comparison.opponentPlayer.name.endsWith(opponent), true, text)
    assert.equal(claim.claim.meaning.comparison.metric, metric, text)
    assert.equal(claim.claim.meaning.comparison.operator, operator, text)
  }
})

test('distinguishes completed pass counts, attempts, and completion percentages', async () => {
  const completed = await analyzeOpinion(
    request('Saka completed more passes than Amad.'),
  )
  assert.equal(completed.claims[0].claim.meaning.comparison.metric, 'pass-completions')
  assert.equal(completed.claims[0].assessment, 'contradicted')
  assert.deepEqual(
    completed.claims[0].playerStatistics.map(({ playerName, value }) => [playerName, value]),
    [['Bukayo Saka', 2], ['Amad', 2]],
  )

  const countRequest = await analyzeOpinion(
    request('Compare Saka and Amad pass completion counts.'),
  )
  assert.equal(countRequest.claims[0].claim.meaning.comparison.metric, 'pass-completions')
  assert.equal(countRequest.claims[0].assessment, 'statistics provided')
  assert.deepEqual(
    countRequest.claims[0].playerStatistics.map(({ playerName, metric, value }) => [
      playerName,
      metric,
      value,
    ]),
    [
      ['Bukayo Saka', 'pass-completions', 2],
      ['Amad', 'pass-completions', 2],
    ],
  )

  const attemptsRequest = await analyzeOpinion(
    request('How many passes did Saka make?'),
  )
  assert.equal(attemptsRequest.claims[0].claim.playerMetric, 'pass-attempts')
  assert.equal(attemptsRequest.claims[0].playerStatistics[0].value, 4)
})

test('assesses a valid typed pass-completion interpretation independently of local parsing', async () => {
  const interpretedClaim = {
    id: 'claim-1',
    subject: 'Eastport',
    playerSubject: null,
    playerMetric: null,
    text: 'Eastport completed a higher percentage of their passes than Northbridge.',
    intent: 'factual-claim',
    meaning: {
      category: 'factual-comparison',
      description: 'Compare the teams’ recorded pass completion percentages.',
      comparison: {
        opponent: 'Northbridge',
        opponentPlayer: null,
        metric: 'pass-completion-percentage',
        operator: 'greater-than',
      },
    },
    requiredEvidence: ['passing'],
    timePeriod: { kind: 'selected' },
    historicalEventAnchor: null,
    clarificationNeeds: [],
  }
  const typedProvider = {
    name: 'local',
    async interpret() {
      return { claims: [interpretedClaim] }
    },
  }
  const result = await analyzeOpinion(
    request(interpretedClaim.text),
    typedProvider,
  )

  assert.equal(result.claims[0].assessment, 'contradicted')
  assert.deepEqual(
    result.claims[0].statistics.map(({ team, value }) => [team, value]),
    [['Northbridge', 78.9], ['Eastport', 71.9]],
  )
  assert.equal(result.claims[0].calculations.length, 2)
  assert.ok(result.claims[0].evidence.some(
    ({ reference }) => reference.id === 'pass-006',
  ))
})

test('returns a valid single-team statistical answer for a shots question', async () => {
  const result = await analyzeOpinion(request('How many shots did Eastport have?'))
  const claim = result.claims[0]

  assert.equal(claim.claim.intent, 'statistical-request')
  assert.equal(claim.claim.subject, 'Eastport')
  assert.equal(claim.assessment, 'statistics provided')
  assert.deepEqual(claim.statistics, [
    { team: 'Eastport', metric: 'shots', value: 8 },
  ])
})

test('keeps metric identity and verdict invariant to capitalization', async () => {
  const lower = await analyzeOpinion(
    request('Northbridge had more goals than Eastport.', {
      period: 2,
      minute: 57,
    }),
  )
  const upper = await analyzeOpinion(
    request('Northbridge had more GOALS than Eastport.', {
      period: 2,
      minute: 57,
    }),
  )
  const uppercaseShotsOnTarget = await analyzeOpinion(
    request('Eastport had more SHOTS ON TARGET than Northbridge.', {
      period: 2,
      minute: 58,
    }),
  )
  const uppercasePossession = await analyzeOpinion(
    request('Northbridge had more POSSESSION than Eastport.', {
      period: 2,
      minute: 57,
    }),
  )

  assert.equal(lower.claims[0].assessment, 'supported')
  assert.equal(upper.claims[0].assessment, 'supported')
  assert.equal(upper.claims[0].claim.meaning.comparison.metric, 'goals')
  assert.deepEqual(
    upper.claims[0].statistics.map(({ metric, value }) => [metric, value]),
    [['goals', 1], ['goals', 0]],
  )
  assert.equal(uppercaseShotsOnTarget.claims[0].assessment, 'supported')
  assert.equal(
    uppercaseShotsOnTarget.claims[0].claim.meaning.comparison.metric,
    'shots-on-target',
  )
  assert.equal(uppercasePossession.claims[0].assessment, 'supported')
  assert.equal(
    uppercasePossession.claims[0].claim.meaning.comparison.metric,
    'possession-percentage',
  )
})

test('describes possession shares as supporting or challenging only the majority aspect', async () => {
  const northbridgeClaim = await analyzeOpinion(
    request('Northbridge controlled possession of the game.'),
  )
  const eastportClaim = await analyzeOpinion(
    request('Eastport controlled possession of the game.'),
  )
  const northbridge = northbridgeClaim.claims[0]
  const eastport = eastportClaim.claims[0]

  assert.match(northbridge.limitation, /supports the possession-majority aspect/i)
  assert.doesNotMatch(northbridge.limitation, /this challenges the possession-majority/i)
  assert.match(eastport.limitation, /challenges the possession-majority aspect/i)
  assert.ok(northbridge.evidence.some(
    ({ role, reference }) => role === 'supporting' && reference.team === 'Northbridge',
  ))
  assert.ok(northbridge.evidence.some(
    ({ role, reference }) => role === 'challenging' && reference.team === 'Eastport',
  ))
  assert.ok(eastport.evidence.some(
    ({ role, reference }) => role === 'supporting' && reference.team === 'Northbridge',
  ))
  assert.ok(eastport.evidence.some(
    ({ role, reference }) => role === 'challenging' && reference.team === 'Eastport',
  ))
  assert.match(northbridge.limitation, /do not establish the full subjective judgement/i)
})

test('keeps zero-attempt pass percentages unavailable instead of reporting zero percent', async () => {
  const result = await analyzeOpinion(
    request("Compare Northbridge and Eastport's pass completion rates.", {
      period: 1,
      minute: 1,
    }),
  )
  const claim = result.claims[0]

  assert.equal(claim.assessment, 'statistics provided')
  assert.ok(claim.statistics.every(
    ({ metric, value }) =>
      metric !== 'pass-completion-percentage' || value === null,
  ))
  assert.ok(claim.calculations.every(
    ({ numerator, denominator, value }) =>
      numerator === 0 && denominator === 0 && value === null,
  ))
  assert.doesNotMatch(result.summary, /0\/0 \(0%\)|completion percentage;?[^.]*0%/i)
  assert.match(result.summary, /rate unavailable/i)
  assert.match(claim.limitation, /no attempts are recorded/i)
})

test('does not report a pass rate when coverage is incomplete', async () => {
  const fixture = structuredClone(SYNTHETIC_MATCH_EVIDENCE)
  fixture.coverage.missingPeriods = ['Second half 70′–75′']
  const result = await analyzeOpinion(
    request("Compare Northbridge and Eastport's pass completion rates."),
    undefined,
    fixture,
  )
  const claim = result.claims[0]

  assert.equal(
    claim.evidenceAvailability.find(({ kind }) => kind === 'passing').available,
    false,
  )
  assert.ok(claim.statistics.every(
    ({ metric, value }) =>
      metric !== 'pass-completion-percentage' || value === null,
  ))
  assert.ok(claim.calculations.every(({ value }) => value === null))
  assert.match(claim.limitation, /pass coverage is incomplete/i)
  assert.doesNotMatch(result.summary, /\d+\/\d+ \(\d+(?:\.\d+)?%\)/)
})

test('splits a coordinated unresolved judgement instead of applying the first verdict to both', async () => {
  const result = await analyzeOpinion(
    request('Northbridge had more possession than Eastport and were comfortable.'),
  )

  assert.equal(result.claims.length, 2)
  assert.equal(result.claims[0].claim.meaning.category, 'factual-comparison')
  assert.equal(result.claims[0].assessment, 'supported')
  assert.equal(result.claims[1].claim.text, 'were comfortable')
  assert.equal(result.claims[1].assessment, 'clarification needed')
  assert.equal(result.claims[1].claim.subject, null)
  assert.deepEqual(result.claims[1].statistics, [])
  assert.deepEqual(result.claims[1].calculations, [])
  assert.deepEqual(result.claims[1].evidence, [])
  assert.match(result.summary, /Claim 1 — Northbridge: supported/)
  assert.match(result.summary, /Claim 2 — Unclear subject: clarification needed/)
})

test('labels turnover counts by team and reports the correct combined total', async () => {
  const result = await analyzeOpinion(
    request('Where are we losing possession during build-up?'),
  )

  assert.match(
    result.summary,
    /Northbridge: defensive-third 2, middle-third 2, final-third 1 \(5 recorded turnovers\)/,
  )
  assert.match(
    result.summary,
    /Eastport: defensive-third 0, middle-third 2, final-third 1 \(3 recorded turnovers\)/,
  )
  assert.match(result.summary, /8 combined recorded turnovers/)
  assert.match(result.summary, /selected-sample build-up annotations/i)
  assert.match(result.summary, /do not establish why possession was lost/i)
})

test('withholds all statistics, evidence and calculation traces until an ambiguous subject is resolved', async () => {
  const result = await analyzeOpinion(request('They dominated possession.'))
  const claim = result.claims[0]

  assert.equal(claim.assessment, 'clarification needed')
  assert.equal(claim.claim.subject, null)
  assert.deepEqual(claim.statistics, [])
  assert.deepEqual(claim.evidenceAvailability, [])
  assert.deepEqual(claim.evidence, [])
  assert.deepEqual(claim.calculations, [])
})

test('excludes point events exactly at a historical anchor from pass rates and references', async () => {
  const fixture = structuredClone(SYNTHETIC_MATCH_EVIDENCE)
  fixture.passes.push({
    id: 'pass-exact-goal-anchor',
    possessionId: 'north-possession-09',
    team: 'Northbridge',
    playerId: 'north-player-01',
    receiverId: 'north-player-02',
    clock: { period: 1, minute: 45, stoppageMinutes: 3 },
    start: { x: 40, y: 50 },
    end: { x: 55, y: 50 },
    outcome: 'complete',
    qualifiers: [],
    provenance: 'synthetic',
  })
  const historicalPassClaim = {
    id: 'claim-1',
    subject: 'Northbridge',
    playerSubject: null,
    playerMetric: null,
    text: 'Northbridge had a higher pass completion percentage than Eastport before the goal.',
    intent: 'factual-claim',
    meaning: {
      category: 'factual-comparison',
      description: 'Compare pass completion before the goal.',
      comparison: {
        opponent: 'Eastport',
        opponentPlayer: null,
        metric: 'pass-completion-percentage',
        operator: 'greater-than',
      },
    },
    requiredEvidence: ['passing'],
    timePeriod: { kind: 'before-event', eventId: 'event-07' },
    historicalEventAnchor: {
      eventId: 'event-07',
      relationship: 'Before the Northbridge goal',
    },
    clarificationNeeds: [],
  }
  const historicalProvider = {
    name: 'local',
    async interpret() {
      return { claims: [historicalPassClaim] }
    },
  }
  const result = await analyzeOpinion(
    request(historicalPassClaim.text),
    historicalProvider,
    fixture,
  )
  const claim = result.claims[0]
  const trace = claim.calculations.find(
    ({ team }) => team === 'Northbridge',
  )

  assert.equal(trace.denominatorRecordIds.includes('pass-exact-goal-anchor'), false)
  assert.equal(trace.denominator, trace.denominatorRecordIds.length)
  assert.ok(claim.evidence.every(
    ({ reference }) => reference.id !== 'pass-exact-goal-anchor',
  ))
  assert.equal(
    result.evidenceFoundation.passReferences.some(
      ({ id }) => id === 'pass-exact-goal-anchor',
    ),
    true,
  )
})

test('attributes Saka performance evidence and calculations only to his recorded actions', async () => {
  const result = await analyzeOpinion(request('How did Saka perform?'))
  const claim = result.claims[0]
  const player = claim.claim.playerSubject
  const expectedPasses = result.evidenceFoundation.passRecords.filter(
    ({ playerId }) => playerId === 'north-player-09',
  )
  const expectedShots = SYNTHETIC_MATCH_EVENTS.filter(
    (event) =>
      event.type === 'shot' &&
      event.playerId === 'north-player-09' &&
      elapsedMatchMinute(event.clock) <= elapsedMatchMinute(request().selectedClock),
  )

  assert.equal(player.id, 'north-player-09')
  assert.equal(player.name, 'Bukayo Saka')
  assert.equal(claim.claim.subject, 'Northbridge')
  assert.equal(claim.assessment, 'insufficient evidence for a firm conclusion')
  assert.deepEqual(claim.statistics, [])
  assert.equal(
    claim.playerStatistics.find(({ metric }) => metric === 'pass-attempts').value,
    expectedPasses.length,
  )
  assert.equal(
    claim.playerStatistics.find(({ metric }) => metric === 'shots').value,
    expectedShots.length,
  )
  assert.ok(claim.evidence.length > 0)
  assert.ok(claim.evidence.every(({ reference }) =>
    expectedPasses.some(({ id }) => id === reference.id) ||
    expectedShots.some(({ id }) => id === reference.id) ||
    reference.description.includes('north-player-09'),
  ))
  assert.match(claim.limitation, /sparse synthetic actions/i)
  assert.match(claim.limitation, /No overall player rating/i)
})

test('compares Saka and Amad pass completion as one player-statistics request', async () => {
  const result = await analyzeOpinion(
    request('Compare Saka and Amad’s pass completion.'),
  )
  const claim = result.claims[0]
  const northPasses = result.evidenceFoundation.passRecords.filter(
    ({ playerId }) => playerId === 'north-player-09',
  )
  const eastPasses = result.evidenceFoundation.passRecords.filter(
    ({ playerId }) => playerId === 'east-player-09',
  )
  const northCompleted = northPasses.filter(({ outcome }) => outcome === 'complete')
  const eastCompleted = eastPasses.filter(({ outcome }) => outcome === 'complete')

  assert.equal(result.claims.length, 1)
  assert.equal(claim.claim.intent, 'statistical-request')
  assert.equal(claim.claim.playerSubject.id, 'north-player-09')
  assert.equal(claim.claim.meaning.comparison.opponentPlayer.id, 'east-player-09')
  assert.equal(claim.assessment, 'statistics provided')
  assert.deepEqual(claim.statistics, [])
  assert.deepEqual(
    claim.playerStatistics
      .filter(({ metric }) => metric === 'pass-attempts')
      .map(({ playerId, value }) => [playerId, value]),
    [['north-player-09', northPasses.length], ['east-player-09', eastPasses.length]],
  )
  assert.deepEqual(
    claim.playerStatistics
      .filter(({ metric }) => metric === 'pass-completions')
      .map(({ playerId, value }) => [playerId, value]),
    [['north-player-09', northCompleted.length], ['east-player-09', eastCompleted.length]],
  )
  assert.deepEqual(
    claim.playerCalculations
      .filter(({ metric }) => metric === 'pass-completion-percentage')
      .map(({ playerId, numeratorRecordIds, denominatorRecordIds }) => [
        playerId,
        numeratorRecordIds.length,
        denominatorRecordIds.length,
      ]),
    [
      ['north-player-09', northCompleted.length, northPasses.length],
      ['east-player-09', eastCompleted.length, eastPasses.length],
    ],
  )
  assert.match(result.summary, /Bukayo Saka/)
  assert.match(result.summary, /Amad/)
})

test('clarifies the ambiguous first name Bruno without returning unrelated evidence', async () => {
  const result = await analyzeOpinion(request('How did Bruno perform?'))
  const claim = result.claims[0]

  assert.equal(claim.assessment, 'clarification needed')
  assert.equal(claim.claim.playerSubject, null)
  assert.deepEqual(claim.statistics, [])
  assert.deepEqual(claim.playerStatistics, [])
  assert.deepEqual(claim.evidence, [])
  assert.deepEqual(claim.calculations, [])
  assert.match(claim.claim.clarificationNeeds[0], /Bruno Fernandes \(Eastport\)/)
  assert.match(claim.claim.clarificationNeeds[0], /Bruno Guimarães \(Northbridge\)/)
})

test('resolves full-name, case, and accent-free player mentions', async () => {
  const fullName = await analyzeOpinion(
    request('How did BRUNO FERNANDES perform?'),
  )
  const unaccented = await analyzeOpinion(
    request('How did Jurien Timber perform?'),
  )

  assert.equal(fullName.claims[0].claim.playerSubject.id, 'east-player-08')
  assert.equal(unaccented.claims[0].claim.playerSubject.id, 'north-player-02')
  assert.equal(unaccented.claims[0].assessment, 'insufficient evidence for a firm conclusion')
})

test('filters player build-up losses to Rice and cites linked pass and selected pressure', async () => {
  const result = await analyzeOpinion(
    request('Where did Rice lose possession during build-up?'),
  )
  const claim = result.claims[0]
  const expectedTurnovers = result.evidenceFoundation.turnoverRecords.filter(
    ({ playerId }) => playerId === 'north-player-06',
  )

  assert.equal(claim.claim.playerSubject.id, 'north-player-06')
  assert.equal(claim.claim.subject, 'Northbridge')
  assert.ok(claim.claim.requiredEvidence.includes('build-up-phase'))
  assert.ok(expectedTurnovers.length > 0)
  assert.deepEqual(
    claim.evidence
      .filter(({ reference }) => reference.id.startsWith('turnover-'))
      .map(({ reference }) => reference.id),
    expectedTurnovers.map(({ id }) => id),
  )
  for (const turnover of expectedTurnovers) {
    assert.ok(claim.evidence.some(({ reference }) =>
      reference.id === turnover.lostPassId,
    ))
  }
  assert.ok(claim.evidence.some(({ reference }) =>
    reference.id === 'pressure-build-up-01',
  ))
  assert.match(claim.limitation, /selected-sample build-up annotations/i)
  assert.match(claim.limitation, /not a tactical cause|not establish why/i)
})

test('distinguishes a player with no selected-window actions from unavailable pass accuracy', async () => {
  const result = await analyzeOpinion(
    request('How did Saka perform?', { period: 1, minute: 1 }),
  )
  const claim = result.claims[0]
  const statistic = (metric) =>
    claim.playerStatistics.find(({ metric: name }) => name === metric).value

  assert.equal(statistic('minutes-played'), 0)
  assert.equal(statistic('pass-attempts'), 0)
  assert.equal(statistic('pass-completions'), 0)
  assert.equal(statistic('pass-completion-percentage'), null)
  const player = result.evidenceFoundation.players.find(
    ({ id }) => id === 'north-player-09',
  )
  assert.equal(player.participation, 'on-pitch')
  assert.equal(player.selectedWindowActions, 0)
})

test('reports Ben White as not yet on pitch before, and participating after, his introduction', async () => {
  const before = await analyzeOpinion(
    request('How did Ben White perform?', { period: 2, minute: 64 }),
  )
  const after = await analyzeOpinion(
    request('How did Ben White perform?', { period: 2, minute: 84 }),
  )
  const beforePlayer = before.evidenceFoundation.players.find(
    ({ id }) => id === 'north-player-12',
  )
  const afterPlayer = after.evidenceFoundation.players.find(
    ({ id }) => id === 'north-player-12',
  )

  assert.equal(beforePlayer.participation, 'not-yet-on-pitch')
  assert.equal(beforePlayer.minutesInWindow, 0)
  assert.equal(beforePlayer.selectedWindowActions, 0)
  assert.equal(
    before.claims[0].evidence.some(({ reference }) =>
      reference.description.includes('north-player-12'),
    ),
    false,
  )
  assert.equal(afterPlayer.participation, 'on-pitch')
  assert.ok(afterPlayer.minutesInWindow > 0)
  assert.ok(afterPlayer.selectedWindowActions > 0)
  assert.ok(after.claims[0].evidence.some(({ reference }) =>
    reference.description.includes('north-player-12'),
  ))
})

test('keeps player historical calculations strictly before the anchored goal', async () => {
  const saka = SYNTHETIC_MATCH_EVIDENCE.players.find(
    ({ id }) => id === 'north-player-09',
  )
  const claim = {
    id: 'claim-1',
    subject: 'Northbridge',
    playerSubject: { id: saka.id, name: saka.name, team: saka.team },
    playerMetric: null,
    text: 'How did Saka perform before the Northbridge goal?',
    intent: 'subjective-judgement',
    meaning: {
      category: 'historical-circumstance',
      description: 'Recorded Saka actions before the goal.',
      comparison: null,
    },
    requiredEvidence: ['player-events', 'passing', 'shots', 'goals'],
    timePeriod: { kind: 'before-event', eventId: 'event-07' },
    historicalEventAnchor: {
      eventId: 'event-07',
      relationship: 'Northbridge goal anchor',
    },
    clarificationNeeds: [],
  }
  const provider = {
    name: 'local',
    async interpret() {
      return { claims: [claim] }
    },
  }
  const result = await analyzeOpinion(
    request(claim.text),
    provider,
  )
  const playerClaim = result.claims[0]

  assert.ok(playerClaim.evidence.some(({ role, reference }) =>
    role === 'anchor' && reference.id === 'event-07',
  ))
  assert.ok(playerClaim.evidence.every(({ role, reference }) =>
    role === 'anchor' || elapsedMatchMinute(
      SYNTHETIC_MATCH_EVENTS.find(({ id }) => id === reference.id)?.clock ??
        { period: 1, minute: 1 },
    ) < elapsedMatchMinute({ period: 1, minute: 45, stoppageMinutes: 3 }),
  ))
  assert.ok(playerClaim.playerCalculations.every((trace) =>
    trace.denominatorRecordIds.every((id) => id !== 'event-07'),
  ))
})

test('reconciles all player pass and shot attributions with the original team totals', async () => {
  const result = await analyzeOpinion(request('How did Saka perform?'))
  const passes = result.evidenceFoundation.passRecords

  for (const team of ['Northbridge', 'Eastport']) {
    const teamPlayers = result.evidenceFoundation.players.filter(
      (player) => player.team === team,
    )
    assert.equal(teamPlayers.length, 20)
    assert.equal(teamPlayers.filter(({ status }) => status === 'starter').length, 11)
    assert.equal(teamPlayers.filter(({ status }) => status === 'substitute').length, 9)
    assert.equal(
      passes.filter(({ team: passTeam }) => passTeam === team).length,
      result.evidenceFoundation.teams[team].passAttempts,
    )
    assert.equal(
      passes.filter(({ team: passTeam, outcome }) =>
        passTeam === team && outcome === 'complete',
      ).length,
      result.evidenceFoundation.teams[team].completedPasses,
    )
    const shotEvents = SYNTHETIC_MATCH_EVENTS.filter(
      (event) =>
        event.type === 'shot' &&
        event.team === team &&
        elapsedMatchMinute(event.clock) <= elapsedMatchMinute(request().selectedClock),
    )
    assert.equal(
      shotEvents.length,
      result.periodStatistics[team].shots,
    )
    assert.ok(shotEvents.every(({ playerId }) =>
      teamPlayers.some(({ id }) => id === playerId),
    ))
  }
})

test('enforces substitution ordering and exactly eleven active players per team', () => {
  const fixture = SYNTHETIC_MATCH_EVIDENCE
  const activeAt = (team, elapsed) => {
    const active = new Set(
      fixture.players
        .filter((player) => player.team === team && player.status === 'starter')
        .map(({ id }) => id),
    )
    for (const substitution of fixture.substitutions) {
      if (substitution.team !== team || elapsedMatchMinute(substitution.clock) > elapsed) {
        continue
      }
      active.delete(substitution.playerOffId)
      active.add(substitution.playerOnId)
    }
    return active
  }
  const actions = [
    ...fixture.passes.flatMap((pass) => [
      { id: pass.id, team: pass.team, playerId: pass.playerId, receiverId: pass.receiverId, clock: pass.clock },
    ]),
    ...fixture.turnovers.map((record) => ({
      id: record.id, team: record.team, playerId: record.playerId, clock: record.clock,
    })),
    ...fixture.recoveries.map((record) => ({
      id: record.id, team: record.team, playerId: record.playerId, clock: record.clock,
    })),
    ...fixture.pressures.map((record) => ({
      id: record.id, team: record.team, playerId: record.playerId, clock: record.clock,
    })),
    ...SYNTHETIC_MATCH_EVENTS
      .filter((event) => event.type === 'shot')
      .map((event) => ({
        id: event.id, team: event.team, playerId: event.playerId, clock: event.clock,
      })),
  ]

  for (const team of ['Northbridge', 'Eastport']) {
    for (const point of [0, 1, 48, 49, 62, 63, 70, 71, 94]) {
      assert.equal(activeAt(team, point).size, 11)
    }
  }
  for (const action of actions) {
    const elapsed = elapsedMatchMinute(action.clock)
    const active = activeAt(action.team, elapsed)
    assert.ok(active.has(action.playerId), `${action.id} actor is active`)
    if ('receiverId' in action) {
      assert.ok(active.has(action.receiverId), `${action.id} receiver is active`)
    }
  }
  assert.ok(activeAt('Northbridge', elapsedMatchMinute({ period: 2, minute: 65 })).has('north-player-12'))
  assert.ok(!activeAt('Northbridge', elapsedMatchMinute({ period: 2, minute: 65 })).has('north-player-02'))
  assert.ok(activeAt('Eastport', elapsedMatchMinute({ period: 2, minute: 72 })).has('east-player-12'))
  assert.ok(!activeAt('Eastport', elapsedMatchMinute({ period: 2, minute: 72 })).has('east-player-03'))
})

test('returns unavailable running distance without substituting team or shooting data', async () => {
  const result = await analyzeOpinion(request('How far did Saka run?'))
  const claim = result.claims[0]

  assert.equal(claim.claim.intent, 'unavailable-metric')
  assert.equal(claim.claim.playerSubject.id, 'north-player-09')
  assert.deepEqual(claim.statistics, [])
  assert.deepEqual(claim.playerStatistics, [])
  assert.deepEqual(claim.evidence, [])
  assert.match(claim.limitation, /running distance.*not recorded/i)
})

test('selects the requested player-comparison metric instead of defaulting to pass completion', async () => {
  for (const [text, metric, values] of [
    ['Compare Saka and Amad goals.', 'goals', [1, 0]],
    ['Compare Saka and Amad shots.', 'shots', [3, 1]],
  ]) {
    const result = await analyzeOpinion(request(text))
    const claim = result.claims[0]

    assert.equal(claim.assessment, 'statistics provided')
    assert.deepEqual(
      claim.playerStatistics.map(({ playerName, metric: actualMetric, value }) => [
        playerName,
        actualMetric,
        value,
      ]),
      [
        ['Bukayo Saka', metric, values[0]],
        ['Amad', metric, values[1]],
      ],
    )
    assert.deepEqual(
      claim.playerCalculations.map(({ metric: actualMetric }) => actualMetric),
      [metric, metric],
    )
    assert.ok(claim.evidence.every(({ reference }) =>
      SYNTHETIC_MATCH_EVENTS.some((event) =>
        event.id === reference.id &&
        event.type === 'shot' &&
        event.playerId === (reference.team === 'Northbridge'
          ? 'north-player-09'
          : 'east-player-09') &&
        (metric !== 'goals' || event.outcome === 'goal'),
      ),
    ))
    assert.doesNotMatch(result.summary, /pass completion/i)
  }
})

test('assesses both common player pass-rate assertion forms from player percentages', async () => {
  for (const text of [
    'Saka had a higher pass completion rate than Amad.',
    'Saka completed a higher percentage of his passes than Amad.',
  ]) {
    const result = await analyzeOpinion(request(text))
    const claim = result.claims[0]

    assert.equal(claim.assessment, 'contradicted')
    assert.deepEqual(
      claim.playerStatistics.map(({ playerName, metric, value }) => [
        playerName,
        metric,
        value,
      ]),
      [
        ['Bukayo Saka', 'pass-attempts', 4],
        ['Bukayo Saka', 'pass-completions', 2],
        ['Bukayo Saka', 'pass-completion-percentage', 50],
        ['Amad', 'pass-attempts', 3],
        ['Amad', 'pass-completions', 2],
        ['Amad', 'pass-completion-percentage', 66.7],
      ],
    )
    assert.match(claim.meaning?.description ?? claim.claim.meaning.description, /pass completion percentage/)
  }
})

test('returns an explicit unavailable response for a player running-distance comparison', async () => {
  const result = await analyzeOpinion(
    request('Compare Saka and Amad running distance.'),
  )
  const claim = result.claims[0]

  assert.equal(claim.assessment, 'unavailable data')
  assert.equal(claim.claim.intent, 'unavailable-metric')
  assert.deepEqual(claim.playerStatistics, [])
  assert.deepEqual(claim.playerCalculations, [])
  assert.deepEqual(claim.evidence, [])
  assert.match(claim.limitation, /running distance.*not recorded/i)
  assert.doesNotMatch(result.summary, /passes|shots|goals/i)
})

test('keeps narrow player counts, traces, evidence, and summaries metric-specific', async () => {
  const cases = [
    {
      text: 'How many passes did Saka make?',
      metric: 'pass-attempts',
      value: 4,
      ids: SYNTHETIC_MATCH_EVIDENCE.passes
        .filter(({ playerId }) => playerId === 'north-player-09')
        .map(({ id }) => id),
      summary: /4 pass attempts/i,
    },
    {
      text: 'How many pass completions did Saka have?',
      metric: 'pass-completions',
      value: 2,
      ids: SYNTHETIC_MATCH_EVIDENCE.passes
        .filter(({ playerId, outcome }) =>
          playerId === 'north-player-09' && outcome === 'complete',
        )
        .map(({ id }) => id),
      summary: /2 pass completions/i,
    },
    {
      text: 'How many shots did Saka have?',
      metric: 'shots',
      value: 3,
      ids: SYNTHETIC_MATCH_EVENTS
        .filter(({ type, playerId }) => type === 'shot' && playerId === 'north-player-09')
        .map(({ id }) => id),
      summary: /3 shots/i,
    },
    {
      text: 'How many goals did Saka score?',
      metric: 'goals',
      value: 1,
      ids: SYNTHETIC_MATCH_EVENTS
        .filter(({ type, playerId, outcome }) =>
          type === 'shot' && playerId === 'north-player-09' && outcome === 'goal',
        )
        .map(({ id }) => id),
      summary: /1 goal\b/i,
    },
    {
      text: 'How many recoveries did Rice make?',
      metric: 'recoveries',
      value: 2,
      ids: SYNTHETIC_MATCH_EVIDENCE.recoveries
        .filter(({ playerId }) => playerId === 'north-player-06')
        .map(({ id }) => id),
      summary: /2 recoveries/i,
    },
    {
      text: 'How many pressures did Rice make?',
      metric: 'pressure-observations',
      value: 1,
      ids: SYNTHETIC_MATCH_EVIDENCE.pressures
        .filter(({ playerId }) => playerId === 'north-player-06')
        .map(({ id }) => id),
      summary: /1 selected pressure observation/i,
    },
  ]

  for (const item of cases) {
    const result = await analyzeOpinion(request(item.text))
    const claim = result.claims[0]

    assert.deepEqual(
      claim.playerStatistics.map(({ metric, value }) => [metric, value]),
      [[item.metric, item.value]],
      item.text,
    )
    assert.deepEqual(
      claim.playerCalculations.map(({ metric, value }) => [metric, value]),
      [[item.metric, item.value]],
      item.text,
    )
    assert.deepEqual(
      claim.evidence.map(({ reference }) => reference.id).sort(),
      [...item.ids].sort(),
      item.text,
    )
    assert.match(result.summary, item.summary, item.text)
    assert.doesNotMatch(result.summary, /undefined|0 shots|0 goals|0 selected-window minutes/i)
    assert.ok(claim.playerCalculations.every(({ value }) => value === item.value))
  }
})

test('reports count calculations as counts rather than percentages in the rendered evidence wording', async () => {
  const result = await analyzeOpinion(request('How many shots did Saka have?'))
  const trace = result.claims[0].playerCalculations[0]

  assert.equal(trace.metric, 'shots')
  assert.equal(trace.numerator, 3)
  assert.equal(trace.denominator, 3)
  assert.equal(trace.value, 3)
  assert.match(trace.denominatorDescription, /count of.*shot events/i)
  assert.doesNotMatch(result.summary, /3\/3 \(3%\)|3 shots \(3%\)/)
})

test('strictly limits player statistics and evidence to before the named team goal', async () => {
  const result = await analyzeOpinion(
    request('How many shots did Saka have before Northbridge scored?'),
  )
  const claim = result.claims[0]
  const shots = claim.playerStatistics.find(({ metric }) => metric === 'shots')
  const trace = claim.playerCalculations.find(({ metric }) => metric === 'shots')

  assert.equal(shots.value, 1)
  assert.deepEqual(trace.numeratorRecordIds, ['event-01'])
  assert.deepEqual(trace.denominatorRecordIds, ['event-01'])
  assert.deepEqual(claim.claim.timePeriod, { kind: 'before-event', eventId: 'event-07' })
  assert.ok(claim.evidence.some(({ role, reference }) =>
    role === 'anchor' && reference.id === 'event-07',
  ))
  assert.ok(claim.evidence.every(({ role, reference }) =>
    role === 'anchor' || reference.id === 'event-01',
  ))
})

test('clarifies a last-ten-minutes request that conflicts with the selected evidence period', async () => {
  const result = await analyzeOpinion(
    request('How did Saka perform in the last ten minutes?'),
  )
  const claim = result.claims[0]

  assert.equal(claim.assessment, 'clarification needed')
  assert.match(claim.claim.clarificationNeeds.join(' '), /select.*Last 10 minutes/i)
  assert.deepEqual(claim.playerStatistics, [])
  assert.deepEqual(claim.playerCalculations, [])
  assert.deepEqual(claim.evidence, [])
})

test('does not attribute a teammate goal to a named player in run-of-play claims', async () => {
  for (const text of [
    'Amad scored against the run of play.',
    'Rice scored against the run of play.',
    'Amad’s goal came against the run of play.',
    'Did Amad score against the run of play?',
    'Rice’s goal came against the run of play.',
  ]) {
    const result = await analyzeOpinion(request(text))
    const claim = result.claims[0]

    assert.equal(claim.assessment, 'clarification needed')
    assert.match(claim.claim.clarificationNeeds.join(' '), /No goal by .* is recorded/i)
    assert.equal(claim.claim.timePeriod.kind, 'selected')
    assert.equal(claim.claim.historicalEventAnchor, null)
    assert.deepEqual(claim.playerStatistics, [])
    assert.deepEqual(claim.playerCalculations, [])
    assert.deepEqual(claim.evidence, [])
  }
})

test('rejects typed historical anchors that assign a teammate goal to the named player', async () => {
  const teamGoal = await analyzeOpinion(
    request('Eastport scored against the run of play.'),
  )
  const sourceClaim = teamGoal.claims[0].claim
  const amad = SYNTHETIC_MATCH_EVIDENCE.players.find(
    ({ name }) => name === 'Amad',
  )
  const wrongScorer = {
    ...sourceClaim,
    playerSubject: { id: amad.id, name: amad.name, team: amad.team },
    text: 'Amad’s goal came against the run of play.',
  }
  const provider = {
    name: 'foundry',
    async interpret() {
      return { claims: [wrongScorer] }
    },
  }

  await assert.rejects(
    analyzeOpinion(request(wrongScorer.text), provider),
    /historical anchor must be a goal scored by the named player/i,
  )
})

test('rejects mixed player/team comparisons from any interpretation provider', async () => {
  const saka = SYNTHETIC_MATCH_EVIDENCE.players.find(
    ({ id }) => id === 'north-player-09',
  )
  const mixedComparison = {
    id: 'claim-1',
    subject: saka.team,
    playerSubject: { id: saka.id, name: saka.name, team: saka.team },
    playerMetric: null,
    text: 'Saka completed more passes than Eastport.',
    intent: 'factual-claim',
    meaning: {
      category: 'factual-comparison',
      description: 'Compare Saka pass completions with Eastport pass completions.',
      comparison: {
        opponent: 'Eastport',
        opponentPlayer: null,
        metric: 'pass-completions',
        operator: 'greater-than',
      },
    },
    requiredEvidence: ['passing'],
    timePeriod: { kind: 'selected' },
    historicalEventAnchor: null,
    clarificationNeeds: [],
  }
  const provider = {
    name: 'foundry',
    async interpret() {
      return { claims: [mixedComparison] }
    },
  }

  await assert.rejects(
    analyzeOpinion(request(mixedComparison.text), provider),
    /must compare two players or two teams/i,
  )
})

test('requires player metrics to match their declared evidence capability', async () => {
  const saka = SYNTHETIC_MATCH_EVIDENCE.players.find(
    ({ id }) => id === 'north-player-09',
  )
  const mismatchedMetric = {
    id: 'claim-1',
    subject: saka.team,
    playerSubject: { id: saka.id, name: saka.name, team: saka.team },
    playerMetric: 'shots',
    text: 'How many shots did Saka have?',
    intent: 'statistical-request',
    meaning: {
      category: 'other',
      description: 'Report shots.',
      comparison: null,
    },
    requiredEvidence: ['passing'],
    timePeriod: { kind: 'selected' },
    historicalEventAnchor: null,
    clarificationNeeds: [],
  }
  const provider = {
    name: 'foundry',
    async interpret() {
      return { claims: [mismatchedMetric] }
    },
  }

  await assert.rejects(
    analyzeOpinion(request(mismatchedMetric.text), provider),
    /intent does not match its evidence request/i,
  )
})

test('resolves ASCII Odegaard spellings without erasing the ambiguity of Martin', async () => {
  const [asciiSurname, accentedSurname, fullAsciiName, firstName] =
    await Promise.all([
      analyzeOpinion(request('How did Odegaard perform?')),
      analyzeOpinion(request('How did Ødegaard perform?')),
      analyzeOpinion(request('How did Martin Odegaard perform?')),
      analyzeOpinion(request('How did Martin perform?')),
    ])

  for (const result of [asciiSurname, accentedSurname, fullAsciiName]) {
    assert.equal(result.claims[0].claim.playerSubject.id, 'north-player-08')
    assert.equal(result.claims[0].claim.clarificationNeeds.length, 0)
  }
  assert.equal(firstName.claims[0].assessment, 'clarification needed')
  assert.match(firstName.claims[0].claim.clarificationNeeds.join(' '), /Zubimendi.*Ødegaard/)
})

test('withholds all player results while a missing historical goal needs clarification', async () => {
  const result = await analyzeOpinion(
    request('Saka scored against the run of play.', {
      period: 1,
      minute: 10,
    }),
  )
  const claim = result.claims[0]

  assert.equal(claim.assessment, 'clarification needed')
  assert.deepEqual(claim.playerStatistics, [])
  assert.deepEqual(claim.playerCalculations, [])
  assert.deepEqual(claim.evidence, [])
  assert.doesNotMatch(result.summary, /passes|shots|goals|recoveries/i)
})

test('leads general player summaries with participation and recorded contributions', async () => {
  const saka = await analyzeOpinion(request('How did Saka perform?'))
  assert.match(saka.summary, /Claim 1 — Bukayo Saka: Recorded 1 goal, 3 shots on target, 2 pass completions from 4 pass attempts/)
  assert.match(saka.summary, /sparse synthetic records cannot establish an overall performance rating/i)
  assert.doesNotMatch(saka.summary, /2\/4 \(50%\)|2 pass completions from 4 pass attempts.*50%/)
  assert.match(saka.summary, /event-07/)

  const notEntered = await analyzeOpinion(
    request('How did Ben White perform?', { period: 2, minute: 64 }),
  )
  assert.match(notEntered.summary, /Claim 1 — Ben White: has not yet entered the pitch/)
  assert.doesNotMatch(notEntered.summary, /0 shots|0 goals|undefined/)
  assert.doesNotMatch(notEntered.summary, /0\/0|rating or ranking/)

  const unused = await analyzeOpinion(
    request('How did Karl Darlow perform?'),
  )
  assert.match(unused.summary, /Claim 1 — Karl Darlow: remained an unused substitute/)
  assert.doesNotMatch(unused.summary, /0 shots|0 goals|undefined/)
})

test('uses historical scope and participation in player summaries', async () => {
  const shots = await analyzeOpinion(
    request('How many shots did Saka have before Northbridge scored?'),
  )
  assert.match(shots.summary, /Period: Recorded match play strictly before 45\+3′/)
  assert.match(shots.summary, /Evidence excludes anchor event-07/)
  assert.match(shots.summary, /Claim 1 — Bukayo Saka: statistics provided\. Period: Recorded match play strictly before 45\+3′/)

  const ben = await analyzeOpinion(
    request('How did Ben White perform before Northbridge scored?'),
  )
  assert.match(ben.summary, /Claim 1 — Ben White: has not yet entered the pitch/)
  assert.match(ben.summary, /Period: Recorded match play strictly before 45\+3′/)
  assert.doesNotMatch(ben.summary, /0\/0|Ben White is on the pitch/)

  const timber = await analyzeOpinion(
    request('How did Timber perform before Northbridge scored?'),
  )
  assert.match(timber.summary, /Period: Recorded match play strictly before 45\+3′/)
  assert.doesNotMatch(timber.summary, /has since been substituted/)
})

test('assesses recorded recovery comparisons with player-event availability', async () => {
  const result = await analyzeOpinion(
    request('Rice made more recoveries than Saka.'),
  )
  const claim = result.claims[0]

  assert.equal(claim.assessment, 'supported')
  assert.equal(claim.claim.meaning.comparison.metric, 'recoveries')
  assert.ok(claim.evidenceAvailability.some(
    ({ kind, available }) => kind === 'player-events' && available,
  ))
  assert.deepEqual(
    claim.playerStatistics.map(({ playerName, value }) => [playerName, value]),
    [['Declan Rice', 2], ['Bukayo Saka', 1]],
  )
})

test('treats why build-up questions as bounded coaching queries without inventing causes', async () => {
  const result = await analyzeOpinion(
    request('Why did Rice lose possession during build-up?'),
  )
  const claim = result.claims[0]

  assert.equal(claim.claim.intent, 'coaching-question')
  assert.deepEqual(claim.evidence.map(({ reference }) => reference.id).filter((id) =>
    id.startsWith('turnover-'),
  ), ['turnover-003', 'turnover-016'])
  assert.match(claim.limitation, /do not establish why possession was lost/i)
  assert.match(result.summary, /not tactical causes/i)
})
