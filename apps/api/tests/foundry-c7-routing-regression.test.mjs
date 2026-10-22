import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

const verificationLedger = JSON.parse(
  readFileSync(
    new URL('../../../docs/foundry-c7-targeted-verification-ledger.json', import.meta.url),
    'utf8',
  ),
)
const earlierLedger = JSON.parse(
  readFileSync(
    new URL('../../../docs/foundry-5cd4f82-live-evaluation-ledger.json', import.meta.url),
    'utf8',
  ),
)

const request = (opinion) => ({
  opinion,
  selectedClock: { period: 2, minute: 90, stoppageMinutes: 4 },
  period: 'match-so-far',
})

function replayProvider(rawStructuredOutput) {
  return {
    name: 'foundry',
    async interpret() {
      return JSON.parse(rawStructuredOutput)
    },
  }
}

const verificationAttempt = (id) => {
  const attempt = verificationLedger.attempts.find((item) => item.id === id)
  assert.ok(attempt, `captured verification attempt ${id} exists`)
  return attempt
}

const earlierAttempt = (id) => {
  const attempt = earlierLedger.attempts.find((item) => item.attemptId === id)
  assert.ok(attempt, `captured earlier attempt ${id} exists`)
  return attempt
}

test('captured V04 remains a historical run-of-play claim with its exclusive event-10 anchor', async () => {
  const attempt = verificationAttempt('V04')
  const result = await analyzeOpinion(
    request(attempt.request.input),
    replayProvider(attempt.actual.rawStructuredModelOutput),
  )
  const answer = result.claims[0]

  assert.equal(answer.claim.intent, 'factual-claim')
  assert.equal(answer.claim.meaning.category, 'historical-circumstance')
  assert.deepEqual(answer.claim.timePeriod, {
    kind: 'before-event',
    eventId: 'event-10',
  })
  assert.equal(
    answer.evidence.find(({ role }) => role === 'anchor')?.reference.id,
    'event-10',
  )
  assert.deepEqual(
    answer.calculations
      .filter(({ metric }) => metric === 'possession-percentage')
      .map(({ team, value, numerator, denominator }) => [
        team,
        value,
        numerator,
        denominator,
      ]),
    [
      ['Northbridge', 56.1, 32, 57],
      ['Eastport', 43.9, 25, 57],
    ],
  )
  assert.match(answer.periodLabel, /strictly before 58′/)
  assert.ok(
    answer.evidence
      .filter(({ role }) => role !== 'anchor')
      .every(({ reference }) =>
        !['event-10', 'event-11'].includes(reference.id) &&
        !reference.id.startsWith('turnover-'),
      ),
  )
  assert.notEqual(answer.assessment, 'supported')
  assert.match(result.summary, /cannot establish whether.*against the run of play/i)
  assert.match(
    result.summary,
    /Eastport accounted for 43\.9% and Northbridge 56\.1% of recorded controlled-possession time/i,
  )
  assert.match(
    result.summary,
    /57 recorded minutes; contested and out-of-play intervals are excluded/i,
  )
  assert.match(result.summary, /territorial or chance-quality data/i)
  assert.doesNotMatch(result.summary, /annotated build-up sample|recorded losses/i)
})

test('captured D02 still returns only the five annotated Northbridge build-up losses', async () => {
  const attempt = earlierAttempt('D02')
  const result = await analyzeOpinion(
    request(attempt.request.input),
    replayProvider(attempt.rawModelOutput.content),
  )
  const answer = result.claims[0]
  const turnovers = answer.evidence
    .filter(({ reference }) => reference.id.startsWith('turnover-'))
    .map(({ reference }) => reference.id)

  assert.equal(answer.claim.intent, 'coaching-question')
  assert.equal(answer.claim.meaning.category, 'coaching-question')
  assert.deepEqual(turnovers, [
    'turnover-001',
    'turnover-003',
    'turnover-011',
    'turnover-014',
    'turnover-016',
  ])
  assert.deepEqual(
    answer.calculations.map(({ area, value, denominator }) => [
      area,
      value,
      denominator,
    ]),
    [
      ['defensive-third', 2, 5],
      ['middle-third', 2, 5],
      ['final-third', 1, 5],
    ],
  )
  assert.match(result.summary, /partial annotated sample, not a match-wide count/i)
  assert.doesNotMatch(result.summary, /30 of 38 passes|78\.9%/)
})

