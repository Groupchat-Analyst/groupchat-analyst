import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { SYNTHETIC_MATCH_EVIDENCE } from '../dist/shared/src/evidence.js'

const ledger = JSON.parse(
  readFileSync(
    new URL('../../../docs/foundry-final-acceptance-live-ledger.json', import.meta.url),
    'utf8',
  ),
)

const request = (
  opinion,
  selectedClock = { period: 2, minute: 90, stoppageMinutes: 4 },
  period = 'match-so-far',
) => ({ opinion, selectedClock, period })

function providerWithClaims(claims) {
  return {
    name: 'foundry',
    async interpret() {
      return { claims: structuredClone(claims) }
    },
  }
}

function capturedClaim(attemptId) {
  const record = ledger.records.find(({ attemptId: id }) => id === attemptId)
  assert.ok(record, `captured attempt ${attemptId} exists`)
  return record.actualClaims[0].interpretation
}

function teamComparisonClaim({
  id,
  subject,
  opponent,
  metric,
  operator,
  text,
  intent = 'factual-claim',
  requiredEvidence,
}) {
  return {
    id,
    subject,
    playerSubject: null,
    playerMetric: null,
    text,
    intent,
    meaning: {
      category: 'factual-comparison',
      description: text,
      comparison: {
        opponent,
        opponentPlayer: null,
        metric,
        operator,
      },
    },
    requiredEvidence,
    timePeriod: { kind: 'selected' },
    historicalEventAnchor: null,
    clarificationNeeds: [],
  }
}

test('captured A12 interpretation answers only from selected versioned build-up annotations', async () => {
  const claim = capturedClaim('A12')
  const opinion = ledger.records.find(({ attemptId }) => attemptId === 'A12').input
  const result = await analyzeOpinion(
    request(opinion),
    providerWithClaims([claim]),
  )
  const answer = result.claims[0]
  const eligibleTurnovers = answer.evidence
    .filter(({ reference }) => reference.id.startsWith('turnover-'))
    .map(({ reference }) => reference.id)
  const annotations = SYNTHETIC_MATCH_EVIDENCE.buildUpAnnotations.filter(
    ({ team }) => team === 'Northbridge',
  )
  const expectedTurnoverIds = annotations.flatMap(({ turnoverIds }) => turnoverIds)
  const turnovers = SYNTHETIC_MATCH_EVIDENCE.turnovers.filter(({ id }) =>
    expectedTurnoverIds.includes(id),
  )
  const counts = {
    'defensive-third': 0,
    'middle-third': 0,
    'final-third': 0,
  }
  for (const turnover of turnovers) {
    const area =
      turnover.location.x < 33.3
        ? 'defensive-third'
        : turnover.location.x < 66.7
          ? 'middle-third'
          : 'final-third'
    counts[area] += 1
  }

  assert.equal(answer.claim.intent, 'coaching-question')
  assert.equal(answer.claim.meaning.category, 'coaching-question')
  assert.deepEqual(eligibleTurnovers, expectedTurnoverIds)
  assert.deepEqual(
    answer.calculations.map(({ area, value, denominator }) => [
      area,
      value,
      denominator,
    ]),
    [
      ['defensive-third', counts['defensive-third'], turnovers.length],
      ['middle-third', counts['middle-third'], turnovers.length],
      ['final-third', counts['final-third'], turnovers.length],
    ],
  )
  assert.ok(
    answer.evidence
      .filter(({ reference }) => reference.id.startsWith('turnover-'))
      .every(({ reference }) => {
        const linkedPassId = reference.description.match(/linked pass (pass-\d+)/)?.[1]
        return answer.evidence.some(({ reference: item }) => item.id === linkedPassId)
      }),
  )
  assert.deepEqual(answer.statistics, [])
  assert.match(result.summary, /partial annotated sample, not a match-wide count/i)
  assert.doesNotMatch(result.summary, /30 of 38 passes|78\.9%/)
})

