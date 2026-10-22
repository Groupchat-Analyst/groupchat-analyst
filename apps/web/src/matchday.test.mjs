import assert from 'node:assert/strict'
import test from 'node:test'
import { formatMatchClock } from '../../shared/src/matchClock.ts'
import {
  buildShareCardText,
  createShareCardSvg,
  createAnalysisRequest,
  createSubmissionContext,
  isLatestRequest,
  isSubmissionScopeCurrent,
  replayEventsAtOrBefore,
} from './matchday.ts'

const response = {
  provider: 'local',
  summary: 'Northbridge scored before half-time at 45+3′.',
  selectedTime: '57′',
  selectedPeriodLabel: 'Match so far ending 57′',
  claims: [
    {
      claim: {
        id: 'claim-1',
        text: 'Northbridge scored before half-time.',
        clarificationNeeds: [],
      },
      limitation: 'This only establishes the recorded first-half goal.',
      evidence: [
        {
          role: 'supporting',
          reference: {
            id: 'event-07',
            time: '45+3′',
            team: 'Northbridge',
            description: 'Northbridge score with a close-range shot.',
          },
        },
        {
          role: 'counterevidence',
          reference: {
            id: 'event-09',
            time: '51′',
            team: 'Northbridge',
            description: 'A counter-attacking effort goes wide.',
          },
        },
      ],
    },
    {
      claim: {
        id: 'claim-2',
        text: 'How far did a player run?',
        clarificationNeeds: ['Which player do you mean?'],
      },
      limitation: 'Running distance is not recorded.',
      evidence: [],
    },
  ],
}

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

test('share-card text preserves the server answer and includes scope, evidence and limitations', () => {
  const context = createSubmissionContext(
    'Northbridge scored before half-time and Eastport will equalise.',
    { period: 2, minute: 57 },
    'last-10-minutes',
  )
  const text = buildShareCardText(context, response)

  assert.ok(text.includes(response.summary))
  assert.match(text, /Take: Northbridge scored before half-time and Eastport will equalise/)
  assert.match(text, /Match scope: 57′ · Last 10 minutes/)
  assert.match(text, /45\+3′ · Northbridge — Northbridge score.*\(event-07; supporting\)/)
  assert.match(text, /51′ · Northbridge — A counter-attacking effort goes wide\. \(event-09; counterevidence\)/)
  assert.match(text, /Running distance is not recorded/)
  assert.match(text, /Which player do you mean/)
  assert.match(text, /Synthetic demonstration data · fictional match/)
})

test('share image is locally rendered, escaped, and scales to long content', () => {
  const shortSvg = createShareCardSvg('Take: A < B & C')
  const longSvg = createShareCardSvg(`Answer: ${'a long evidence-led answer '.repeat(80)}`)
  const shortHeight = Number(shortSvg.match(/height="(\d+)"/)?.[1])
  const longHeight = Number(longSvg.match(/height="(\d+)"/)?.[1])

  assert.match(shortSvg, /A &lt; B &amp; C/)
  assert.ok(longHeight > shortHeight)
  assert.match(longSvg, /<svg/)
  assert.doesNotMatch(longSvg, /<(?:image|foreignObject)\b|xlink:href=/)
})
