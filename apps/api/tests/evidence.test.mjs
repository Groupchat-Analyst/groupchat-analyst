import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateEvidence,
  classifyPitchArea,
  SYNTHETIC_MATCH_EVIDENCE,
} from '../dist/shared/src/evidence.js'
import { elapsedMatchMinute } from '../dist/shared/src/matchClock.js'
import { SYNTHETIC_MATCH_EVENTS } from '../dist/shared/src/match.js'

function smallFixture() {
  return {
    ...structuredClone(SYNTHETIC_MATCH_EVIDENCE),
    coverage: {
      start: { period: 1, minute: 1 },
      end: { period: 1, minute: 11 },
      completeForPossessionIntervals: true,
      completeForPassEvents: true,
      completeForTurnovers: true,
      missingPeriods: [],
    },
    possessions: [
      {
        id: 'small-north-possession',
        team: 'Northbridge',
        status: 'controlled',
        start: { period: 1, minute: 1 },
        end: { period: 1, minute: 6 },
        relatedEventIds: [],
        endReason: 'turnover',
      },
      {
        id: 'small-contested',
        team: null,
        status: 'contested',
        start: { period: 1, minute: 6 },
        end: { period: 1, minute: 7 },
        relatedEventIds: [],
        endReason: 'contested',
      },
      {
        id: 'small-dead-ball',
        team: null,
        status: 'out-of-play',
        start: { period: 1, minute: 7 },
        end: { period: 1, minute: 8 },
        relatedEventIds: [],
        endReason: 'out-of-play',
      },
      {
        id: 'small-east-possession',
        team: 'Eastport',
        status: 'controlled',
        start: { period: 1, minute: 8 },
        end: { period: 1, minute: 11 },
        relatedEventIds: [],
        endReason: 'period-end',
      },
    ],
    passes: [
      {
        id: 'small-pass-01',
        possessionId: 'small-north-possession',
        team: 'Northbridge',
        playerId: 'north-player-01',
        clock: { period: 1, minute: 2 },
        start: { x: 60, y: 40 },
        end: { x: 70, y: 45 },
        outcome: 'complete',
        qualifiers: [],
      },
      {
        id: 'small-pass-02',
        possessionId: 'small-north-possession',
        team: 'Northbridge',
        playerId: 'north-player-02',
        clock: { period: 1, minute: 5 },
        start: { x: 20, y: 20 },
        end: { x: 25, y: 20 },
        outcome: 'incomplete',
        qualifiers: ['turnover'],
      },
      {
        id: 'small-pass-03',
        possessionId: 'small-east-possession',
        team: 'Eastport',
        playerId: 'east-player-01',
        clock: { period: 1, minute: 9 },
        start: { x: 60, y: 40 },
        end: { x: 70, y: 45 },
        outcome: 'complete',
        qualifiers: [],
      },
      {
        id: 'small-pass-future',
        possessionId: 'small-east-possession',
        team: 'Eastport',
        playerId: 'east-player-02',
        clock: { period: 1, minute: 11 },
        start: { x: 70, y: 45 },
        end: { x: 80, y: 45 },
        outcome: 'complete',
        qualifiers: [],
      },
    ],
    turnovers: [
      {
        id: 'small-turnover-01',
        possessionId: 'small-north-possession',
        team: 'Northbridge',
        clock: { period: 1, minute: 5 },
        location: { x: 25, y: 20 },
        lostPassId: 'small-pass-02',
        recoveredBy: 'Eastport',
      },
    ],
    recoveries: [
      {
        id: 'small-recovery-01',
        team: 'Eastport',
        clock: { period: 1, minute: 5 },
        location: { x: 25, y: 20 },
        turnoverId: 'small-turnover-01',
      },
    ],
    pressures: [],
  }
}

