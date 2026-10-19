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
  assert.match(result.summary, /no possession percentages/)
  assert.doesNotMatch(result.summary, /criteria|you did not provide/i)
})

test('identifies possession data as unavailable without substituting shooting statistics', async () => {
  const result = await analyzeOpinion(request())
  const eastportClaim = result.claims[0]
  const northbridgeClaim = result.claims[1]

  assert.equal(
    eastportClaim.assessment,
    'insufficient evidence for a firm conclusion',
  )
  assert.equal(eastportClaim.statistics.length, 0)
  assert.equal(eastportClaim.evidence.length, 0)
  assert.equal(eastportClaim.evidenceAvailability[0].available, false)
  assert.match(eastportClaim.evidenceAvailability[0].detail, /no possession percentages/)
  assert.match(eastportClaim.limitation, /no possession percentages/)
  assert.match(eastportClaim.limitation, /prevent a firm conclusion/i)
  assert.ok(
    northbridgeClaim.statistics.every(
      ({ metric }) => metric !== 'shots' && metric !== 'shots-on-target',
    ),
  )
  assert.ok(
    northbridgeClaim.evidenceAvailability.some(
      ({ kind, available }) => kind === 'possession' && !available,
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
    ],
  )
  assert.ok(periodEvidence.every(({ reference: item }) => item.id !== 'event-07'))
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
      .filter(({ role }) => role !== 'anchor')
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
