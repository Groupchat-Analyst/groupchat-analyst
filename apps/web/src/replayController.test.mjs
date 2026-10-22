import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatMatchClock,
  getMatchTimeOptions,
} from '../../shared/src/matchClock.ts'
import { clockKey, ReplayController } from './replayController.ts'

const TIMELINE = getMatchTimeOptions()
const at = (period, minute, stoppageMinutes) => ({
  period,
  minute,
  ...(stoppageMinutes === undefined ? {} : { stoppageMinutes }),
})

function frameFor(clock) {
  return {
    selectedTime: formatMatchClock(clock),
    score: { Northbridge: 0, Eastport: 0 },
    events: Array.from(
      { length: TIMELINE.findIndex((item) => clockKey(item) === clockKey(clock)) },
      (_, index) => ({ id: `event-${index}` }),
    ),
  }
}

function createHarness(options = {}) {
  const pending = []
  const calls = []
  let active = 0
  let maxActive = 0
  const scheduled = new Map()
  let nextTimer = 1
  let now = 0
  const timers = {
    setTimeout(callback, ms) {
      const id = nextTimer++
      scheduled.set(id, { at: now + ms, callback })
      return id
    },
    clearTimeout(id) {
      scheduled.delete(id)
    },
  }
  const loader = (clock, signal) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    calls.push(formatMatchClock(clock))
    return new Promise((resolve, reject) => {
      const entry = { clock, resolve, reject }
      pending.push(entry)
      signal.addEventListener('abort', () => {
        active -= 1
        reject(new DOMException('aborted', 'AbortError'))
      })
      entry.finish = () => {
        active -= 1
        resolve(frameFor(clock))
      }
    })
  }
  const controller = new ReplayController(TIMELINE, at(2, 57), loader, {
    timers,
    ...options,
  })
  const flush = async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve()
  }
  return {
    controller,
    calls,
    pending,
    flush,
    get maxActive() {
      return maxActive
    },
    async resolve(label) {
      const entry = pending.find((item) => formatMatchClock(item.clock) === label)
      assert.ok(entry, `expected a pending request for ${label}`)
      pending.splice(pending.indexOf(entry), 1)
      entry.finish()
      await flush()
    },
    async advance(ms) {
      now += ms
      for (const [id, timer] of [...scheduled]) {
        if (timer.at <= now) {
          scheduled.delete(id)
          timer.callback()
        }
      }
      await flush()
    },
  }
}

test('initial load displays the requested frame only when it arrives', async () => {
  const harness = createHarness()
  harness.controller.start()
  assert.equal(harness.controller.getSnapshot().displayed, null)
  assert.equal(harness.controller.getSnapshot().status, 'loading')
  await harness.resolve('57′')
  const snapshot = harness.controller.getSnapshot()
  assert.equal(snapshot.displayed.selectedTime, '57′')
  assert.equal(snapshot.status, 'ready')
})

test('a delayed response keeps the previous coherent frame displayed', async () => {
  const harness = createHarness()
  harness.controller.start()
  await harness.resolve('57′')
  harness.controller.seek(at(2, 58))
  const waiting = harness.controller.getSnapshot()
  assert.equal(waiting.displayed.selectedTime, '57′')
  assert.equal(formatMatchClock(waiting.requested), '58′')
  assert.equal(waiting.status, 'loading')
  await harness.resolve('58′')
  assert.equal(harness.controller.getSnapshot().displayed.selectedTime, '58′')
})

test('rapid seeking keeps one request in flight and never shows a superseded frame', async () => {
  const harness = createHarness()
  harness.controller.start()
  await harness.resolve('57′')
  harness.controller.seek(at(2, 60))
  harness.controller.seek(at(2, 70))
  harness.controller.seek(at(2, 83))
  assert.deepEqual(harness.calls, ['57′', '60′'])
  await harness.resolve('60′')
  assert.equal(
    harness.controller.getSnapshot().displayed.selectedTime,
    '57′',
    'the 60′ response was superseded and must not replace the display',
  )
  assert.deepEqual(harness.calls, ['57′', '60′', '83′'])
  await harness.resolve('83′')
  assert.equal(harness.controller.getSnapshot().displayed.selectedTime, '83′')
  assert.equal(harness.maxActive, 1)
})

test('backward seeking replaces the frame so later events disappear', async () => {
  const harness = createHarness()
  harness.controller.start()
  await harness.resolve('57′')
  harness.controller.seek(at(2, 83))
  await harness.resolve('83′')
  const later = harness.controller.getSnapshot().displayed.events.length
  harness.controller.seek(at(2, 57))
  const earlier = harness.controller.getSnapshot()
  assert.equal(earlier.displayed.selectedTime, '57′')
  assert.ok(earlier.displayed.events.length < later)
  assert.equal(harness.calls.filter((label) => label === '57′').length, 1)
})