test('calculates possession, pass accuracy, turnovers, and final-third entries from a manual sample', () => {
  const result = calculateEvidence(
    smallFixture(),
    { period: 1, minute: 10 },
    'match-so-far',
  )

  assert.equal(result.teams.Northbridge.possessionMinutes, 5)
  assert.equal(result.teams.Eastport.possessionMinutes, 2)
  assert.equal(result.denominatorMinutes, 7)
  assert.equal(result.teams.Northbridge.possessionPercentage, 71.4)
  assert.equal(result.teams.Eastport.possessionPercentage, 28.6)
  assert.equal(result.excludedOutOfPlayMinutes, 1)
  assert.equal(result.contestedMinutes, 1)
  assert.equal(result.teams.Northbridge.passAttempts, 2)
  assert.equal(result.teams.Northbridge.completedPasses, 1)
  assert.equal(result.teams.Northbridge.passCompletionPercentage, 50)
  assert.equal(result.teams.Eastport.passCompletionPercentage, 100)
  assert.equal(
    result.teams.Northbridge.possessionLosses['defensive-third'],
    1,
  )
  assert.equal(result.teams.Eastport.finalThirdEntries, 1)
  assert.ok(result.passes.every(({ id }) => id !== 'small-pass-future'))
  const clipped = result.possessionIntervals.find(
    ({ id }) => id === 'small-east-possession',
  )
  assert.equal(clipped.end.minute, 10)
  assert.equal(clipped.endReason, undefined)
})

test('clips possession windows across half-time without counting half-time minutes', () => {
  const fixture = smallFixture()
  fixture.coverage.start = { period: 1, minute: 40 }
  fixture.coverage.end = { period: 2, minute: 51 }
  fixture.possessions = [
    {
      id: 'first-half-possession',
      team: 'Northbridge',
      status: 'controlled',
      start: { period: 1, minute: 40 },
      end: { period: 1, minute: 45, stoppageMinutes: 3 },
      relatedEventIds: [],
      endReason: 'period-end',
    },
    {
      id: 'second-half-possession',
      team: 'Eastport',
      status: 'controlled',
      start: { period: 2, minute: 46 },
      end: { period: 2, minute: 51 },
      relatedEventIds: [],
      endReason: 'period-end',
    },
  ]
  fixture.passes = []
  fixture.turnovers = []
  fixture.recoveries = []

  const result = calculateEvidence(
    fixture,
    { period: 2, minute: 51 },
    'last-10-minutes',
  )

  assert.equal(result.teams.Northbridge.possessionMinutes, 4)
  assert.equal(result.teams.Eastport.possessionMinutes, 5)
  assert.equal(result.denominatorMinutes, 9)
  assert.equal(result.possessionIntervals.length, 2)
  assert.equal(result.possessionIntervals[0].start.minute, 44)
})

test('keeps incomplete coverage distinct from a recorded zero percentage', () => {
  const fixture = smallFixture()
  fixture.coverage.completeForPossessionIntervals = false
  fixture.coverage.completeForPassEvents = false
  fixture.coverage.missingPeriods = ['first-half 6′–8′']
  const result = calculateEvidence(
    fixture,
    { period: 1, minute: 10 },
    'match-so-far',
  )

  assert.equal(result.possessionCoverageComplete, false)
  assert.deepEqual(result.missingCoveragePeriods, ['first-half 6′–8′'])
  assert.equal(result.teams.Northbridge.possessionMinutes, 5)
  assert.equal(result.teams.Northbridge.possessionPercentage, null)
  assert.equal(result.teams.Northbridge.passCompletionPercentage, null)
})

test('uses documented normalized pitch thirds for endpoints', () => {
  assert.equal(classifyPitchArea({ x: 20, y: 50 }), 'defensive-third')
  assert.equal(classifyPitchArea({ x: 50, y: 50 }), 'middle-third')
  assert.equal(classifyPitchArea({ x: 70, y: 50 }), 'final-third')
})

