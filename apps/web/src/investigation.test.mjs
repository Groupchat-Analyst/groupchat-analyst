import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  buildChangeCard,
  changeCardText,
  checkedAgainst,
  compareSnapshots,
  createSnapshot,
  isLaterClock,
  needsPassMap,
} from './investigation.ts'
import { INTERNAL_ID_PATTERN, canonicalReply } from './presentation.ts'

// Captured from the local-only rule-based interpreter (see README); not hand-written answers.
const load = (name) => JSON.parse(readFileSync(new URL(`./testdata/${name}.json`, import.meta.url), 'utf8'))
const OPINION = 'Eastport had more shots on target than Northbridge.'
const context = (minute, period = 'match-so-far') => ({
  opinion: OPINION,
  selectedClock: { period: 2, minute },
  period,
})
const snap = (id, minute, name, period) => createSnapshot(id, context(minute, period), load(name))

test('the supported fixture case flips from contradicted at 57′ to supported at 58′ with the new goal listed', () => {
  const earlier = snap(1, 57, 'sot-57')
  const later = snap(2, 58, 'sot-58')
  const comparison = compareSnapshots(earlier, later)

  assert.equal(comparison.status, 'comparable')
  assert.equal(comparison.pairs[0].before, 'contradicted')
  assert.equal(comparison.pairs[0].after, 'supported')
  assert.match(comparison.headline, /That's changed: at 57′ it didn't hold up; at 58′ it holds up\./)
  assert.deepEqual(
    comparison.pairs[0].figures.map(({ entity, before, after }) => [entity, before, after]),
    [['Northbridge', 2, 2], ['Eastport', 2, 3]],
  )
  assert.equal(comparison.pairs[0].added.length, 1)
  assert.match(comparison.pairs[0].added[0], /^58′ · /)
  assert.equal(comparison.pairs[0].accounting, 'complete')
  const text = [comparison.headline, ...comparison.lines, ...comparison.caveats].join('\n')
  assert.match(text, /Shots on target: Northbridge 2, Eastport 2 → 3\./)
  assert.match(text, /tally, not a reason/)
  assert.doesNotMatch(text, /moving on caused/)
  assert.doesNotMatch(text, INTERNAL_ID_PATTERN)
})

test('comparison and sharing never mutate either snapshot', () => {
  const earlier = snap(1, 57, 'sot-57')
  const later = snap(2, 58, 'sot-58')
  const before = JSON.stringify([earlier, later])
  const comparison = compareSnapshots(earlier, later)
  buildChangeCard(OPINION, earlier, later, comparison)
  assert.equal(JSON.stringify([earlier, later]), before)
  assert.throws(() => { earlier.analysis.summary = 'changed' }, TypeError)
  assert.throws(() => { later.analysis.claims[0].assessment = 'contradicted' }, TypeError)
  assert.equal(canonicalReply(earlier.analysis), load('sot-57').fanReply)
})

test('different interpretations are reported plainly and are not compared', () => {
  const earlier = snap(1, 57, 'sot-57')
  const other = load('sot-58')
  other.claims[0].claim.meaning.comparison.metric = 'shots'
  const later = createSnapshot(2, context(58), other)
  const comparison = compareSnapshots(earlier, later)
  assert.equal(comparison.status, 'different-interpretation')
  assert.equal(comparison.pairs.length, 0)
  assert.match(comparison.headline, /interpret this opinion differently/)
  assert.equal(buildChangeCard(OPINION, earlier, later, comparison), null)
})

test('different model prose with identical structured meaning still compares directly', () => {
  // Mirrors the cf10c74 Foundry pair: same structure, differently worded claim text.
  const earlier = load('sot-57')
  const later = load('sot-58')
  earlier.claims[0].claim.text = 'Eastport had more shots on target than Northbridge.'
  later.claims[0].claim.text = 'Eastport had more shots on target than Northbridge up to the 58′ minute.'
  const comparison = compareSnapshots(createSnapshot(1, context(57), earlier), createSnapshot(2, context(58), later))
  assert.equal(comparison.status, 'comparable')
  assert.equal(comparison.pairs[0].after, 'supported')
})

test('claims without a structured comparison stay separate when their wording differs', () => {
  const judgement = (text) => {
    const analysis = load('sot-57')
    const { claim } = analysis.claims[0]
    claim.text = text
    claim.intent = 'subjective-judgement'
    claim.meaning = { category: 'performance-judgement', description: text, comparison: null }
    return analysis
  }
  const a = createSnapshot(1, context(57), judgement('Northbridge parked the bus.'))
  const b = createSnapshot(2, context(58), judgement('Northbridge dominated.'))
  assert.equal(compareSnapshots(a, b).status, 'different-interpretation')
})

test('opposite polarity or a different comparison target is not treated as equivalent', () => {
  const earlier = snap(1, 57, 'sot-57')
  for (const mutate of [
    (claim) => { claim.meaning.comparison.operator = 'less-than' },
    (claim) => { claim.subject = 'Northbridge'; claim.meaning.comparison.opponent = 'Eastport' },
    (claim) => { claim.timePeriod = { kind: 'before-event', eventId: 'event-07' } },
  ]) {
    const other = load('sot-58')
    mutate(other.claims[0].claim)
    const comparison = compareSnapshots(earlier, createSnapshot(2, context(58), other))
    assert.equal(comparison.status, 'different-interpretation')
  }
})