test('playback is sequential, prefetches one frame and waits for slow responses', async () => {
  const harness = createHarness({ dwellMs: 900 })
  harness.controller.start()
  await harness.resolve('57′')
  harness.controller.play()
  await harness.flush()
  assert.deepEqual(harness.calls, ['57′', '58′'])
  await harness.advance(899)
  assert.equal(harness.controller.getSnapshot().displayed.selectedTime, '57′')
  await harness.resolve('58′')
  assert.equal(
    harness.controller.getSnapshot().displayed.selectedTime,
    '57′',
    'a prefetched frame is not shown before its dwell elapses',
  )
  await harness.advance(1)
  assert.equal(harness.controller.getSnapshot().displayed.selectedTime, '58′')
  await harness.advance(900)
  assert.deepEqual(harness.calls, ['57′', '58′', '59′'])
  await harness.resolve('59′')
  assert.equal(harness.controller.getSnapshot().displayed.selectedTime, '59′')
  assert.equal(harness.maxActive, 1)
  assert.ok(harness.controller.getSnapshot().playing)
})

test('playback waits for a delayed frame instead of advancing the display', async () => {
  const harness = createHarness({ dwellMs: 100 })
  harness.controller.start()
  await harness.resolve('57′')
  harness.controller.play()
  await harness.advance(100)
  const snapshot = harness.controller.getSnapshot()
  assert.equal(formatMatchClock(snapshot.requested), '58′')
  assert.equal(snapshot.displayed.selectedTime, '57′')
  assert.equal(snapshot.status, 'loading')
  await harness.advance(5000)
  assert.equal(harness.controller.getSnapshot().displayed.selectedTime, '57′')
  await harness.resolve('58′')
  assert.equal(harness.controller.getSnapshot().displayed.selectedTime, '58′')
})

test('pausing and manual seeking cancel pending playback steps', async () => {
  const harness = createHarness({ dwellMs: 100 })
  harness.controller.start()
  await harness.resolve('57′')
  harness.controller.play()
  harness.controller.pause()
  await harness.advance(1000)
  assert.equal(formatMatchClock(harness.controller.getSnapshot().requested), '57′')
  assert.equal(harness.controller.getSnapshot().playing, false)
})

test('a failed frame keeps the old frame, reports the error and can be retried', async () => {
  const harness = createHarness()
  harness.controller.start()
  await harness.resolve('57′')
  harness.controller.seek(at(2, 58))
  harness.pending[0].reject(new Error('Replay unavailable.'))
  await harness.flush()
  const failed = harness.controller.getSnapshot()
  assert.equal(failed.status, 'error')
  assert.equal(failed.error, 'Replay unavailable.')
  assert.equal(failed.displayed.selectedTime, '57′')
  assert.equal(failed.playing, false)
  harness.pending.length = 0
  harness.controller.retry()
  await harness.flush()
  await harness.resolve('58′')
  assert.equal(harness.controller.getSnapshot().displayed.selectedTime, '58′')
  assert.equal(harness.controller.getSnapshot().status, 'ready')
})

test('a frame for the wrong moment is rejected rather than displayed', async () => {
  const harness = createHarness()
  harness.controller.start()
  const [entry] = harness.pending
  harness.pending.length = 0
  entry.resolve({ ...frameFor(at(2, 58)), selectedTime: '58′' })
  await harness.flush()
  const snapshot = harness.controller.getSnapshot()
  assert.equal(snapshot.displayed, null)
  assert.equal(snapshot.status, 'error')
})

test('playback stops at full time and replays from the start', async () => {
  const harness = createHarness({ dwellMs: 10 })
  const last = TIMELINE[TIMELINE.length - 1]
  harness.controller.seek(TIMELINE[TIMELINE.length - 2])
  harness.controller.start()
  await harness.resolve(formatMatchClock(TIMELINE[TIMELINE.length - 2]))
  harness.controller.play()
  await harness.flush()
  await harness.resolve(formatMatchClock(last))
  await harness.advance(10)
  const finished = harness.controller.getSnapshot()
  assert.equal(finished.displayed.selectedTime, '90+4′')
  assert.equal(finished.playing, false)
  harness.controller.play()
  assert.equal(formatMatchClock(harness.controller.getSnapshot().requested), '1′')
})

test('seeking only accepts moments from the fixture timeline', async () => {
  const harness = createHarness()
  harness.controller.start()
  await harness.resolve('57′')
  harness.controller.seek(at(1, 46))
  assert.equal(formatMatchClock(harness.controller.getSnapshot().requested), '57′')
  harness.controller.seek(at(1, 45, 3))
  assert.equal(formatMatchClock(harness.controller.getSnapshot().requested), '45+3′')
})

test('a slow request times out with a clear error', async () => {
  const harness = createHarness({ timeoutMs: 50 })
  harness.controller.start()
  await harness.advance(50)
  const snapshot = harness.controller.getSnapshot()
  assert.equal(snapshot.status, 'error')
  assert.match(snapshot.error, /too long/)
})
