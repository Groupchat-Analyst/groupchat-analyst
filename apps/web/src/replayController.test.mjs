import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatMatchClock,
  getMatchTimeOptions,
} from '../../shared/src/matchClock.ts'
import { clockKey, REPLAY_LOAD_ERROR, ReplayController } from './replayController.ts'

const TIMELINE = getMatchTimeOptions()
const at = (period, minute, stoppageMinutes) => ({
  period,
  minute,
  ...(stoppageMinutes === undefined ? {} : { stoppageMinutes }),
})

function frameFor(clock) {
  const index = TIMELINE.findIndex((item) => clockKey(item) === clockKey(clock))
  const firstGoal = TIMELINE.findIndex((item) => clockKey(item) === clockKey(at(1, 45, 3)))
  const secondGoal = TIMELINE.findIndex((item) => clockKey(item) === clockKey(at(2, 58)))
  return {
    datasetId: 'fixture-a',
    datasetVersion: '1.0.0',
    selectedTime: formatMatchClock(clock),
    score: {
      Northbridge: index >= firstGoal ? 1 : 0,
      Eastport: index >= secondGoal ? 1 : 0,
    },
    events: Array.from(
      { length: index },
      (_, eventIndex) => ({
        id: `event-${eventIndex}`,
        time: formatMatchClock(TIMELINE[eventIndex]),
        team: eventIndex % 2 === 0 ? 'Northbridge' : 'Eastport',
        description: `Recorded moment ${eventIndex + 1}`,
        type: 'other',
      }),
    ),
  }
}

