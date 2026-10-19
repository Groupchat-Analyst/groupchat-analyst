import assert from 'node:assert/strict'
import test from 'node:test'
import { assessClaim } from './assessClaim.ts'
import { interpretClaim } from './interpretClaim.ts'
import {
  analyzeMatch,
  formatMatchClock,
  SYNTHETIC_MATCH_EVENTS,
} from './match.ts'

function clock(minute, period = 2, stoppageMinutes) {
  return stoppageMinutes === undefined
    ? { period, minute }
    : { period, minute, stoppageMinutes }
}

function checkClaim(text, minute, period = 'match-so-far', stoppageMinutes) {
  return checkClaims(text, minute, period, stoppageMinutes)[0]
}

function checkClaims(text, minute, period = 'match-so-far', stoppageMinutes) {
  const selectedClock = clock(minute, 2, stoppageMinutes)
  const interpretation = interpretClaim(text)
  const analysis = analyzeMatch(SYNTHETIC_MATCH_EVENTS, selectedClock, period)
  return assessClaim(
    interpretation,
    analysis,
    period,
    formatMatchClock(selectedClock),
  )
}

test('supports a correctly interpreted shot-on-target comparison with traceable evidence', () => {
  const result = checkClaim(
    'Eastport had more shots on target than Northbridge',
    58,
  )

  assert.equal(result.kind, 'assessed')
  assert.equal(result.status, 'supported')
  assert.equal(result.claim.metric, 'shots-on-target')
  assert.equal(result.claim.subject, 'Eastport')
  assert.equal(result.subjectValue, 3)
  assert.equal(result.opponentValue, 2)
  assert.deepEqual(
    result.supportingEvidence.map(({ id, time }) => [id, time]),
    [
      ['event-04', '31′'],
      ['event-08', '46′'],
      ['event-10', '58′'],
    ],
  )
  assert.ok(result.counterEvidence.every((reference) => reference.team === 'Northbridge'))
})

test('contradicts a comparison when the named team has fewer shots', () => {
  const result = checkClaim('Northbridge had more shots than Eastport', 90, 'match-so-far', 4)

  assert.equal(result.kind, 'assessed')
  assert.equal(result.status, 'contradicted')
  assert.equal(result.subjectValue, 7)
  assert.equal(result.opponentValue, 8)
  assert.equal(result.supportingEvidence.length, 0)
  assert.ok(result.counterEvidence.some((reference) => reference.team === 'Eastport'))
})

test('interprets negation as the complement of the comparison', () => {
  const result = checkClaim(
    'Northbridge did not have more shots than Eastport',
    58,
  )

  assert.equal(result.kind, 'assessed')
  assert.equal(result.status, 'supported')
  assert.equal(result.claim.comparison, 'less-or-equal')
  assert.match(result.claim.summary, /Northbridge had no more shots than Eastport/)
  assert.equal(result.subjectValue, 4)
  assert.equal(result.opponentValue, 5)
  assert.deepEqual(
    new Set(result.supportingEvidence.map((reference) => reference.team)),
    new Set(['Northbridge', 'Eastport']),
  )
  assert.equal(result.counterEvidence.length, 0)
})

test('interprets a negated fewer-than claim as greater-than-or-equal', () => {
  const result = checkClaim(
    'Northbridge did not have fewer shots than Eastport',
    58,
  )

  assert.equal(result.kind, 'assessed')
  assert.equal(result.claim.comparison, 'greater-or-equal')
  assert.equal(result.status, 'contradicted')
  assert.equal(result.subjectValue, 4)
  assert.equal(result.opponentValue, 5)
})

test('handles a negated goals comparison using the event-backed score', () => {
  const result = checkClaim(
    'Eastport did not score more goals than Northbridge',
    58,
  )

  assert.equal(result.kind, 'assessed')
  assert.equal(result.claim.comparison, 'less-or-equal')
  assert.equal(result.status, 'supported')
  assert.equal(result.subjectValue, 1)
  assert.equal(result.opponentValue, 1)
})

test('assesses goals from goal-shot events and cites only those events', () => {
  const result = checkClaim(
    'Eastport scored more goals than Northbridge',
    90,
    'match-so-far',
    4,
  )

  assert.equal(result.kind, 'assessed')
  assert.equal(result.status, 'supported')
  assert.equal(result.metricLabel, 'goals')
  assert.equal(result.subjectValue, 2)
  assert.equal(result.opponentValue, 1)
  assert.deepEqual(
    result.allReferences.map(({ id, time }) => [id, time]),
    [
      ['event-07', '45+3′'],
      ['event-10', '58′'],
      ['event-14', '83′'],
    ],
  )
})

test('asks for more evidence when no goals are recorded in the selected period', () => {
  const result = checkClaim(
    'Eastport scored more goals than Northbridge',
    56,
    'last-10-minutes',
  )

  assert.equal(result.kind, 'assessed')
  assert.equal(result.status, 'insufficient evidence for a firm conclusion')
  assert.equal(result.allReferences.length, 0)
})

test('asks for clarification when a comparison has no named teams', () => {
  const result = checkClaim('A team had more shots', 58)

  assert.equal(result.kind, 'clarification')
  assert.match(result.message, /identify the team/)
})

