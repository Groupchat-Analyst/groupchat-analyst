import assert from 'node:assert/strict'
import test from 'node:test'
import { ANALYSIS_TIMEOUT_MS, AnalysisTimeoutError, requestAnalysis, requestFoundryAccess } from './analysisClient.ts'

function fakeTimers() {
  const timers = new Map()
  let next = 1
  return {
    timers,
    setTimer: (callback, ms) => { timers.set(next, { callback, ms }); return next++ },
    clearTimer: (handle) => { timers.delete(handle) },
    fire: () => { for (const [handle, { callback }] of [...timers]) { timers.delete(handle); callback() } },
  }
}

function jsonResponse(body, status = 200) {
  return { ok: status < 200 || status >= 300 ? false : true, status, text: async () => JSON.stringify(body) }
}

test('the client deadline outlasts the 30 s provider deadline', () => {
  assert.ok(ANALYSIS_TIMEOUT_MS > 30_000)
})

test('a never-settling request times out, aborts the fetch and clears the timer', async () => {
  const clock = fakeTimers()
  let signal
  const fetchImpl = (_url, init) => { signal = init.signal; return new Promise(() => {}) }
  const pending = requestAnalysis({ q: 1 }, { fetchImpl, timeoutMs: 1000, ...clock })
  assert.equal([...clock.timers.values()][0].ms, 1000)
  clock.fire()
  await assert.rejects(pending, (error) => error instanceof AnalysisTimeoutError && /stopped waiting after 1 seconds/.test(error.message) && /doesn’t guarantee/.test(error.message))
  assert.equal(signal.aborted, true)
  assert.equal(clock.timers.size, 0)
})

test('a late completion after the timeout is ignored and does not raise', async () => {
  const clock = fakeTimers()
  let finish
  const fetchImpl = () => new Promise((resolve) => { finish = () => resolve(jsonResponse({ late: true })) })
  const pending = requestAnalysis({}, { fetchImpl, timeoutMs: 10, ...clock })
  clock.fire()
  await assert.rejects(pending, AnalysisTimeoutError)
  finish()
  await new Promise((resolve) => setImmediate(resolve))
})

test('a late failure after the timeout is not an unhandled rejection', async () => {
  const clock = fakeTimers()
  let fail
  const unhandled = []
  const listener = (reason) => unhandled.push(reason)
  process.on('unhandledRejection', listener)
  const fetchImpl = () => new Promise((_, reject) => { fail = () => reject(new Error('socket closed')) })
  const pending = requestAnalysis({}, { fetchImpl, timeoutMs: 10, ...clock })
  clock.fire()
  await assert.rejects(pending, AnalysisTimeoutError)
  fail()
  await new Promise((resolve) => setImmediate(resolve))
  process.off('unhandledRejection', listener)
  assert.deepEqual(unhandled, [])
})

test('a timed-out request can be retried explicitly with the same body and succeeds', async () => {
  const clock = fakeTimers()
  const bodies = []
  let calls = 0
  const fetchImpl = (_url, init) => {
    bodies.push(init.body)
    calls += 1
    return calls === 1 ? new Promise(() => {}) : Promise.resolve(jsonResponse({ ok: 'answer' }))
  }
  const request = { opinion: 'Eastport had more shots on target than Northbridge.', selectedClock: { period: 2, minute: 58 } }
  const first = requestAnalysis(request, { fetchImpl, timeoutMs: 5, ...clock })
  clock.fire()
  await assert.rejects(first, AnalysisTimeoutError)
  assert.equal(calls, 1, 'no automatic retry')
  const second = await requestAnalysis(request, { fetchImpl, timeoutMs: 5, ...clock })
  assert.deepEqual(second, { ok: 'answer' })
  assert.equal(calls, 2)
  assert.equal(bodies[0], bodies[1])
  assert.equal(clock.timers.size, 0)
})

test('success and server errors clear the timer', async () => {
  const clock = fakeTimers()
  const ok = await requestAnalysis({}, { fetchImpl: async () => jsonResponse({ a: 1 }), timeoutMs: 5, ...clock })
  assert.deepEqual(ok, { a: 1 })
  assert.equal(clock.timers.size, 0)
  await assert.rejects(
    requestAnalysis({}, { fetchImpl: async () => jsonResponse({ error: 'boom' }, 500), timeoutMs: 5, ...clock }),
    /boom/,
  )
  await assert.rejects(
    requestAnalysis({}, { fetchImpl: async () => ({ ok: true, status: 200, text: async () => 'not json' }), timeoutMs: 5, ...clock }),
    /unreadable/,
  )
  assert.equal(clock.timers.size, 0)
})

test('judge access code is sent only in the protected request header', async () => {
  const requests = []
  await requestAnalysis(
    { opinion: 'test' },
    {
      accessCode: 'test-code-held-in-memory',
      fetchImpl: async (url, init) => {
        requests.push({ url, init })
        return jsonResponse({ ok: true })
      },
    },
  )
  await requestAnalysis(
    { opinion: 'public' },
    {
      fetchImpl: async (url, init) => {
        requests.push({ url, init })
        return jsonResponse({ ok: true })
      },
    },
  )
  assert.equal(requests[0].url, '/api/analyze')
  assert.equal(requests[0].init.headers['x-foundry-judge-code'], 'test-code-held-in-memory')
  assert.equal(requests[0].init.body.includes('test-code-held-in-memory'), false)
  assert.equal(requests[1].init.headers['x-foundry-judge-code'], undefined)
})

test('judge access validation posts the code to the server without a model request', async () => {
  let captured
  await requestFoundryAccess('test-code-held-in-memory', async (url, init) => {
    captured = { url, init }
    return jsonResponse({ enabled: true })
  })
  assert.equal(captured.url, '/api/foundry-access')
  assert.deepEqual(JSON.parse(captured.init.body), { code: 'test-code-held-in-memory' })
  assert.equal(captured.init.headers['content-type'], 'application/json')
})

test('a superseding abort cancels the fetch and clears the timer without a timeout error', async () => {
  const clock = fakeTimers()
  const outer = new AbortController()
  let signal
  const fetchImpl = (_url, init) => new Promise((_, reject) => {
    signal = init.signal
    init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })
  const pending = requestAnalysis({}, { fetchImpl, timeoutMs: 1000, signal: outer.signal, ...clock })
  outer.abort()
  await assert.rejects(pending, (error) => error.name === 'AbortError')
  assert.equal(signal.aborted, true)
  assert.equal(clock.timers.size, 0)
})
