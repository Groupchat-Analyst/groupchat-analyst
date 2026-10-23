import { formatMatchClock } from '../../shared/src/matchClock.ts'
import type { MatchClock } from '../../shared/src/matchClock'
import type { MatchReplayResponse } from '../../shared/src/apiContracts'

export type ReplayStatus = 'loading' | 'ready' | 'error'

export type ReplaySnapshot = {
  /** Where the viewer asked to be. May run ahead of the displayed frame. */
  requested: MatchClock
  /** The only frame whose score, events and time are shown as the match state. */
  displayed: MatchReplayResponse | null
  displayedClock: MatchClock | null
  status: ReplayStatus
  error: string
  playing: boolean
}

export type FrameLoader = (
  clock: MatchClock,
  signal: AbortSignal,
) => Promise<MatchReplayResponse>

type Timers = {
  setTimeout: (callback: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

export type ReplayControllerOptions = {
  dwellMs?: number
  timeoutMs?: number
  timers?: Timers
}

export function clockKey(clock: MatchClock): string {
  return `${clock.period}-${clock.minute}-${clock.stoppageMinutes ?? 0}`
}

const DEFAULT_TIMERS: Timers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) =>
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}

/**
 * Loads replay frames one at a time. A seek only changes the requested
 * position; the displayed frame changes when the matching frame has arrived.
 * Responses for superseded positions are cached but never displayed.
 */
export class ReplayController {
  private readonly timeline: MatchClock[]
  private readonly loader: FrameLoader
  private readonly dwellMs: number
  private readonly timeoutMs: number
  private readonly timers: Timers
  private readonly cache = new Map<string, MatchReplayResponse>()
  private readonly listeners = new Set<() => void>()
  private readonly prefetchAttempted = new Set<string>()
  private inflightKey: string | null = null
  private dwellTimer: unknown = null
  private abortController: AbortController | null = null
  private disposed = false
  private generation = 0
  private snapshot: ReplaySnapshot

  constructor(
    timeline: MatchClock[],
    initial: MatchClock,
    loader: FrameLoader,
    options: ReplayControllerOptions = {},
  ) {
    this.timeline = timeline
    this.loader = loader
    this.dwellMs = options.dwellMs ?? 900
    this.timeoutMs = options.timeoutMs ?? 8000
    this.timers = options.timers ?? DEFAULT_TIMERS
    this.snapshot = {
      requested: { ...initial },
      displayed: null,
      displayedClock: null,
      status: 'loading',
      error: '',
      playing: false,
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): ReplaySnapshot => this.snapshot

  start(): void {
    this.disposed = false
    this.pump()
  }

  seek(clock: MatchClock, keepPlaying = false): void {
    const target = this.timeline.find((item) => clockKey(item) === clockKey(clock))
    if (!target || this.disposed) return
    this.clearDwell()
    this.update({
      requested: { ...target },
      playing: keepPlaying && this.snapshot.playing,
      error: '',
      status:
        this.displayedKey() === clockKey(target) ? 'ready' : 'loading',
    })
    this.pump()
  }

  step(direction: -1 | 1): void {
    const index = this.indexOf(this.snapshot.requested) + direction
    const next = this.timeline[index]
    if (next) this.seek(next)
  }

  play(): void {
    if (this.snapshot.playing || this.disposed) return
    const last = this.timeline.length - 1
    if (this.indexOf(this.snapshot.requested) >= last) {
      this.update({ playing: true })
      this.seek(this.timeline[0], true)
      return
    }
    this.update({ playing: true })
    this.pump()
  }

  pause(): void {
    this.clearDwell()
    if (this.snapshot.playing) this.update({ playing: false })
  }

  retry(): void {
    if (this.disposed) return
    this.update({ error: '', status: 'loading' })
    this.pump()
  }

  /** Stops timers and in-flight work. The controller can be started again. */
  dispose(): void {
    this.disposed = true
    this.generation += 1
    this.clearDwell()
    this.abortController?.abort()
    this.abortController = null
    this.inflightKey = null
    if (this.snapshot.playing) this.snapshot = { ...this.snapshot, playing: false }
  }

  private indexOf(clock: MatchClock): number {
    const key = clockKey(clock)
    return this.timeline.findIndex((item) => clockKey(item) === key)
  }

  private displayedKey(): string | null {
    return this.snapshot.displayedClock
      ? clockKey(this.snapshot.displayedClock)
      : null
  }

  private update(patch: Partial<ReplaySnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of [...this.listeners]) listener()
  }

  private clearDwell(): void {
    if (this.dwellTimer !== null) {
      this.timers.clearTimeout(this.dwellTimer)
      this.dwellTimer = null
    }
  }

  private pump(): void {
    if (this.disposed || this.inflightKey !== null) return
    const requested = this.snapshot.requested
    const key = clockKey(requested)
    if (this.displayedKey() === key) {
      this.afterSettled()
      return
    }
    const cached = this.cache.get(key)
    if (cached) {
      this.update({
        displayed: cached,
        displayedClock: { ...requested },
        status: 'ready',
        error: '',
      })
      this.afterSettled()
      return
    }
    if (this.snapshot.status === 'error') return
    this.fetchFrame(requested)
  }

  private fetchFrame(clock: MatchClock): void {
    const key = clockKey(clock)
    const label = formatMatchClock(clock)
    const generation = this.generation
    const controller = new AbortController()
    this.abortController = controller
    this.inflightKey = key
    let timedOut = false
    const timeout = this.timers.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.timeoutMs)

    this.loader(clock, controller.signal)
      .then((frame) => {
        if (frame.selectedTime !== label) {
          throw new Error('The replay service returned a different match moment.')
        }
        this.cache.set(key, frame)
        return null
      })
      .catch((error: unknown) =>
        timedOut
          ? new Error('The replay took too long to respond.')
          : error instanceof Error
            ? error
            : new Error('The replay is unavailable.'),
      )
      .then((failure) => {
        this.timers.clearTimeout(timeout)
        if (generation !== this.generation) return
        this.inflightKey = null
        this.abortController = null
        if (this.disposed) return
        if (failure && clockKey(this.snapshot.requested) === key) {
          this.clearDwell()
          this.update({ status: 'error', error: failure.message, playing: false })
          return
        }
        this.pump()
      })
  }

  private afterSettled(): void {
    if (this.snapshot.status !== 'ready' && this.snapshot.status !== 'loading') {
      return
    }
    if (this.snapshot.status === 'loading') this.update({ status: 'ready' })
    if (!this.snapshot.playing) return
    const nextIndex = this.indexOf(this.snapshot.requested) + 1
    const next = this.timeline[nextIndex]
    if (!next) {
      this.update({ playing: false })
      return
    }
    if (this.dwellTimer === null) {
      this.dwellTimer = this.timers.setTimeout(() => {
        this.dwellTimer = null
        if (this.disposed || !this.snapshot.playing) return
        this.update({ requested: { ...next }, status: 'loading' })
        this.pump()
      }, this.dwellMs)
    }
    const nextKey = clockKey(next)
    if (
      this.inflightKey === null &&
      !this.cache.has(nextKey) &&
      !this.prefetchAttempted.has(nextKey)
    ) {
      this.prefetchAttempted.add(nextKey)
      this.fetchFrame(next)
    }
  }
}