test('supports an equality claim when both teams have the same recorded count', () => {
  const result = checkClaim(
    'Northbridge had the same number of shots as Eastport',
    57,
  )

  assert.equal(result.kind, 'assessed')
  assert.equal(result.status, 'supported')
  assert.equal(result.claim.comparison, 'equal')
  assert.equal(result.subjectValue, 4)
  assert.equal(result.opponentValue, 4)
})

test('keeps broad possession and performance claims separate from a precise comparison', () => {
  const possession = checkClaim(
    'Northbridge dominated Eastport on possession and passing',
    90,
  )
  const player = interpretClaim('Player Milo had more shots on target than Eastport')

  assert.equal(possession.kind, 'partial')
  assert.match(possession.limitation, /not proof/)
  assert.equal(player.claims[0].kind, 'clarification')
  for (const broadOpinion of [
    'Northbridge dominated Eastport',
    'Northbridge played badly',
    'Northbridge deserved to win',
  ]) {
    assert.equal(checkClaim(broadOpinion, 90, 'match-so-far', 4).kind, 'partial')
  }
})

test('partially assesses the compound domination and luck example without redefining either claim', () => {
  const results = checkClaims(
    'Eastport dominated the game and Northbridge were lucky to get the goal they had.',
    90,
    'match-so-far',
    4,
  )

  assert.equal(results.length, 2)
  assert.ok(results.every((result) => result.kind === 'partial'))
  assert.deepEqual(
    results.map((result) => result.claim.text),
    [
      'Eastport dominated the game',
      'Northbridge were lucky to get the goal they had',
    ],
  )
  assert.ok(results.every((result) => result.status === 'insufficient evidence for a firm conclusion'))

  const dominance = results[0]
  assert.deepEqual(dominance.subjectStats, {
    shots: 8,
    'shots-on-target': 5,
    goals: 2,
  })
  assert.ok(dominance.subjectEvidence.some((reference) => reference.id === 'event-10'))
  assert.ok(dominance.otherTeamEvidence.some((reference) => reference.id === 'event-09'))
  assert.match(dominance.limitation, /relevant match context, not proof/)

  const luck = results[1]
  assert.equal(luck.subjectStats.goals, 1)
  assert.ok(luck.subjectEvidence.some((reference) => reference.id === 'event-07'))
  assert.match(luck.limitation, /No criteria for judging that opinion/)
})

test('filters broad-claim context to the selected time and evidence window', () => {
  const result = checkClaim(
    'Eastport dominated the game',
    58,
    'last-10-minutes',
  )

  assert.equal(result.kind, 'partial')
  assert.deepEqual(
    result.subjectEvidence.map(({ id }) => id),
    ['event-10'],
  )
  assert.deepEqual(
    result.otherTeamEvidence.map(({ id }) => id),
    ['event-09'],
  )
  assert.ok(
    [...result.subjectEvidence, ...result.otherTeamEvidence].every(({ id }) =>
      ['event-09', 'event-10'].includes(id),
    ),
  )
})

test('asks for clarification instead of resolving an ambiguous pronoun between claims', () => {
  const results = checkClaims(
    'Northbridge had more shots than Eastport and they dominated.',
    90,
    'match-so-far',
    4,
  )

  assert.equal(results.length, 2)
  assert.equal(results[0].kind, 'assessed')
  assert.equal(results[0].status, 'contradicted')
  assert.equal(results[1].kind, 'clarification')
  assert.match(results[1].message, /cannot reliably resolve pronouns/)
})

test('asks for clarification when a factual comparison names the same team twice', () => {
  const result = checkClaim('Northbridge had more shots than Northbridge', 90)

  assert.equal(result.kind, 'clarification')
  assert.match(result.message, /rather than comparing a team with itself/)
})

test('keeps precise factual subclaims verdict-based inside a compound opinion', () => {
  const results = checkClaims(
    'Northbridge had more shots than Eastport and Northbridge scored more goals than Eastport.',
    90,
    'match-so-far',
    4,
  )

  assert.deepEqual(
    results.map((result) => result.status),
    ['contradicted', 'contradicted'],
  )
  assert.ok(results.every((result) => result.kind === 'assessed'))
})

test('assesses the same shots-on-target claim differently before and after the 58th-minute goal', () => {
  const claim = 'Eastport had more shots on target than Northbridge'
  const beforeGoal = checkClaim(claim, 57)
  const afterGoal = checkClaim(claim, 58)

  assert.equal(beforeGoal.kind, 'assessed')
  assert.equal(beforeGoal.status, 'contradicted')
  assert.equal(beforeGoal.subjectValue, 2)
  assert.equal(beforeGoal.opponentValue, 2)
  assert.ok(
    beforeGoal.allReferences.every(
      (reference) => reference.id !== 'event-10' && reference.time !== '58′',
    ),
  )

  assert.equal(afterGoal.kind, 'assessed')
  assert.equal(afterGoal.status, 'supported')
  assert.equal(afterGoal.subjectValue, 3)
  assert.equal(afterGoal.opponentValue, 2)
  assert.ok(afterGoal.allReferences.some((reference) => reference.id === 'event-10'))
})

test('limits every reference to the selected evidence window', () => {
  const result = checkClaim(
    'Eastport had more shots on target than Northbridge',
    58,
    'last-10-minutes',
  )

  assert.equal(result.kind, 'assessed')
  assert.deepEqual(
    result.allReferences.map(({ id }) => id),
    ['event-10'],
  )
  assert.ok(result.allReferences.every((reference) => reference.time === '58′'))
})
