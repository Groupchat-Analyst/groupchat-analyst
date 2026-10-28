/**
 * The Foundry provider gives up on the model after 30 s (apps/api/src/providers/foundry.ts).
 * 45 s leaves room for that, plus validation, the Functions host and the network, so a normal
 * server-side completion or a server-side timeout error still reaches the user first.
 */
export const ANALYSIS_TIMEOUT_MS = 45_000

export class AnalysisTimeoutError extends Error {
  constructor(timeoutMs: number) {
    const seconds = Math.round(timeoutMs / 1000)
    super(
      `That's taking too long, so I've stopped waiting after ${seconds} seconds. ` +
        'Your earlier answer is still here. Stopping the wait here doesn\u2019t guarantee the server has stopped working on it. ' +
        'Try again when you\u2019re ready.',
    )
    this.name = 'AnalysisTimeoutError'
  }
}

export interface AnalysisFetchOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  /** Aborted when the request is superseded or the view goes away. */
  signal?: AbortSignal
  accessCode?: string
  setTimer?: (callback: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export async function requestFoundryAccess(
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl('/api/foundry-access', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  const responseText = await response.text()
  let payload: unknown
  if (responseText) {
    try { payload = JSON.parse(responseText) }
    catch { if (response.ok) throw new Error('The access service returned an unreadable response.') }
  }
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
      ? payload.error : `The access service is unavailable (HTTP ${response.status}).`
    throw new Error(message)
  }
}

/**
 * Posts one analysis request with a hard deadline and returns the parsed JSON body.
 * Never retries. On timeout the underlying fetch is aborted and the call rejects with
 * AnalysisTimeoutError even if the fetch implementation ignores the abort signal.
 */
export async function requestAnalysis(request: unknown, options: AnalysisFetchOptions = {}): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? ANALYSIS_TIMEOUT_MS
  const setTimer = options.setTimer ?? ((cb, ms) => setTimeout(cb, ms))
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  const controller = new AbortController()
  const onOuterAbort = () => controller.abort()
  if (options.signal?.aborted) controller.abort()
  else options.signal?.addEventListener('abort', onOuterAbort, { once: true })

  let timer: unknown
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimer(() => {
      controller.abort()
      reject(new AnalysisTimeoutError(timeoutMs))
    }, timeoutMs)
  })

  async function send(): Promise<unknown> {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (options.accessCode) headers['x-foundry-judge-code'] = options.accessCode
    const response = await fetchImpl('/api/analyze', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    })
    const responseText = await response.text()
    let payload: unknown
    if (responseText) {
      try { payload = JSON.parse(responseText) }
      catch { if (response.ok) throw new Error('The analysis service returned an unreadable answer.') }
    }
    if (!response.ok) {
      const message = typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
        ? payload.error : `The analysis service is unavailable (HTTP ${response.status}).`
      throw new Error(message)
    }
    return payload
  }

  const work = send()
  work.catch(() => undefined)
  try {
    return await Promise.race([work, deadline])
  } finally {
    clearTimer(timer)
    options.signal?.removeEventListener('abort', onOuterAbort)
  }
}