test('captured A12 build-up scope is clipped to the selected recent window', async () => {
  const result = await analyzeOpinion(
    request(
      ledger.records.find(({ attemptId }) => attemptId === 'A12').input,
      { period: 2, minute: 58 },
      'last-10-minutes',
    ),
    providerWithClaims([capturedClaim('A12')]),
  )
  const claim = result.claims[0]
  const eligibleIds = SYNTHETIC_MATCH_EVIDENCE.buildUpAnnotations
    .filter(({ team }) => team === 'Northbridge')
    .flatMap(({ turnoverIds }) => turnoverIds)
  const selectedTurnoverIds = SYNTHETIC_MATCH_EVIDENCE.turnovers
    .filter(
      ({ id, clock }) =>
        eligibleIds.includes(id) &&
        clock.period === 2 &&
        clock.minute >= 48 &&
        clock.minute <= 58,
    )
    .map(({ id }) => id)

  assert.deepEqual(
    claim.evidence
      .filter(({ reference }) => reference.id.startsWith('turnover-'))
      .map(({ reference }) => reference.id),
    selectedTurnoverIds,
  )
  assert.ok(
    claim.evidence.every(
      ({ reference }) =>
        reference.id !== 'turnover-016' && reference.id !== 'pass-067',
    ),
  )
  assert.equal(claim.calculations[0].denominator, selectedTurnoverIds.length)
})

test('A06 unavailable distance survives an invalid irrelevant event period without substituting statistics', async () => {
  const claim = {
    id: 'distance-claim',
    subject: 'Eastport',
    playerSubject: null,
    playerMetric: null,
    text: 'Eastport covered more ground than Northbridge.',
    intent: 'unavailable-metric',
    meaning: {
      category: 'factual-comparison',
      description: 'Compare recorded running distance.',
      comparison: {
        opponent: 'Northbridge',
        opponentPlayer: null,
        metric: 'running-distance',
        operator: 'greater-than',
      },
    },
    requiredEvidence: ['physical-measurements'],
    timePeriod: { kind: 'before-event', eventId: 'not-an-available-event' },
    historicalEventAnchor: null,
    clarificationNeeds: [],
  }
  const result = await analyzeOpinion(
    request('Did Eastport cover more ground than Northbridge?'),
    providerWithClaims([claim]),
  )
  const answer = result.claims[0]

  assert.equal(answer.assessment, 'unavailable data')
  assert.deepEqual(answer.claim.timePeriod, { kind: 'selected' })
  assert.deepEqual(answer.statistics, [])
  assert.deepEqual(answer.evidence, [])
  assert.match(result.summary, /running distance.*not recorded/i)
  assert.doesNotMatch(result.summary, /shots|passes|possession|km|miles/i)
})

