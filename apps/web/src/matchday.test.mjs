import assert from 'node:assert/strict'
import test from 'node:test'
import { formatMatchClock } from '../../shared/src/matchClock.ts'
import {
  createAnalysisRequest,
  createSubmissionContext,
  isLatestRequest,
  isSubmissionScopeCurrent,
  replayEventsAtOrBefore,
} from './matchday.ts'

test('submission scope is copied and remains tied to the submitted match time', () => {
  const clock = { period: 2, minute: 57 }
  const submitted = createSubmissionContext('Eastport will equalise.', clock, 'match-so-far')
  clock.minute = 58

  assert.equal(formatMatchClock(submitted.selectedClock), '57′')
  assert.deepEqual(createAnalysisRequest(submitted), {
    opinion: 'Eastport will equalise.',
    selectedClock: { period: 2, minute: 57 },
    period: 'match-so-far',
  })
  assert.equal(
    isSubmissionScopeCurrent(submitted, { period: 2, minute: 57 }, 'match-so-far'),
    true,
  )
  assert.equal(
    isSubmissionScopeCurrent(submitted, { period: 2, minute: 58 }, 'match-so-far'),
    false,
  )
  assert.equal(
    isSubmissionScopeCurrent(submitted, { period: 2, minute: 57 }, 'last-10-minutes'),
    false,
  )
})

test('replay events are shown only for the exact server-selected frame', () => {
  const frame = {
    selectedTime: '57′',
    score: { Northbridge: 1, Eastport: 0 },
    events: [{ id: 'event-07' }, { id: 'event-09' }],
  }

  assert.deepEqual(replayEventsAtOrBefore(frame, '57′'), frame.events)
  assert.deepEqual(replayEventsAtOrBefore(frame, '58′'), [])
})

test('an earlier asynchronous response cannot replace the latest request', () => {
  assert.equal(isLatestRequest(4, 4), true)
  assert.equal(isLatestRequest(3, 4), false)
})
