import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEMO_CLOCK,
  DEMO_NEXT_CLOCK,
  DEMO_TAKE,
  canOfferDemo,
  demoStep,
  isRelevantAnswer,
} from './guidedDemo.ts'

const base = {
  active: false,
  draft: '',
  hasSubmitted: false,
  isLoading: false,
  hasError: false,
  displayedClock: DEMO_CLOCK,
  requestedClock: DEMO_CLOCK,
  answer: null,
}
const answered = (over = {}) => ({
  ...base,
  active: true,
  hasSubmitted: true,
  draft: DEMO_TAKE,
  answer: { take: DEMO_TAKE, clock: DEMO_CLOCK, period: 'match-so-far', relevant: true, ...over },
})

test('the demonstration is offered only in the untouched initial state', () => {
  assert.equal(demoStep(base), 'offer')
  assert.equal(demoStep({ ...base, draft: 'Eastport were poor' }), null)
  assert.equal(demoStep({ ...base, draft: '   ' }), 'offer')
  assert.equal(demoStep({ ...base, hasSubmitted: true }), null)
  assert.equal(demoStep({ ...base, isLoading: true }), null)
  assert.equal(demoStep({ ...base, hasError: true }), null)
})

test('an edited draft is never offered the demonstration, so it cannot be overwritten', () => {
  assert.equal(canOfferDemo({ ...base, draft: 'my own take' }), false)
})

test('after activation the prepared take is ready to submit, and nothing else is implied', () => {
  assert.equal(demoStep({ ...base, active: true, draft: DEMO_TAKE }), 'ready-to-submit')
  assert.equal(demoStep({ ...base, active: true, draft: 'changed my mind' }), null)
})

test('a relevant 57′ answer offers the step to 58′, then waits for the committed frame', () => {
  assert.equal(demoStep(answered()), 'step-to-next-minute')
  assert.equal(demoStep({ ...answered(), requestedClock: DEMO_NEXT_CLOCK }), 'moving')
  assert.equal(
    demoStep({ ...answered(), requestedClock: DEMO_NEXT_CLOCK, displayedClock: DEMO_CLOCK }),
    'moving',
  )
  assert.equal(
    demoStep({ ...answered(), requestedClock: DEMO_NEXT_CLOCK, displayedClock: DEMO_NEXT_CLOCK }),
    'ready-to-recheck',
  )
})

test('no step is offered for irrelevant, edited, other-scope or failed answers', () => {
  assert.equal(demoStep(answered({ relevant: false })), null)
  assert.equal(demoStep(answered({ take: 'something else' })), null)
  assert.equal(demoStep(answered({ period: 'last-10-minutes' })), null)
  assert.equal(demoStep(answered({ clock: DEMO_NEXT_CLOCK })), null)
  assert.equal(demoStep({ ...answered(), hasError: true }), null)
  assert.equal(demoStep({ ...answered(), isLoading: true }), null)
})

test('only assessed claims count as relevant answers', () => {
  assert.equal(isRelevantAnswer([{ assessment: 'contradicted' }]), true)
  assert.equal(isRelevantAnswer([{ assessment: 'supported' }]), true)
  assert.equal(isRelevantAnswer([{ assessment: 'clarification needed' }]), false)
  assert.equal(isRelevantAnswer([{ assessment: 'unrecognized language' }]), false)
  assert.equal(isRelevantAnswer([]), false)
})
