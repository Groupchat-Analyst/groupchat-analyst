import { clockKey } from './replayController.ts'
import type { MatchClock } from '../../shared/src/matchClock'

// Guided first-use demonstration: pure state rules only. Every figure, verdict and
// comparison shown during the demo comes from real /api/analyze responses.
export const DEMO_TAKE = 'Eastport had more shots on target than Northbridge.'
export const DEMO_CLOCK: MatchClock = { period: 2, minute: 57 }
export const DEMO_NEXT_CLOCK: MatchClock = { period: 2, minute: 58 }
export const DEMO_ENTRY_LABEL = 'See how one minute changes the take'

export type DemoInputs = {
  active: boolean
  draft: string
  hasSubmitted: boolean
  isLoading: boolean
  hasError: boolean
  /** The replay frame that is actually displayed, or null before the first frame. */
  displayedClock: MatchClock | null
  requestedClock: MatchClock
  answer: {
    take: string
    clock: MatchClock
    period: 'match-so-far' | 'last-10-minutes'
    relevant: boolean
  } | null
}

export type DemoStep =
  | 'offer'
  | 'ready-to-submit'
  | 'step-to-next-minute'
  | 'moving'
  | 'ready-to-recheck'
  | null

/** Offered only in the untouched initial state; never over an edited draft or an investigation. */
export function canOfferDemo(input: Pick<DemoInputs, 'active' | 'draft' | 'hasSubmitted' | 'isLoading' | 'hasError'>): boolean {
  return !input.active && input.draft.trim() === '' && !input.hasSubmitted && !input.isLoading && !input.hasError
}

const sameClock = (a: MatchClock | null, b: MatchClock) => a !== null && clockKey(a) === clockKey(b)

export function demoStep(input: DemoInputs): DemoStep {
  if (!input.active) return canOfferDemo(input) ? 'offer' : null
  if (input.isLoading || input.hasError) return null
  const answer = input.answer
  if (!answer) {
    if (input.hasSubmitted) return null
    return input.draft.trim() === DEMO_TAKE ? 'ready-to-submit' : null
  }
  if (answer.take !== DEMO_TAKE || answer.period !== 'match-so-far' || !answer.relevant) return null
  if (!sameClock(answer.clock, DEMO_CLOCK)) return null
  if (sameClock(input.displayedClock, DEMO_NEXT_CLOCK)) return 'ready-to-recheck'
  if (sameClock(input.requestedClock, DEMO_NEXT_CLOCK)) return 'moving'
  if (sameClock(input.displayedClock, DEMO_CLOCK) && sameClock(input.requestedClock, DEMO_CLOCK)) return 'step-to-next-minute'
  return null
}

const NOT_RELEVANT = new Set(['clarification needed', 'unrecognized language', 'unavailable data'])

/** A relevant answer assessed the take as a claim; clarifications and declines do not count. */
export function isRelevantAnswer(claims: { assessment: string }[]): boolean {
  return claims.length > 0 && claims.every(({ assessment }) => !NOT_RELEVANT.has(assessment))
}
