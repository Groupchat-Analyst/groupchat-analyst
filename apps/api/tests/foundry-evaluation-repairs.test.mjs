import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { elapsedMatchMinute } from '../dist/shared/src/matchClock.js'
import { SYNTHETIC_MATCH_EVIDENCE } from '../dist/shared/src/evidence.js'
import { SYNTHETIC_MATCH_EVENTS } from '../dist/shared/src/match.js'

const ledger = JSON.parse(
  readFileSync(
    new URL('../../../docs/foundry-5cd4f82-live-evaluation-ledger.json', import.meta.url),
    'utf8',
  ),
)

const selectedClock = { period: 2, minute: 90, stoppageMinutes: 4 }

function attempt(id) {
  const record = ledger.attempts.find((item) => item.attemptId === id)
  assert.ok(record, `captured evaluation attempt ${id} exists`)
  return record
}

function providerWithCapturedInterpretation(id) {
  return {
    name: 'foundry',
    async interpret() {
      return JSON.parse(attempt(id).rawModelOutput.content)
    },
  }
}

function providerWithClaim(claim) {
  return {
    name: 'foundry',
    async interpret() {
      return { claims: [structuredClone(claim)] }
    },
  }
}

function request(opinion) {
  return { opinion, selectedClock, period: 'match-so-far' }
}

function quantitativeBeforeGoalClaim() {
  return {
    id: 'claim-1',
    subject: 'Northbridge',
    playerSubject: null,
    playerMetric: null,
    text: 'How many passes had Northbridge completed before their goal at 45+3?',
    intent: 'statistical-request',
    meaning: {
      category: 'other',
      description: 'Count Northbridge completed passes before the 45+3 goal.',
      comparison: null,
    },
    requiredEvidence: ['passing'],
    timePeriod: { kind: 'before-event', eventId: 'event-07' },
    historicalEventAnchor: { eventId: 'event-07', relationship: 'before' },
    clarificationNeeds: [],
  }
}

function numericalAssertionBeforeGoalClaim() {
  return {
    id: 'claim-1',
    subject: 'Northbridge',
    playerSubject: null,
    playerMetric: null,
    text: 'Northbridge completed more passes than Eastport before Northbridge scored.',
    intent: 'factual-claim',
    meaning: {
      category: 'factual-comparison',
      description: 'Northbridge had more completed passes than Eastport before its goal.',
      comparison: {
        opponent: 'Eastport',
        opponentPlayer: null,
        metric: 'pass-completions',
        operator: 'greater-than',
      },
    },
    requiredEvidence: ['passing'],
    timePeriod: { kind: 'before-event', eventId: 'event-07' },
    historicalEventAnchor: { eventId: 'event-07', relationship: 'before' },
    clarificationNeeds: [],
  }
}

test('captured D01 assessment, summary, evidence and limitation agree', async () => {
  const captured = attempt('D01')
  const result = await analyzeOpinion(
    request(captured.request.input),
    providerWithCapturedInterpretation('D01'),
  )
  const claim = result.claims[0]

  assert.equal(claim.assessment, 'contradicted')
  assert.match(result.summary, /Northbridge did score before half-time/i)
  assert.equal(
    claim.evidence.some(
      ({ role, reference }) =>
        role === 'challenging' && reference.id === 'event-07',
    ),
    true,
  )
  assert.match(claim.limitation, /recorded first-half goal events/i)
  assert.doesNotMatch(claim.limitation, /does not establish the full subjective judgement/i)
})

test('captured D03 and R01 interpretations reproduce the original request-versus-claim failures', async () => {
  for (const id of ['D03', 'R01']) {
    const captured = attempt(id)
    const originalInterpretation = JSON.parse(captured.rawModelOutput.content)
    assert.equal(originalInterpretation.claims[0].intent, 'factual-claim')

    const result = await analyzeOpinion(
      request(captured.request.input),
      providerWithCapturedInterpretation(id),
    )
    assert.equal(result.claims[0].claim.intent, 'factual-claim')
    assert.equal(
      result.claims[0].assessment,
      'insufficient evidence for a firm conclusion',
    )
    assert.equal(
      result.claims[0].statistics.some(({ metric }) => metric.startsWith('pass-')),
      false,
    )
  }
})

