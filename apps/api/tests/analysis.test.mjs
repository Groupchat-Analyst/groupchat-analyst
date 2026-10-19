import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

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
  assert.match(claim.limitation, /all-pass-turnover breakdown for both teams/i)
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
  assert.match(result.summary, /denominator all 38 recorded passes/)
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
  const turnovers = result.evidenceFoundation.turnoverReferences.filter(
    ({ team }) => team === 'Eastport',
  )
  const expectedTurnoverIds = turnovers.map(({ id }) => id)
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
      ['middle-third', 7],
      ['final-third', 2],
    ],
  )
  assert.ok(claim.calculations.every(({ denominator }) => denominator === 9))
  assert.match(claim.limitation, /no build-up-phase filter/i)
  assert.match(claim.limitation, /all-pass-turnover breakdown/i)
  assert.match(claim.limitation, /do not establish why possession was lost/i)
  assert.match(
    result.summary,
    /Available all-pass turnover locations: defensive-third 0, middle-third 7, final-third 2 \(9 recorded turnovers total\)/,
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
    role === 'challenging' && reference.team === 'Northbridge',
  ))
  assert.ok(dominance.evidence.some(({ role, reference }) =>
    role === 'supporting' && reference.team === 'Eastport',
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