test('captured V01–V03 retain the exclusive 14 of 18 historical passing result', async () => {
  for (const id of ['V01', 'V02', 'V03']) {
    const attempt = verificationAttempt(id)
    const result = await analyzeOpinion(
      request(attempt.request.input),
      replayProvider(attempt.actual.rawStructuredModelOutput),
    )
    const answer = result.claims[0]

    assert.equal(answer.claim.intent, 'statistical-request', id)
    assert.deepEqual(answer.claim.timePeriod, {
      kind: 'before-event',
      eventId: 'event-07',
    })
    assert.deepEqual(
      answer.statistics.map(({ team, metric, value }) => [
        team,
        metric,
        value,
      ]),
      [
        ['Northbridge', 'pass-attempts', 18],
        ['Northbridge', 'pass-completions', 14],
        ['Northbridge', 'pass-completion-percentage', 77.8],
      ],
      id,
    )
    assert.match(result.summary, /14 of 18 passes \(77\.8%\)/, id)
    assert.match(result.summary, /strictly before Northbridge's goal at 45\+3′/, id)
    assert.ok(
      answer.evidence
        .filter(({ role }) => role !== 'anchor')
        .every(({ reference }) => reference.id !== 'event-07'),
      id,
    )
  }
})

test('incidental build-up evidence does not create phase scope for a statistical request', async () => {
  const claim = {
    id: 'count-build-up-passes',
    subject: 'Northbridge',
    playerSubject: null,
    playerMetric: null,
    text: 'How many passes did Northbridge complete?',
    intent: 'statistical-request',
    meaning: {
      category: 'other',
      description: 'Count completed passes.',
      comparison: null,
    },
    requiredEvidence: ['passing', 'build-up-phase', 'possession-losses'],
    timePeriod: { kind: 'selected' },
    historicalEventAnchor: null,
    clarificationNeeds: [],
  }
  const result = await analyzeOpinion(
    request('How many passes did Northbridge complete?'),
    { name: 'foundry', async interpret() { return { claims: [claim] } } },
  )

  assert.equal(result.claims[0].claim.intent, 'statistical-request')
  assert.equal(result.claims[0].claim.meaning.category, 'other')
  assert.deepEqual(result.claims[0].claim.requiredEvidence, [
    'passing',
    'build-up-phase',
    'possession-losses',
  ])
  assert.equal(
    result.claims[0].statistics.find(
      ({ team, metric }) =>
        team === 'Northbridge' && metric === 'pass-completions',
    )?.value,
    30,
  )
  assert.match(result.summary, /30 of 38 passes \(78\.9%\)/)
})

test('build-up evidence does not turn a factual comparison into coaching', async () => {
  const claim = {
    id: 'compare-pass-completion',
    subject: 'Northbridge',
    playerSubject: null,
    playerMetric: null,
    text: 'Northbridge completed a higher share of passes than Eastport.',
    intent: 'factual-claim',
    meaning: {
      category: 'factual-comparison',
      description: 'Compare pass completion percentages.',
      comparison: {
        opponent: 'Eastport',
        opponentPlayer: null,
        metric: 'pass-completion-percentage',
        operator: 'greater-than',
      },
    },
    requiredEvidence: ['build-up-phase', 'possession-losses', 'passing'],
    timePeriod: { kind: 'selected' },
    historicalEventAnchor: null,
    clarificationNeeds: [],
  }
  const result = await analyzeOpinion(
    request('Did Northbridge complete a higher share of passes than Eastport?'),
    { name: 'foundry', async interpret() { return { claims: [claim] } } },
  )

  assert.equal(result.claims[0].claim.intent, 'factual-claim')
  assert.equal(result.claims[0].claim.meaning.category, 'factual-comparison')
  assert.equal(
    result.claims[0].claim.meaning.comparison.metric,
    'pass-completion-percentage',
  )
  assert.equal(result.claims[0].assessment, 'supported')
  assert.deepEqual(
    result.claims[0].statistics
      .filter(({ metric }) => metric === 'pass-completion-percentage')
      .map(({ team, value }) => [team, value]),
    [
      ['Northbridge', 78.9],
      ['Eastport', 71.9],
    ],
  )
})

test('explicit build-up passing scope never falls back to full-match totals', async () => {
  const cases = [
    {
      input: 'How many passes did Northbridge complete during build-up?',
      claimText: 'How many passes did Northbridge complete during build-up?',
      intent: 'statistical-request',
      category: 'other',
      comparison: null,
      evidence: ['passing', 'build-up-phase', 'possession-losses'],
    },
    {
      input: 'What was Northbridge’s pass completion rate during build-up?',
      claimText: 'Northbridge pass completion rate during build-up.',
      intent: 'statistical-request',
      category: 'other',
      comparison: null,
      evidence: ['passing', 'build-up-phase'],
    },
    {
      input: 'Did Northbridge complete a higher share of passes than Eastport during build-up?',
      claimText: 'Northbridge completed a higher share of passes than Eastport during build-up.',
      intent: 'factual-claim',
      category: 'factual-comparison',
      comparison: {
        opponent: 'Eastport',
        opponentPlayer: null,
        metric: 'pass-completion-percentage',
        operator: 'greater-than',
      },
      evidence: ['passing', 'build-up-phase', 'possession-losses'],
    },
  ]

  for (const [index, item] of cases.entries()) {
    const claim = {
      id: `build-up-pass-${index}`,
      subject: 'Northbridge',
      playerSubject: null,
      playerMetric: null,
      text: item.claimText,
      intent: item.intent,
      meaning: {
        category: item.category,
        description: item.claimText,
        comparison: item.comparison,
      },
      requiredEvidence: item.evidence,
      timePeriod: { kind: 'selected' },
      historicalEventAnchor: null,
      clarificationNeeds: [],
    }
    const result = await analyzeOpinion(
      request(item.input),
      { name: 'foundry', async interpret() { return { claims: [claim] } } },
    )
    const answer = result.claims[0]

    assert.equal(answer.assessment, 'unavailable data', item.input)
    assert.deepEqual(answer.statistics, [], item.input)
    assert.deepEqual(answer.playerStatistics, [], item.input)
    assert.deepEqual(answer.calculations, [], item.input)
    assert.deepEqual(answer.playerCalculations, [], item.input)
    assert.deepEqual(answer.evidence, [], item.input)
    assert.doesNotMatch(JSON.stringify(answer), /30 of 38|78\.9%/, item.input)
    assert.match(answer.limitation, /phase-scoped pass (?:counts|rates|comparisons).*not available/i)
    assert.equal(
      answer.evidenceAvailability.find(({ kind }) => kind === 'passing')
        ?.available,
      false,
      item.input,
    )
    assert.match(
      answer.evidenceAvailability.find(({ kind }) => kind === 'passing')
        ?.detail ?? '',
      /General match totals are not substituted/i,
    )
    assert.equal(
      answer.claim.requiredEvidence.includes('build-up-phase'),
      true,
      item.input,
    )
    assert.doesNotMatch(result.summary, /30 of 38|78\.9%|pass completion rate.*recorded/i)
    assert.match(result.summary, /phase-scoped pass (?:counts|rates|comparisons).*not available/i)
  }
})
