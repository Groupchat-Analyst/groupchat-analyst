import assert from 'node:assert/strict'
import test from 'node:test'
import {
  analyzeMatch,
  elapsedMatchMinute,
  formatMatchClock,
  getMatchTimeOptions,
  SYNTHETIC_MATCH_EVENTS,
} from './match.ts'

function clock(period, minute, stoppageMinutes) {
  return stoppageMinutes === undefined
    ? { period, minute }
    : { period, minute, stoppageMinutes }
}

test('counts a goal as one shot on target and updates the score once', () => {
  const result = analyzeMatch(SYNTHETIC_MATCH_EVENTS, clock(1, 45, 3), 'match-so-far')

  assert.deepEqual(result.score, { Northbridge: 1, Eastport: 0 })
  assert.deepEqual(result.shots, {
    Northbridge: { shots: 3, shotsOnTarget: 2 },
    Eastport: { shots: 3, shotsOnTarget: 1 },
  })
  assert.equal(
    result.periodEvents.filter((event) => event.type === 'shot').length,
    6,
  )
})

test('includes an event exactly at the selected time', () => {
  const result = analyzeMatch(SYNTHETIC_MATCH_EVENTS, clock(2, 58), 'last-10-minutes')

  assert.deepEqual(result.score, { Northbridge: 1, Eastport: 1 })
  assert.deepEqual(
    result.periodEvents.map((event) => event.id),
    ['event-09', 'event-10'],
  )
  assert.deepEqual(result.shots.Eastport, { shots: 1, shotsOnTarget: 1 })
})

test('includes an event exactly at the ten-minute window start', () => {
  const result = analyzeMatch(SYNTHETIC_MATCH_EVENTS, clock(2, 56), 'last-10-minutes')

  assert.equal(elapsedMatchMinute(clock(2, 56)) - 10, elapsedMatchMinute(clock(2, 46)))
  assert.ok(result.periodEvents.some((event) => event.id === 'event-08'))
})

test('counts a ten-minute window across half-time using minutes played', () => {
  const selectedClock = clock(2, 51)
  const result = analyzeMatch(
    SYNTHETIC_MATCH_EVENTS,
    selectedClock,
    'last-10-minutes',
  )

  assert.equal(elapsedMatchMinute(clock(1, 45, 3)), 48)
  assert.equal(elapsedMatchMinute(clock(2, 46)), 49)
  assert.deepEqual(
    result.periodEvents.map((event) => event.id),
    ['event-06', 'event-07', 'event-08', 'event-09'],
  )
  assert.deepEqual(result.shots, {
    Northbridge: { shots: 2, shotsOnTarget: 1 },
    Eastport: { shots: 2, shotsOnTarget: 1 },
  })
})

test('excludes all events after the selected time from the score and period', () => {
  const result = analyzeMatch(SYNTHETIC_MATCH_EVENTS, clock(2, 58), 'match-so-far')

  assert.ok(
    SYNTHETIC_MATCH_EVENTS.some(
      (event) => event.id === 'event-14' && event.type === 'shot' && event.outcome === 'goal',
    ),
  )
  assert.deepEqual(
    result.periodEvents.map((event) => event.id),
    [
      'event-01',
      'event-02',
      'event-03',
      'event-04',
      'event-05',
      'event-06',
      'event-07',
      'event-08',
      'event-09',
      'event-10',
    ],
  )
  assert.deepEqual(result.score, { Northbridge: 1, Eastport: 1 })
  assert.deepEqual(result.shots, {
    Northbridge: { shots: 4, shotsOnTarget: 2 },
    Eastport: { shots: 5, shotsOnTarget: 3 },
  })
})

test('formats stoppage time and offers every match minute for selection', () => {
  const times = getMatchTimeOptions()

  assert.equal(formatMatchClock(clock(1, 45, 2)), '45+2′')
  assert.equal(formatMatchClock(clock(2, 90, 4)), '90+4′')
  assert.equal(times.length, 97)
  assert.deepEqual(
    times.map(elapsedMatchMinute),
    [...times.map(elapsedMatchMinute)].sort((first, second) => first - second),
  )
})

test('explains the limitation of shot counts without claiming overall superiority', () => {
  const result = analyzeMatch(SYNTHETIC_MATCH_EVENTS, clock(2, 90, 4), 'match-so-far')

  assert.match(
    result.explanation,
    /Shot counts describe attempts and accuracy, but alone cannot establish which team played better overall/,
  )
})