test('A08 keeps the before-half-time goal and possession claims separate and assessable', async () => {
  const goalClaim = {
    id: 'goal-before-half-time',
    subject: 'Northbridge',
    playerSubject: null,
    playerMetric: null,
    text: 'Northbridge scored before half-time.',
    intent: 'statistical-request',
    meaning: {
      category: 'historical-circumstance',
      description: 'Northbridge scored before half-time.',
      comparison: null,
    },
    requiredEvidence: ['goals'],
    timePeriod: { kind: 'selected' },
    historicalEventAnchor: null,
    clarificationNeeds: [],
  }
  const possessionClaim = teamComparisonClaim({
    id: 'eastport-possession',
    subject: 'Eastport',
    opponent: 'Northbridge',
    metric: 'possession-percentage',
    operator: 'greater-than',
    text: 'Eastport had more possession overall.',
    requiredEvidence: ['possession'],
  })
  const result = await analyzeOpinion(
    request('Northbridge scored before half-time, but Eastport had more possession overall.'),
    providerWithClaims([goalClaim, possessionClaim]),
  )

  assert.equal(result.claims.length, 2)
  assert.equal(result.claims[0].assessment, 'supported')
  assert.deepEqual(
    result.claims[0].evidence.map(({ reference }) => reference.id),
    ['event-07'],
  )
  assert.equal(result.claims[1].assessment, 'contradicted')
  assert.match(result.summary, /Northbridge scored before half-time at 45\+3′/)
  assert.match(result.summary, /No — Eastport recorded 44% possession, compared with Northbridge's 56% possession/)

  const beforeTheGoal = await analyzeOpinion(
    request(
      'Northbridge scored before half-time, but Eastport had more possession overall.',
      { period: 1, minute: 45, stoppageMinutes: 2 },
    ),
    providerWithClaims([goalClaim, possessionClaim]),
  )
  assert.notEqual(beforeTheGoal.claims[0].assessment, 'supported')
  assert.deepEqual(beforeTheGoal.claims[0].evidence, [])
  assert.doesNotMatch(beforeTheGoal.summary, /event-07|45\+3′/)
  assert.match(
    beforeTheGoal.summary,
    /selected match time is 45\+2′; no Northbridge goal before half-time is recorded yet/i,
  )
})

test('local interpreter scopes a before-half-time scoring assertion to first-half goal events', async () => {
  const result = await analyzeOpinion(
    request('Northbridge scored before half-time, but Eastport had more possession overall.'),
  )

  assert.equal(result.claims.length, 2)
  assert.equal(result.claims[0].assessment, 'supported')
  assert.deepEqual(
    result.claims[0].evidence.map(({ reference }) => reference.id),
    ['event-07'],
  )
  assert.match(result.summary, /Northbridge scored before half-time at 45\+3′/)
  assert.match(result.summary, /Eastport had 44% of recorded possession/)
})

test('local interpreter preserves before-half-time negation and clarifies unsupported wording', async () => {
  for (const text of [
    'Northbridge did not score before half-time.',
    'Northbridge never scored before half-time.',
  ]) {
    const result = await analyzeOpinion(request(text))
    assert.equal(result.claims[0].assessment, 'contradicted')
    assert.match(result.summary, /No — Northbridge did score before half-time/i)
  }

  const unclear = await analyzeOpinion(
    request('Northbridge could not fail to score before half-time.'),
  )
  assert.equal(unclear.claims[0].assessment, 'clarification needed')
  assert.match(unclear.summary, /rephrase whether the team scored or did not score/i)
})

test('explicit negated before-half-time claims are contradicted by a recorded goal', async (t) => {
  for (const text of [
    'Northbridge did not score before half-time.',
    'Northbridge never scored before half-time.',
    'Northbridge have not scored before half-time.',
  ]) {
    await t.test(text, async () => {
      const claim = {
        id: 'northbridge-no-first-half-goal',
        subject: 'Northbridge',
        playerSubject: null,
        playerMetric: null,
        text,
        intent: 'factual-claim',
        meaning: {
          category: 'historical-circumstance',
          description: text,
          comparison: null,
        },
        requiredEvidence: ['goals'],
        timePeriod: { kind: 'selected' },
        historicalEventAnchor: null,
        clarificationNeeds: [],
      }
      const result = await analyzeOpinion(
        request(text),
        providerWithClaims([claim]),
      )

      assert.equal(result.claims[0].assessment, 'contradicted')
      assert.deepEqual(
        result.claims[0].evidence.map(({ reference }) => reference.id),
        ['event-07'],
      )
      assert.match(result.summary, /No — Northbridge did score before half-time/i)
    })
  }
})

test('before-half-time non-events are assessed only after the first half has ended', async () => {
  const text = 'Eastport never scored before half-time.'
  const claim = {
    id: 'eastport-no-first-half-goal',
    subject: 'Eastport',
    playerSubject: null,
    playerMetric: null,
    text,
    intent: 'factual-claim',
    meaning: {
      category: 'historical-circumstance',
      description: text,
      comparison: null,
    },
    requiredEvidence: ['goals'],
    timePeriod: { kind: 'selected' },
    historicalEventAnchor: null,
    clarificationNeeds: [],
  }
  const afterHalfTime = await analyzeOpinion(
    request(text),
    providerWithClaims([claim]),
  )
  assert.equal(afterHalfTime.claims[0].assessment, 'supported')
  assert.deepEqual(afterHalfTime.claims[0].evidence, [])
  assert.match(afterHalfTime.summary, /Yes — no Eastport goal before half-time is recorded/i)

  const beforeHalfTime = await analyzeOpinion(
    request(text, { period: 1, minute: 45, stoppageMinutes: 2 }),
    providerWithClaims([claim]),
  )
  assert.equal(
    beforeHalfTime.claims[0].assessment,
    'insufficient evidence for a firm conclusion',
  )
  assert.match(beforeHalfTime.summary, /final first-half claim cannot be established/i)
})

test('unsupported before-half-time scoring wording asks for clarification instead of a guess', async () => {
  for (const text of [
    'Northbridge could not fail to score before half-time.',
    'Northbridge not scored before half-time.',
  ]) {
    const claim = {
      id: 'unclear-northbridge-half-time-claim',
      subject: 'Northbridge',
      playerSubject: null,
      playerMetric: null,
      text,
      intent: 'factual-claim',
      meaning: {
        category: 'historical-circumstance',
        description: text,
        comparison: null,
      },
      requiredEvidence: ['goals'],
      timePeriod: { kind: 'selected' },
      historicalEventAnchor: null,
      clarificationNeeds: [],
    }
    const result = await analyzeOpinion(
      request(text),
      providerWithClaims([claim]),
    )

    assert.equal(result.claims[0].assessment, 'clarification needed')
    assert.match(result.summary, /rephrase.*scored or did not score before half-time/i)
    assert.doesNotMatch(result.summary, /supported|contradicted/i)
  }
})

test('before-half-time against-the-run-of-play claims retain exclusive historical scope', async () => {
  const claim = {
    id: 'northbridge-goal-run-of-play',
    subject: 'Northbridge',
    playerSubject: null,
    playerMetric: null,
    text: 'Northbridge scored before half-time against the run of play.',
    intent: 'factual-claim',
    meaning: {
      category: 'historical-circumstance',
      description: 'Assess the goal against recorded play before it.',
      comparison: null,
    },
    requiredEvidence: [
      'possession',
      'territorial-control',
      'attacking-events',
    ],
    timePeriod: { kind: 'before-event', eventId: 'event-07' },
    historicalEventAnchor: {
      eventId: 'event-07',
      relationship: 'Northbridge goal at 45+3′',
    },
    clarificationNeeds: [],
  }
  const result = await analyzeOpinion(
    request(claim.text),
    providerWithClaims([claim]),
  )
  const answer = result.claims[0]

  assert.deepEqual(answer.claim.timePeriod, {
    kind: 'before-event',
    eventId: 'event-07',
  })
  assert.equal(answer.claim.meaning.category, 'historical-circumstance')
  assert.notEqual(answer.assessment, 'supported')
  assert.ok(
    answer.evidence
      .filter(({ role }) => role !== 'anchor')
      .every(({ reference }) => reference.id !== 'event-07'),
  )
  assert.match(answer.periodLabel, /strictly before 45\+3′/)
  assert.match(result.summary, /uses play strictly before Northbridge's goal at 45\+3′/)
})

test('half-time claims requiring clarification cannot receive a factual verdict', async () => {
  const claim = {
    id: 'northbridge-half-time-goal-clarification',
    subject: 'Northbridge',
    playerSubject: null,
    playerMetric: null,
    text: 'Northbridge scored before half-time.',
    intent: 'factual-claim',
    meaning: {
      category: 'historical-circumstance',
      description: 'Northbridge scored before half-time.',
      comparison: null,
    },
    requiredEvidence: ['goals'],
    timePeriod: { kind: 'selected' },
    historicalEventAnchor: null,
    clarificationNeeds: ['Please clarify which scoring event you mean.'],
  }
  const result = await analyzeOpinion(
    request(claim.text),
    providerWithClaims([claim]),
  )

  assert.equal(result.claims[0].assessment, 'clarification needed')
  assert.deepEqual(result.claims[0].evidence, [])
  assert.match(result.summary, /Please clarify which scoring event you mean/)
  assert.doesNotMatch(result.summary, /supported|contradicted/i)
})

test('historical half-time evidence is labelled separately from the selected last-ten-minute window', async () => {
  const claim = {
    id: 'northbridge-first-half-goal',
    subject: 'Northbridge',
    playerSubject: null,
    playerMetric: null,
    text: 'Northbridge scored before half-time.',
    intent: 'factual-claim',
    meaning: {
      category: 'historical-circumstance',
      description: 'Northbridge scored before half-time.',
      comparison: null,
    },
    requiredEvidence: ['goals'],
    timePeriod: { kind: 'selected' },
    historicalEventAnchor: null,
    clarificationNeeds: [],
  }
  const result = await analyzeOpinion(
    request(
      claim.text,
      { period: 2, minute: 90, stoppageMinutes: 4 },
      'last-10-minutes',
    ),
    providerWithClaims([claim]),
  )

  assert.equal(result.claims[0].periodLabel, 'Recorded first-half goal events')
  assert.match(result.summary, /first-half goal events, independently of the selected analysis window/i)
  assert.match(result.selectedPeriodLabel, /^Last 10 minutes ending 90\+4′$/)
  assert.deepEqual(
    result.claims[0].evidence.map(({ reference }) => reference.id),
    ['event-07'],
  )
})

test('A09 repeat evidence is derived canonically while exclusive goal and scorer checks remain strict', async () => {
  const claim = capturedClaim('A09')
  claim.requiredEvidence = ['invalid-captured-repeat-value']
  const opinion = ledger.records.find(({ attemptId }) => attemptId === 'A09-R1').input
  const result = await analyzeOpinion(
    request(opinion),
    providerWithClaims([claim]),
  )
  const answer = result.claims[0]

  assert.deepEqual(answer.claim.requiredEvidence, [
    'possession',
    'territorial-control',
    'attacking-events',
  ])
  assert.deepEqual(answer.claim.timePeriod, {
    kind: 'before-event',
    eventId: 'event-07',
  })
  assert.equal(answer.evidence.find(({ role }) => role === 'anchor').reference.id, 'event-07')
  assert.ok(
    answer.evidence
      .filter(({ role }) => role !== 'anchor')
      .every(({ reference }) => !['event-07', 'event-08'].includes(reference.id)),
  )

  const wrongScorer = structuredClone(claim)
  wrongScorer.requiredEvidence = ['goals']
  wrongScorer.playerSubject = {
    id: 'north-player-06',
    name: 'Declan Rice',
    team: 'Northbridge',
  }
  await assert.rejects(
    analyzeOpinion(request(opinion), providerWithClaims([wrongScorer])),
    /historical anchor must be a goal scored by the named player/i,
  )
})

test('A04 negative-tag pass-rate comparison retains both player identities and its factual operator', async () => {
  const claim = {
    id: 'amad-not-higher',
    subject: 'Eastport',
    playerSubject: {
      id: 'east-player-09',
      name: 'Amad',
      team: 'Eastport',
    },
    playerMetric: 'pass-completion-percentage',
    text: 'Amad did not complete passes at a higher rate than Saka.',
    intent: 'statistical-request',
    meaning: {
      category: 'factual-comparison',
      description: 'Compare pass-completion percentages.',
      comparison: {
        opponent: 'Northbridge',
        opponentPlayer: {
          id: 'north-player-09',
          name: 'Bukayo Saka',
          team: 'Northbridge',
        },
        metric: 'pass-completion-percentage',
        operator: 'less-or-equal',
      },
    },
    requiredEvidence: [],
    timePeriod: { kind: 'selected' },
    historicalEventAnchor: null,
    clarificationNeeds: [],
  }
  const result = await analyzeOpinion(
    request('Amad didn’t complete passes at a higher rate than Saka, did he?'),
    providerWithClaims([claim]),
  )

  assert.equal(result.claims[0].assessment, 'contradicted')
  assert.equal(result.claims[0].claim.intent, 'factual-claim')
  assert.equal(result.claims[0].claim.playerMetric, null)
  assert.deepEqual(result.claims[0].claim.requiredEvidence, ['passing'])
  assert.deepEqual(
    result.claims[0].playerStatistics
      .filter(({ metric }) => metric === 'pass-completion-percentage')
      .map(({ playerName, value }) => [playerName, value]),
    [
      ['Amad', 66.7],
      ['Bukayo Saka', 50],
    ],
  )
})