test('richer fixture keeps stable IDs, player/team links, and the original goal events', () => {
  const ids = [
    ...SYNTHETIC_MATCH_EVIDENCE.possessions.map(({ id }) => id),
    ...SYNTHETIC_MATCH_EVIDENCE.passes.map(({ id }) => id),
    ...SYNTHETIC_MATCH_EVIDENCE.turnovers.map(({ id }) => id),
    ...SYNTHETIC_MATCH_EVIDENCE.recoveries.map(({ id }) => id),
    ...SYNTHETIC_MATCH_EVIDENCE.pressures.map(({ id }) => id),
  ]
  const playerIds = new Set(
    SYNTHETIC_MATCH_EVIDENCE.players.map(({ id }) => id),
  )
  const possessionIds = new Set(
    SYNTHETIC_MATCH_EVIDENCE.possessions.map(({ id }) => id),
  )

  assert.equal(new Set(ids).size, ids.length)
  assert.ok(SYNTHETIC_MATCH_EVIDENCE.passes.every(
    (pass) => playerIds.has(pass.playerId) && possessionIds.has(pass.possessionId),
  ))
  assert.ok(SYNTHETIC_MATCH_EVIDENCE.passes.every((pass) => {
    const sequence = SYNTHETIC_MATCH_EVIDENCE.possessions.find(
      ({ id }) => id === pass.possessionId,
    )
    return sequence &&
      sequence.team === pass.team &&
      elapsedMatchMinute(pass.clock) >= elapsedMatchMinute(sequence.start) &&
      elapsedMatchMinute(pass.clock) <= elapsedMatchMinute(sequence.end)
  }))
  assert.ok(SYNTHETIC_MATCH_EVIDENCE.turnovers.every((turnover) => {
    const linkedPass = SYNTHETIC_MATCH_EVIDENCE.passes.find(
      ({ id }) => id === turnover.lostPassId,
    )
    const linkedRecovery = SYNTHETIC_MATCH_EVIDENCE.recoveries.find(
      ({ turnoverId }) => turnoverId === turnover.id,
    )
    return linkedPass?.outcome === 'incomplete' &&
      linkedRecovery?.team === turnover.recoveredBy
  }))
  assert.ok(SYNTHETIC_MATCH_EVIDENCE.possessions.every((sequence) =>
    sequence.endReason !== 'turnover' ||
    SYNTHETIC_MATCH_EVIDENCE.turnovers.some(
      ({ possessionId }) => possessionId === sequence.id,
    ),
  ))
  for (const sequence of SYNTHETIC_MATCH_EVIDENCE.possessions) {
    const relatedEvents = SYNTHETIC_MATCH_EVENTS.filter(({ id }) =>
      sequence.relatedEventIds.includes(id),
    )
    assert.ok(relatedEvents.every((event) =>
      event.team === sequence.team &&
      elapsedMatchMinute(event.clock) >= elapsedMatchMinute(sequence.start) &&
      elapsedMatchMinute(event.clock) <= elapsedMatchMinute(sequence.end),
    ))
  }
  for (const sequenceId of possessionIds) {
    const sequencePasses = SYNTHETIC_MATCH_EVIDENCE.passes.filter(
      ({ possessionId }) => possessionId === sequenceId,
    )
    for (let index = 1; index < sequencePasses.length; index += 1) {
      assert.deepEqual(
        sequencePasses[index].start,
        sequencePasses[index - 1].end,
      )
    }
  }
  assert.equal(
    SYNTHETIC_MATCH_EVIDENCE.players.filter(({ status }) => status === 'starter').length,
    22,
  )
  assert.ok(SYNTHETIC_MATCH_EVIDENCE.possessions.some(
    (interval) => interval.relatedEventIds.includes('event-07'),
  ))
  assert.equal(SYNTHETIC_MATCH_EVIDENCE.dataset.provenance, 'synthetic')
  assert.equal(SYNTHETIC_MATCH_EVIDENCE.coverage.completeForPossessionIntervals, true)
})