function createHarness(options = {}) {
  const { initial = at(2, 57), ignoreAbort = false, ...controllerOptions } = options
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
      const entry = { clock, resolve: null, reject: null, settled: false }
      const settle = (callback, value) => {
        if (entry.settled) return
        entry.settled = true
        active -= 1
        callback(value)
      }
      entry.resolve = (value) => settle(resolve, value)
      entry.reject = (error) => settle(reject, error)
      pending.push(entry)
      if (!ignoreAbort) {
        signal.addEventListener('abort', () => {
          entry.reject(new DOMException('aborted', 'AbortError'))
        })
      }
      entry.finish = () => {
        entry.resolve(frameFor(clock))
      }
    })
  }
  const controller = new ReplayController(TIMELINE, initial, loader, {
    timers,
    ...controllerOptions,
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
    get scheduledCount() {
      return scheduled.size
    },
    async reject(label, error) {
      const entry = pending.find((item) => formatMatchClock(item.clock) === label)
      assert.ok(entry, `expected a pending request for ${label}`)
      pending.splice(pending.indexOf(entry), 1)
      entry.reject(error)
      await flush()
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

test('initial load survives a React StrictMode start, dispose, start sequence', async () => {
  const harness = createHarness()
  harness.controller.start()
  harness.controller.dispose()
  harness.controller.start()
  await harness.flush()
  assert.deepEqual(harness.calls, ['57′', '57′'])
  assert.equal(harness.controller.getSnapshot().status, 'loading')

  // The first request was aborted by dispose; only the restarted request can settle the display.
  harness.pending.splice(0, 1)
  await harness.resolve('57′')
  const snapshot = harness.controller.getSnapshot()
  assert.equal(snapshot.displayed.selectedTime, '57′')
  assert.equal(snapshot.status, 'ready')
  assert.equal(snapshot.error, '')

  harness.controller.seek(at(2, 58))
  await harness.resolve('58′')
  assert.equal(harness.controller.getSnapshot().displayed.selectedTime, '58′')
})

test('a disposed controller can still be restarted after its request was aborted', async () => {
  const harness = createHarness()
  harness.controller.start()
  harness.controller.dispose()
  await harness.flush()
  assert.equal(harness.controller.getSnapshot().status, 'loading')
  assert.equal(harness.controller.getSnapshot().error, '')
  harness.controller.start()
  harness.pending.splice(0, 1)
  await harness.resolve('57′')
  assert.equal(harness.controller.getSnapshot().displayed.selectedTime, '57′')
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
  assert.deepEqual(harness.calls, ['57′', '60′', '70′', '83′'])
  await harness.resolve('83′')
  assert.equal(harness.controller.getSnapshot().displayed.selectedTime, '83′')
  assert.equal(harness.maxActive, 1)
})

test('1′ → 58′ → 20′ keeps the latest frame when replies arrive in reverse order', async () => {
  const harness = createHarness({ initial: at(1, 1), ignoreAbort: true })
  harness.controller.start()
  await harness.resolve('1′')

  harness.controller.seek(at(2, 58))
  harness.controller.seek(at(1, 20))
  assert.deepEqual(harness.calls, ['1′', '58′', '20′'])
  await harness.flush()
  assert.equal(harness.controller.getSnapshot().error, '')

  await harness.resolve('20′')
  const latest = harness.controller.getSnapshot()
  assert.equal(formatMatchClock(latest.requested), '20′')
  assert.equal(latest.displayed.selectedTime, '20′')
  assert.equal(latest.displayed.events.length, TIMELINE.findIndex((clock) => clockKey(clock) === clockKey(at(1, 20))))
  assert.equal(latest.displayed.datasetId, 'fixture-a')
  assert.deepEqual(latest.displayed.score, { Northbridge: 0, Eastport: 0 })
  assert.equal(latest.displayed.events.at(-1).time, '19′')

  await harness.resolve('58′')
  const afterLateResponse = harness.controller.getSnapshot()
  assert.equal(formatMatchClock(afterLateResponse.requested), '20′')
  assert.equal(afterLateResponse.displayed.selectedTime, '20′')
  assert.equal(afterLateResponse.displayed.events.length, latest.displayed.events.length)
  assert.equal(afterLateResponse.displayed.events.at(-1).time, '19′')
  assert.deepEqual(afterLateResponse.displayed.score, latest.displayed.score)
})

test('a late match response after A → B → A cannot replace the restarted A frame', async () => {
  const firstA = createHarness({ initial: at(1, 1), ignoreAbort: true })
  firstA.controller.start()
  const oldARequest = firstA.pending[0]
  firstA.controller.dispose()

  const matchB = createHarness({ initial: at(1, 1) })
  matchB.controller.start()
  await matchB.resolve('1′')

  firstA.controller.start()
  await firstA.flush()
  const currentARequest = firstA.pending[1]
  firstA.pending.splice(firstA.pending.indexOf(currentARequest), 1)
  currentARequest.finish()
  await firstA.flush()
  assert.equal(firstA.controller.getSnapshot().displayed.selectedTime, '1′')

  firstA.pending.splice(firstA.pending.indexOf(oldARequest), 1)
  oldARequest.finish()
  await firstA.flush()
  assert.equal(firstA.controller.getSnapshot().displayed.selectedTime, '1′')
  assert.equal(matchB.controller.getSnapshot().displayed.selectedTime, '1′')
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

test('playback starts from the first minute and advances to minute two after its dwell', async () => {
  const harness = createHarness({ initial: at(1, 1), dwellMs: 25 })
  harness.controller.start()
  await harness.resolve('1′')
  harness.controller.play()
  assert.deepEqual(harness.calls, ['1′', '2′'])
  await harness.advance(25)
  assert.equal(formatMatchClock(harness.controller.getSnapshot().requested), '2′')
  await harness.resolve('2′')
  assert.equal(harness.controller.getSnapshot().displayed.selectedTime, '2′')
  assert.equal(harness.controller.getSnapshot().playing, true)
})

test('playback crosses first-half added time into the second half exactly once', async () => {
  const harness = createHarness({ initial: at(1, 45, 2), dwellMs: 25 })
  harness.controller.start()
  await harness.resolve('45+2′')

  harness.controller.play()
  harness.controller.play()
  assert.deepEqual(harness.calls, ['45+2′', '45+3′'])
  assert.equal(harness.scheduledCount, 2, 'only one dwell timer and one frame timeout are scheduled')
  await harness.advance(25)
  assert.equal(formatMatchClock(harness.controller.getSnapshot().requested), '45+3′')
  await harness.resolve('45+3′')
  await harness.advance(25)
  assert.equal(formatMatchClock(harness.controller.getSnapshot().requested), '46′')
  await harness.resolve('46′')
  assert.equal(harness.controller.getSnapshot().displayed.selectedTime, '46′')
  assert.equal(harness.controller.getSnapshot().playing, true)
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

test('disposing a match cancels playback so its timer cannot advance a later match', async () => {
  const matchA = createHarness({ initial: at(1, 1), dwellMs: 100 })
  matchA.controller.start()
  await matchA.resolve('1′')
  matchA.controller.play()
  assert.equal(matchA.controller.getSnapshot().playing, true)
  matchA.controller.dispose()

  const matchB = createHarness({ initial: at(1, 1) })
  matchB.controller.start()
  await matchB.resolve('1′')
  await matchA.advance(10_000)

  assert.equal(matchA.controller.getSnapshot().playing, false)
  assert.equal(formatMatchClock(matchA.controller.getSnapshot().requested), '1′')
  assert.deepEqual(matchA.calls, ['1′', '2′'])
  assert.equal(formatMatchClock(matchB.controller.getSnapshot().requested), '1′')
  assert.equal(matchB.controller.getSnapshot().displayed.selectedTime, '1′')
})

test('transport and HTTP failures preserve the last frame and retry only the requested moment', async () => {
  for (const [failureType, error] of [
    ['transport', new TypeError('Failed to fetch')],
    ['HTTP', new Error('The synthetic replay is unavailable (HTTP 503).')],
  ]) {
    const harness = createHarness()
    harness.controller.start()
    await harness.resolve('57′')
    harness.controller.seek(at(2, 58))
    await harness.reject('58′', error)

    const failed = harness.controller.getSnapshot()
    assert.equal(failed.status, 'error', `${failureType} failure is visible`)
    assert.equal(failed.error, REPLAY_LOAD_ERROR, `${failureType} detail is not exposed`)
    assert.equal(failed.requested.minute, 58, `${failureType} retry target is retained`)
    assert.equal(failed.displayed.selectedTime, '57′', `${failureType} preserves the last frame`)
    assert.equal(failed.playing, false)

    harness.controller.retry()
    await harness.flush()
    assert.equal(harness.calls.at(-1), '58′', `${failureType} retries the requested moment`)
    await harness.resolve('58′')
    assert.equal(harness.controller.getSnapshot().displayed.selectedTime, '58′')
    assert.equal(harness.controller.getSnapshot().status, 'ready')
  }
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
  assert.equal(snapshot.error, REPLAY_LOAD_ERROR)
  await harness.advance(50_000)
  assert.deepEqual(harness.calls, ['57′'], 'a failed load does not retry automatically')
})
