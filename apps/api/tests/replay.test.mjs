import assert from 'node:assert/strict'
import test from 'node:test'
import { getReplayFrame } from '../dist/api/src/functions/replay.js'

test('replay score changes between 57 and the 58th-minute equaliser', () => {
  const beforeEqualiser = getReplayFrame({ period: 2, minute: 57 })
  const atEqualiser = getReplayFrame({ period: 2, minute: 58 })

  assert.deepEqual(beforeEqualiser.score, { Northbridge: 1, Eastport: 0 })
  assert.ok(beforeEqualiser.events.every((event) => event.id !== 'event-10'))
  assert.deepEqual(atEqualiser.score, { Northbridge: 1, Eastport: 1 })
  assert.ok(atEqualiser.events.some((event) => event.id === 'event-10'))
  assert.ok(atEqualiser.events.every((event) => event.id !== 'event-14'))
})

test('replay preserves stoppage-time labels and excludes later events', () => {
  const firstHalf = getReplayFrame({
    period: 1,
    minute: 45,
    stoppageMinutes: 2,
  })
  const firstGoal = getReplayFrame({
    period: 1,
    minute: 45,
    stoppageMinutes: 3,
  })

  assert.equal(firstHalf.selectedTime, '45+2′')
  assert.ok(firstHalf.events.every((event) => event.id !== 'event-07'))
  assert.equal(firstGoal.selectedTime, '45+3′')
  assert.ok(firstGoal.events.some(
    (event) => event.id === 'event-07' && event.outcome === 'goal',
  ))
  assert.ok(firstGoal.events.every((event) => event.id !== 'event-08'))
})

test('replay rejects clocks that are not available in the fixture', () => {
  assert.throws(
    () => getReplayFrame({ period: 1, minute: 46 }),
    /valid match time/,
  )
  assert.throws(
    () => getReplayFrame({ period: 2, minute: 90, stoppageMinutes: 5 }),
    /valid match time/,
  )
  assert.throws(
    () => getReplayFrame({ period: 2, minute: 57, stoppageMinutes: '0' }),
    /valid match time/,
  )
})