test('offline replay of all captured cases preserves the original scores and isolates the D01 limitation repair', async () => {
  for (const captured of ledger.attempts) {
    const result = await analyzeOpinion(
      {
        opinion: captured.request.input,
        selectedClock: captured.request.selectedClock,
        period: captured.request.selectedPeriod,
      },
      providerWithCapturedInterpretation(captured.attemptId),
    )
    const original = captured.actualResponse
    assert.equal(result.provider, 'foundry', captured.attemptId)
    assert.deepEqual(result.score, original.score, captured.attemptId)
    assert.equal(result.summary, original.summary, captured.attemptId)
    assert.equal(result.claims.length, original.claims.length, captured.attemptId)
    for (const [index, claim] of result.claims.entries()) {
      const oldClaim = original.claims[index]
      assert.equal(claim.assessment, oldClaim.assessment, `${captured.attemptId} assessment`)
      assert.deepEqual(claim.claim, oldClaim.claim, `${captured.attemptId} interpretation`)
      assert.deepEqual(claim.statistics, oldClaim.statistics, `${captured.attemptId} statistics`)
      assert.deepEqual(claim.playerStatistics, oldClaim.playerStatistics, `${captured.attemptId} player statistics`)
      assert.deepEqual(claim.calculations, oldClaim.calculations, `${captured.attemptId} calculations`)
      assert.deepEqual(claim.evidence, oldClaim.evidence, `${captured.attemptId} evidence`)
      if (captured.attemptId !== 'D01') {
        assert.equal(claim.limitation, oldClaim.limitation, `${captured.attemptId} limitation`)
      }
    }
  }
})

test('quantitative request before a goal keeps statistical intent and uses the exclusive anchor', async () => {
  const result = await analyzeOpinion(
    request('How many passes had Northbridge completed before their goal at 45+3?'),
    providerWithClaim(quantitativeBeforeGoalClaim()),
  )
  const claim = result.claims[0]
  const passEvidence = claim.evidence
    .map(({ reference }) => reference)
    .filter(({ id }) => id.startsWith('pass-'))
  const northbridgePassEvidence = passEvidence.filter(
    ({ team }) => team === 'Northbridge',
  )
  const anchor = SYNTHETIC_MATCH_EVENTS.find(({ id }) => id === 'event-07')
  assert.ok(anchor)
  const anchorElapsed = elapsedMatchMinute(anchor.clock)

  assert.equal(claim.claim.intent, 'statistical-request')
  assert.equal(claim.claim.meaning.category, 'other')
  assert.equal(claim.assessment, 'statistics provided')
  assert.match(claim.periodLabel, /strictly before 45\+3/i)
  assert.deepEqual(claim.claim.timePeriod, {
    kind: 'before-event',
    eventId: 'event-07',
  })
  assert.equal(
    claim.evidence.some(
      ({ role, reference }) => role === 'anchor' && reference.id === 'event-07',
    ),
    true,
  )
  assert.ok(
    passEvidence.every(({ id }) => {
      const pass = SYNTHETIC_MATCH_EVIDENCE.passes.find((item) => item.id === id)
      return pass && elapsedMatchMinute(pass.clock) < anchorElapsed
    }),
  )
  const calculation = claim.calculations.find(
    ({ metric }) => metric === 'pass-completions',
  )
  assert.ok(calculation)
  assert.equal(calculation.value, 14)
  assert.equal(calculation.numerator, 14)
  assert.equal(calculation.denominator, 18)
  assert.deepEqual(
    calculation.denominatorRecordIds,
    northbridgePassEvidence.map(({ id }) => id),
  )
  assert.deepEqual(
    claim.statistics
      .filter(({ team }) => team === 'Northbridge')
      .map(({ metric, value }) => [metric, value]),
    [
      ['pass-attempts', 18],
      ['pass-completions', 14],
      ['pass-completion-percentage', 77.8],
    ],
  )
  assert.match(result.summary, /14 of 18|14\/18|14 completed.*18/i)
  assert.match(result.summary, /strictly before .*45\+3/i)
})