test('different evidence-period options are not compared like for like', () => {
  const comparison = compareSnapshots(snap(1, 57, 'sot-57'), snap(2, 58, 'sot-58-last10', 'last-10-minutes'))
  assert.equal(comparison.status, 'not-comparable')
  assert.match(comparison.caveats.join(' '), /different evidence periods/)
})

test('rolling windows state both windows and never claim records fully explain a change', () => {
  const comparison = compareSnapshots(
    snap(1, 57, 'sot-57-last10', 'last-10-minutes'),
    snap(2, 58, 'sot-58-last10', 'last-10-minutes'),
  )
  assert.equal(comparison.status, 'comparable')
  assert.equal(comparison.earlierWindow, 'Last 10 minutes ending 57′')
  assert.equal(comparison.laterWindow, 'Last 10 minutes ending 58′')
  assert.match(comparison.caveats.join(' '), /Last 10 minutes ending 57′ against Last 10 minutes ending 58′/)
  assert.equal(comparison.pairs[0].before, 'insufficient evidence for a firm conclusion')
  assert.match(comparison.headline, /couldn't be settled from the records/)
})

test('a statistical change that the listed records do not explain is disclosed', () => {
  const later = load('sot-58')
  later.claims[0].statistics.find(({ team }) => team === 'Eastport').value = 5
  const comparison = compareSnapshots(snap(1, 57, 'sot-57'), createSnapshot(2, context(58), later))
  assert.equal(comparison.pairs[0].accounting, 'partial')
  assert.match(comparison.caveats.join(' '), /don't fully account for the change/)
})

test('rates are never presented as explained by a single record', () => {
  const earlier = load('sot-57')
  const later = load('sot-58')
  for (const data of [earlier, later]) {
    data.claims[0].statistics = data.claims[0].statistics.map((s) => ({ ...s, metric: 'possession-percentage' }))
  }
  later.claims[0].statistics[1].value = 50
  const comparison = compareSnapshots(createSnapshot(1, context(57), earlier), createSnapshot(2, context(58), later))
  assert.equal(comparison.pairs[0].accounting, 'rate')
})

test('unchanged results say so without implying a cause', () => {
  const comparison = compareSnapshots(snap(1, 57, 'sot-57'), snap(2, 57, 'sot-57'))
  assert.equal(comparison.pairs[0].accounting, 'unchanged')
  assert.match(comparison.headline, /Same call at both times/)
  assert.equal(comparison.pairs[0].added.length, 0)
})

test('the what-changed card has both times, both assessments, figures, one synthetic label and no IDs', () => {
  const earlier = snap(1, 57, 'sot-57')
  const later = snap(2, 58, 'sot-58')
  const card = buildChangeCard(OPINION, earlier, later, compareSnapshots(earlier, later))
  const text = changeCardText(card)
  assert.match(text, /“Eastport had more shots on target than Northbridge\.”/)
  assert.match(text, /Checked at 57′, then again at 58′/)
  assert.match(text, /57′ \(Match so far through 57′\): Contradicted/)
  assert.match(text, /58′ \(Match so far through 58′\): Supported/)
  assert.match(text, /Shots on target: Northbridge 2, Eastport 2 → 3\./)
  assert.match(text, /New recorded moments/)
  assert.match(text, /tally, not a reason/)
  assert.equal(text.match(/Synthetic data/g)?.length, 1)
  assert.equal(text.match(/Groupchat Analyst/g)?.length, 1)
  assert.doesNotMatch(text, INTERNAL_ID_PATTERN)
  assert.equal(card.extended, false)
})

test('Checked against names the subject, metric and the actual window', () => {
  assert.deepEqual(checkedAgainst(load('sot-58')), [
    'Eastport vs Northbridge · shots on target · Match so far through 58′',
  ])
  assert.deepEqual(checkedAgainst(load('sot-58-last10')), [
    'Eastport vs Northbridge · shots on target · Last 10 minutes ending 58′',
  ])
  const unrecognised = load('sot-58')
  unrecognised.claims[0].assessment = 'unrecognized language'
  assert.deepEqual(checkedAgainst(unrecognised), [])
})

test('only forward movement offers a recheck, and the pass map is limited to passing claims', () => {
  assert.equal(isLaterClock({ period: 2, minute: 58 }, { period: 2, minute: 57 }), true)
  assert.equal(isLaterClock({ period: 1, minute: 45, stoppageMinutes: 3 }, { period: 2, minute: 57 }), false)
  assert.equal(isLaterClock({ period: 2, minute: 57 }, { period: 2, minute: 57 }), false)
  assert.equal(needsPassMap(load('sot-58')), false)
  const passing = load('sot-58')
  passing.claims[0].claim.requiredEvidence = ['passing']
  assert.equal(needsPassMap(passing), true)
})

test('a limitation on the earlier answer only survives in the panel, copied text and card with its time', () => {
  const earlierData = load('sot-57')
  earlierData.claims[0].limitation = 'Only part of the first half was recorded.'
  earlierData.claims[0].evidenceAvailability[0].available = false
  earlierData.claims[0].evidenceAvailability[0].detail = 'Shot-on-target events are partly missing.'
  const earlier = createSnapshot(1, context(57), earlierData)
  const later = snap(2, 58, 'sot-58')
  const comparison = compareSnapshots(earlier, later)
  assert.deepEqual(comparison.qualifications, [
    'At 57′: Only part of the first half was recorded.',
    'At 57′: Shot-on-target events are partly missing.',
  ])
  const text = changeCardText(buildChangeCard(OPINION, earlier, later, comparison))
  assert.match(text, /Limitation: At 57′: Only part of the first half was recorded\./)
  assert.match(text, /Limitation: At 57′: Shot-on-target events are partly missing\./)
  assert.equal(comparison.pairs[0].accounting, 'incomplete')
  assert.match(comparison.caveats.join(' '), /aren't fully recorded/)
})

test('identical qualifications from both answers are merged without a time label', () => {
  const [a, b] = [load('sot-57'), load('sot-58')]
  for (const data of [a, b]) data.claims[0].limitation = 'Only part of the first half was recorded.'
  const earlier = createSnapshot(1, context(57), a)
  const later = createSnapshot(2, context(58), b)
  assert.deepEqual(compareSnapshots(earlier, later).qualifications, ['Only part of the first half was recorded.'])
  b.claims[0].limitation = 'Different later note.'
  const split = compareSnapshots(earlier, createSnapshot(3, context(58), b)).qualifications
  assert.deepEqual(split, ['At 57′: Only part of the first half was recorded.', 'At 58′: Different later note.'])
})

test('coverage warnings that matter to the claim are kept from either answer', () => {
  const earlierData = load('sot-57')
  for (const data of [earlierData]) {
    data.claims[0].claim.requiredEvidence = ['possession']
    data.evidenceFoundation.possessionCoverageComplete = false
    data.evidenceFoundation.missingCoveragePeriods = ['12′ to 14′']
  }
  const later = load('sot-58')
  later.claims[0].claim.requiredEvidence = ['possession']
  const comparison = compareSnapshots(createSnapshot(1, context(57), earlierData), createSnapshot(2, context(58), later))
  assert.equal(comparison.status, 'comparable')
  assert.deepEqual(comparison.qualifications, ['At 57′: Possession coverage is partial: missing 12′ to 14′.'])
})

test('different dataset versions or identities are never compared directly', () => {
  const earlier = snap(1, 57, 'sot-57')
  for (const change of [
    (dataset) => { dataset.version = '3.1.0' },
    (dataset) => { dataset.id = 'another-fixture' },
  ]) {
    const other = load('sot-58')
    change(other.evidenceFoundation.dataset)
    const later = createSnapshot(2, context(58), other)
    const comparison = compareSnapshots(earlier, later)
    assert.equal(comparison.status, 'not-comparable')
    assert.equal(comparison.pairs.length, 0)
    assert.match(comparison.headline, /different match data/)
    assert.match(comparison.caveats.join(' '), /version 3\.0\.0.*version 3\.1\.0|different data/)
    assert.equal(buildChangeCard(OPINION, earlier, later, comparison), null)
  }
})

test('a record only counts as accounting for a change if its team, metric and coverage fit', () => {
  const earlier = snap(1, 57, 'sot-57')
  const wrongTeam = load('sot-58')
  wrongTeam.claims[0].evidence.find(({ reference }) => reference.id === 'event-10').reference.team = 'Northbridge'
  assert.equal(compareSnapshots(earlier, createSnapshot(2, context(58), wrongTeam)).pairs[0].accounting, 'partial')

  const wrongMetric = load('sot-58')
  wrongMetric.claims[0].claim.requiredEvidence = ['possession']
  const earlierWrong = load('sot-57')
  earlierWrong.claims[0].claim.requiredEvidence = ['possession']
  assert.equal(
    compareSnapshots(createSnapshot(1, context(57), earlierWrong), createSnapshot(2, context(58), wrongMetric)).pairs[0].accounting,
    'partial',
  )

  const extra = load('sot-58')
  extra.claims[0].evidence.push({
    role: 'supporting',
    reference: { id: 'event-99', time: '58′', team: 'Northbridge', description: 'Northbridge hit the post.' },
  })
  assert.equal(compareSnapshots(earlier, createSnapshot(2, context(58), extra)).pairs[0].accounting, 'partial')
})

test('the changed-answer text never implies a tactical or match-moving cause', () => {
  const earlier = snap(1, 57, 'sot-57')
  const later = snap(2, 58, 'sot-58')
  const comparison = compareSnapshots(earlier, later)
  const text = [comparison.headline, ...comparison.lines, ...comparison.caveats].join(' ')
  assert.doesNotMatch(text, /because|caused|due to|thanks to|momentum|pressure/i)
})