test('changing only the historical interpretation to statistical still requires the statistical meaning category', async () => {
  const claim = quantitativeBeforeGoalClaim()
  claim.meaning.category = 'historical-circumstance'

  await assert.rejects(
    analyzeOpinion(
      request('How many passes had Northbridge completed before their goal at 45+3?'),
      providerWithClaim(claim),
    ),
    (error) =>
      error.category === 'semantic-validation' &&
      /intent does not match its evidence request/i.test(error.message),
  )
})

test('numerical comparison before a goal remains a factual claim with historical calculations', async () => {
  const result = await analyzeOpinion(
    request('Northbridge completed more passes than Eastport before Northbridge scored.'),
    providerWithClaim(numericalAssertionBeforeGoalClaim()),
  )
  const claim = result.claims[0]

  assert.equal(claim.claim.intent, 'factual-claim')
  assert.equal(claim.assessment, 'supported')
  assert.equal(claim.statistics.find(({ team }) => team === 'Northbridge')?.value, 14)
  assert.equal(claim.statistics.find(({ team }) => team === 'Eastport')?.value, 11)
  assert.equal(claim.claim.historicalEventAnchor?.eventId, 'event-07')
  assert.ok(
    claim.evidence
      .filter(({ reference }) => reference.id.startsWith('pass-'))
      .every(({ reference }) => {
        const pass = SYNTHETIC_MATCH_EVIDENCE.passes.find(
          (item) => item.id === reference.id,
        )
        const anchor = SYNTHETIC_MATCH_EVENTS.find(({ id }) => id === 'event-07')
        return pass && anchor && elapsedMatchMinute(pass.clock) < elapsedMatchMinute(anchor.clock)
      }),
  )
})

test('historical player statistics can be scoped before a team goal without asserting that player scored', async () => {
  const claim = quantitativeBeforeGoalClaim()
  claim.playerSubject = {
    id: 'north-player-08',
    name: 'Martin Ødegaard',
    team: 'Northbridge',
  }
  claim.playerMetric = 'pass-completions'
  claim.text = 'How many passes had Martin Ødegaard completed before Northbridge scored?'

  const result = await analyzeOpinion(
    request('How many passes had Martin Ødegaard completed before Northbridge scored?'),
    providerWithClaim(claim),
  )
  assert.equal(result.claims[0].claim.playerSubject?.id, 'north-player-08')
  assert.equal(
    result.claims[0].playerStatistics.find(
      ({ metric }) => metric === 'pass-completions',
    )?.value,
    2,
  )
  assert.equal(result.claims[0].claim.historicalEventAnchor?.eventId, 'event-07')
})

test('captured run-of-play judgement remains a qualified historical claim', async () => {
  const captured = attempt('F04')
  const result = await analyzeOpinion(
    request(captured.request.input),
    providerWithCapturedInterpretation('F04'),
  )
  const claim = result.claims[0]

  assert.equal(claim.claim.intent, 'factual-claim')
  assert.equal(claim.claim.meaning.category, 'historical-circumstance')
  assert.equal(claim.assessment, 'insufficient evidence for a firm conclusion')
  assert.equal(claim.claim.historicalEventAnchor?.eventId, 'event-10')
  assert.ok(
    claim.evidence.every(
      ({ role, reference }) =>
        role === 'anchor' || reference.id !== 'event-10',
    ),
  )
  assert.match(result.summary, /cannot establish/i)
})

test('captured ambiguous Bruno question still requests clarification without evidence', async () => {
  const captured = attempt('F05')
  const result = await analyzeOpinion(
    request(captured.request.input),
    providerWithCapturedInterpretation('F05'),
  )
  const claim = result.claims[0]

  assert.equal(claim.assessment, 'clarification needed')
  assert.match(claim.claim.clarificationNeeds.join(' '), /Bruno Fernandes.*Bruno Guimarães/)
  assert.deepEqual(claim.evidence, [])
  assert.deepEqual(claim.statistics, [])
})
