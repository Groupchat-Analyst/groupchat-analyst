import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ANSWER_CODES } from '../../shared/src/claimPresentation.ts'
import {
  renderAssessmentLabel,
  renderClaimPresentation,
  renderLegacyCompatibility,
  renderLimitationFact,
  renderPresentationReason,
} from '../../shared/src/claimPresentationLocale.ts'
import { renderChangeCardLabels, renderComparisonFacts } from '../../shared/src/changeLocale.ts'
import { compareSnapshots, createSnapshot } from './investigation.ts'

const LANGUAGES = ['en', 'es', 'fr', 'de', 'ar']
const ARABIC = /[\u0600-\u06FF]/u
const nameOf = (entity) => (entity.kind === 'team' ? entity.team : entity.name)
const ctx = { nameOf }

const team = (name) => ({ kind: 'team', team: name })
const player = (id, name, teamName) => ({ kind: 'player', id, name, team: teamName })
const SAKA = player('east-player-07', 'Saka', 'Eastport')
const clock = (period, minute, stoppageMinutes) =>
  stoppageMinutes === undefined ? { period, minute } : { period, minute, stoppageMinutes }
const window = (through = clock(2, 90, 4)) => ({ kind: 'window', period: 'match-so-far', through })
const shares = { team: 'Northbridge', value: 55.6, opponent: 'Eastport', opponentValue: 44.4 }
const playerFacts = {
  player: SAKA,
  participation: 'participated',
  contributions: [
    { code: 'goals', count: 1 },
    { code: 'shots', count: 2 },
    { code: 'passes', completed: 4, attempts: 5 },
    { code: 'minutes', minutes: 70 },
  ],
  noRecordedActions: false,
}
const mk = (answer, limitations = [], scope = window(), reason) => ({
  version: 1,
  answer,
  limitations,
  scope,
  ...(reason ? { reason } : {}),
})

// One hand-written descriptor for every non-elsewhere answer code (some codes have extra variants).
const ANSWERS = {
  'unavailable-metric': [
    { code: 'unavailable-metric', metric: 'physical-condition', evidenceKinds: [] },
    { code: 'unavailable-metric', metric: 'shot-location', evidenceKinds: ['shots'] },
    { code: 'unavailable-metric', evidenceKinds: [] },
  ],
  unrecognized: [
    { code: 'unrecognized', reason: 'interpreter-unreliable' },
    { code: 'unrecognized', reason: 'prediction', through: clock(2, 57) },
    { code: 'unrecognized', reason: 'foreign-team', foreignTeams: ['Real Example'] },
  ],
  clarification: [{ code: 'clarification', quote: 'They were good' }],
  'count-assertion': [
    { code: 'count-assertion', verdict: 'supported', form: 'none-on-target', subject: team('Kingswell City'), metric: 'shots-on-target', recorded: 0, of: 3 },
    { code: 'count-assertion', verdict: 'contradicted', form: 'every', subject: team('Alderwick United'), metric: 'shots-on-target', recorded: 3, of: 5 },
    { code: 'count-assertion', verdict: 'unsettled', form: 'every', subject: team('Northbridge'), metric: 'shots-on-target', recorded: 0, of: 0 },
    { code: 'count-assertion', verdict: 'supported', form: 'some', subject: team('Eastport'), metric: 'goals', recorded: 1, of: null },
    { code: 'count-assertion', verdict: 'supported', form: 'none', subject: team('Eastport'), metric: 'shots', recorded: null, of: null },
    { code: 'count-assertion', verdict: 'supported', form: 'not-every', subject: team('Eastport'), metric: 'shots-on-target', recorded: 2, of: 4 },
  ],
  'half-time': [
    { code: 'half-time', assertion: 'scored', verdict: 'supported', subject: team('Northbridge'), outcome: 'goal-recorded', goalClock: clock(1, 45, 3), selectedClock: clock(1, 45, 3) },
    { code: 'half-time', assertion: 'scored', verdict: 'unsettled', subject: team('Northbridge'), outcome: 'not-yet-final', selectedClock: clock(1, 45, 2) },
    { code: 'half-time', assertion: 'did-not-score', verdict: 'supported', subject: team('Eastport'), outcome: 'no-goal-recorded', selectedClock: clock(2, 60) },
  ],
  historical: [
    { code: 'historical', verdict: 'unsettled', kind: 'run-of-play', quote: 'Northbridge scored against the run of play', possession: { ...shares, minutes: 45 } },
    { code: 'historical', verdict: 'unsettled', kind: 'circumstance', quote: 'It was a lucky goal' },
    { code: 'historical', verdict: 'supported', kind: 'player', quote: 'Saka was involved', playerFacts },
  ],
  'possession-dominance': [
    { code: 'possession-dominance', aspect: 'supports', ...shares },
    { code: 'possession-dominance', aspect: 'challenges', ...shares },
    { code: 'possession-dominance', aspect: 'level', ...shares },
  ],
  topic: [
    { code: 'topic', topic: 'passing-quality', negated: false, subject: team('Northbridge'), facts: { kind: 'passing', attempts: 5, completions: 4, ratePercent: 80 }, suggestsSpecificCount: false },
    { code: 'topic', topic: 'passing-quality', negated: true, subject: SAKA, facts: { kind: 'passing', attempts: 0, completions: 0, ratePercent: null }, suggestsSpecificCount: true },
    { code: 'topic', topic: 'possession-losses', negated: false, subject: team('Northbridge'), facts: { kind: 'team-possession-losses', areas: [{ area: 'defensive-third', count: 1 }, { area: 'final-third', count: null }] }, suggestsSpecificCount: false },
    { code: 'topic', topic: 'possession-losses', negated: false, subject: SAKA, facts: { kind: 'player-possession-losses', count: 2, areas: ['middle-third'], attempts: 5 }, suggestsSpecificCount: false },
    { code: 'topic', topic: 'attacking-output', negated: false, subject: team('Northbridge'), facts: { kind: 'attacking', shots: 5, onTarget: 3, goals: 1 }, context: { kind: 'keeper' }, suggestsSpecificCount: false },
    { code: 'topic', topic: 'involvement', negated: false, subject: SAKA, facts: { kind: 'involvement', actions: 6, playerFacts }, suggestsSpecificCount: false },
    { code: 'topic', topic: 'overall-performance', negated: false, subject: SAKA, facts: { kind: 'player-summary', playerFacts }, suggestsSpecificCount: false },
    { code: 'topic', topic: 'momentum', negated: false, subject: team('Northbridge'), facts: { kind: 'statistics' }, context: { kind: 'possession-context', shares }, suggestsSpecificCount: false },
    { code: 'topic', topic: 'pressure-progression', negated: false, subject: team('Northbridge'), facts: { kind: 'none' }, context: { kind: 'pressure-sample', team: 'Northbridge', opponent: 'Eastport', observations: 3, opponentObservations: 1 }, suggestsSpecificCount: false },
  ],
  'player-broad': [
    { code: 'player-broad', ...playerFacts },
    { code: 'player-broad', ...playerFacts, participation: 'not-yet-on-pitch', contributions: [], noRecordedActions: false },
    { code: 'player-broad', ...playerFacts, participation: 'unused-substitute', contributions: [], noRecordedActions: false },
    { code: 'player-broad', ...playerFacts, contributions: [{ code: 'minutes', minutes: 12 }], noRecordedActions: true },
  ],
  'subjective-unsettled': [
    { code: 'subjective-unsettled', quote: 'Northbridge parked the bus' },
    { code: 'subjective-unsettled', quote: 'Northbridge are testing the keeper', context: { kind: 'keeper' } },
  ],
  insufficient: [{ code: 'insufficient', quote: 'Eastport were robbed' }],
  coaching: [
    { code: 'coaching', phase: 'all-passes', none: false, total: 11, teams: [
      { team: 'Northbridge', total: 5, areas: [{ area: 'defensive-third', count: 2 }, { area: 'middle-third', count: 2 }, { area: 'final-third', count: 1 }] },
      { team: 'Eastport', total: 6, areas: [{ area: 'defensive-third', count: 3 }, { area: 'middle-third', count: 3 }, { area: 'final-third', count: 0 }] },
    ] },
    { code: 'coaching', phase: 'build-up-sample', none: false, total: 3, teams: [
      { team: 'Northbridge', total: 3, areas: [{ area: 'defensive-third', count: 1 }, { area: 'middle-third', count: 2 }, { area: 'final-third', count: 0 }] },
    ] },
    { code: 'coaching', phase: 'all-passes', none: true, total: 0, teams: [] },
  ],
}

const NORTH = team('Northbridge')
const LIMITATIONS = [
  { code: 'clarification-needed' },
  { code: 'unavailable-evidence', kind: 'possession' },
  { code: 'metric-not-recorded' },
  { code: 'physical-condition' },
  { code: 'build-up-pass-scope-unavailable' },
  { code: 'prediction' },
  { code: 'interpreter-unreliable' },
  { code: 'foreign-team' },
  { code: 'zero-attempts-universal', team: 'Northbridge' },
  { code: 'count-judged-on-outcomes', subject: NORTH },
  { code: 'halftime-supported', recordedGoal: true, assertion: 'scored', subject: NORTH },
  { code: 'halftime-contradicted', recordedGoal: false, assertion: 'scored', subject: NORTH },
  { code: 'halftime-unsettled', subject: NORTH },
  { code: 'pass-statistics-descriptive' },
  { code: 'pass-coverage-partial' },
  { code: 'descriptive-statistics-only' },
  { code: 'no-pass-attempts' },
  { code: 'coaching-build-up-sample', subject: NORTH, areas: [{ area: 'middle-third', count: 2 }], total: 2 },
  { code: 'coaching-all-passes', subject: null, areas: [{ area: 'final-third', count: 1 }], total: 4 },
  { code: 'topic', topic: 'defensive-approach' },
  { code: 'player-sparse', player: SAKA },
  { code: 'possession-share-limit', aspect: 'supports', ...shares },
  { code: 'missing-data-prevents-conclusion', quote: 'Eastport were robbed' },
  { code: 'context-only', quote: 'Northbridge are testing the keeper' },
  { code: 'no-relevant-events' },
  { code: 'possession-calculation-limit' },
  { code: 'comparison-generic' },
  { code: 'territory-or-chance-quality-absent' },
]

const REASONS = [
  'metric-not-recorded', 'phase-scope-unavailable', 'interpreter-unreliable', 'prediction',
  'foreign-team', 'needs-clarification', 'player-not-in-fixture', 'player-choice', 'no-attempts',
  'coverage-incomplete', 'not-yet-final', 'player-not-yet-on-pitch', 'player-unused-substitute',
  'sparse-player-records', 'subjective-judgement', 'no-relevant-events', 'insufficient-evidence',
]

const render = (presentation, language) => renderClaimPresentation(presentation, ctx, language)

test('every answer code has fixtures and renders non-empty text in all five languages', () => {
  const elsewhere = ANSWER_CODES.filter((code) => code === 'structured-elsewhere')
  assert.deepEqual(
    [...Object.keys(ANSWERS), ...elsewhere].sort(),
    [...ANSWER_CODES].sort(),
  )
  for (const [code, answers] of Object.entries(ANSWERS)) {
    for (const answer of answers) {
      const english = render(mk(answer), 'en')
      assert.ok(english.answer.length > 0, `${code} en`)
      for (const language of LANGUAGES) {
        const rendered = render(mk(answer), language)
        assert.ok(rendered.answer.length > 0 && rendered.verdict.length > 0 && rendered.scope.length > 0, `${code} ${language}`)
        assert.doesNotMatch(rendered.answer, /\{|\}|undefined|NaN/, `${code} ${language}`)
        if (language !== 'en') assert.notEqual(rendered.answer, english.answer, `${code} ${language} must be localized`)
        if (language === 'ar') assert.match(rendered.answer, ARABIC, `${code} ar`)
      }
    }
  }
})

test('structured-elsewhere renders null so callers use the existing formatters', () => {
  for (const family of ['statistics', 'factual-comparison', 'player-performance', 'resolution']) {
    for (const language of LANGUAGES) {
      assert.equal(render(mk({ code: 'structured-elsewhere', family }), language), null)
    }
  }
})

test('all 28 limitation codes render distinct localized text in all five languages', () => {
  assert.equal(LIMITATIONS.length, 28)
  assert.equal(new Set(LIMITATIONS.map(({ code }) => code)).size, 28)
  for (const limitation of LIMITATIONS) {
    const english = renderLimitationFact(limitation, ctx, 'en')
    for (const language of LANGUAGES) {
      const text = renderLimitationFact(limitation, ctx, language)
      assert.ok(text.length > 0, `${limitation.code} ${language}`)
      assert.doesNotMatch(text, /\{|\}|undefined|NaN/, `${limitation.code} ${language}`)
      if (language !== 'en') assert.notEqual(text, english, `${limitation.code} ${language}`)
      if (language === 'ar') assert.match(text, ARABIC, `${limitation.code} ar`)
    }
  }
})

test('all 17 reason codes render localized labels', () => {
  assert.equal(REASONS.length, 17)
  for (const reason of REASONS) {
    const english = renderPresentationReason(reason, 'en')
    for (const language of LANGUAGES) {
      const text = renderPresentationReason(reason, language)
      assert.ok(text.length > 0, `${reason} ${language}`)
      if (language !== 'en') assert.notEqual(text, english, `${reason} ${language}`)
      if (language === 'ar') assert.match(text, ARABIC)
    }
  }
  const note = render(mk({ code: 'unrecognized', reason: 'prediction' }, [], window(), 'prediction'), 'es').note
  assert.equal(note, renderPresentationReason('prediction', 'es'))
})

test('scope kinds keep period and stoppage in every language', () => {
  const half = mk(ANSWERS['half-time'][0], [], { kind: 'first-half-goals', through: clock(1, 45, 3) })
  for (const language of LANGUAGES) assert.ok(render(half, language).scope.includes('45+3′'), language)
  const before = mk(ANSWERS.historical[0], [], {
    kind: 'before-goal', anchorEventId: 'event-07', anchorTeam: 'Northbridge', anchorClock: clock(1, 45, 3),
  })
  for (const language of LANGUAGES) {
    const scope = render(before, language).scope
    assert.ok(scope.includes('45+3′') && scope.includes('Northbridge'), language)
    assert.ok(!scope.includes('event-07'))
  }
  assert.equal(render(mk(ANSWERS['half-time'][2], [], window(clock(2, 60))), 'en').scope, 'Match so far, up to 60′')
})

test('count assertions render literal expected text', () => {
  const none = mk(ANSWERS['count-assertion'][0])
  assert.deepEqual(render(none, 'en'), {
    answer: 'Claim as understood: none of the shots by Kingswell City was on target. Recorded: 0 shots on target from 3 shots.',
    verdict: 'Supported',
    limitations: [],
    scope: 'Match so far, up to 90+4′',
  })
  assert.equal(
    render(none, 'es').answer,
    'Afirmación tal como se entendió: ninguno de los tiros de Kingswell City fue a puerta. Registrado: 0 tiros a puerta de 3 tiros.',
  )
  assert.equal(
    render(none, 'fr').answer,
    'Affirmation telle que comprise : aucun des tirs de Kingswell City n’a été cadré. Enregistré : 0 tir cadré sur 3 tirs.',
  )
  assert.equal(
    render(none, 'ar').answer,
    'الادعاء كما فُهم: لم تكن أي من تسديدات Kingswell City على المرمى. المسجّل: 0 تسديدة على المرمى من أصل 3 تسديدات.',
  )
  const every = render(mk(ANSWERS['count-assertion'][1]), 'en')
  assert.equal(every.verdict, 'Contradicted')
  assert.match(every.answer, /3 shots on target from 5 shots\.$/)
  // A recorded absence of shots is stated; a missing trace is not rendered as zero.
  const zero = render(mk(ANSWERS['count-assertion'][2]), 'en')
  assert.match(zero.answer, /no shots/i)
  assert.doesNotMatch(zero.answer, /Recorded: 0/)
  const missing = render(mk(ANSWERS['count-assertion'][4]), 'en').answer
  assert.doesNotMatch(missing, /Recorded: 0/)
})

test('half-time keeps first-half stoppage time', () => {
  const recorded = render(mk(ANSWERS['half-time'][0], [{ code: 'halftime-supported', recordedGoal: true, assertion: 'scored', subject: NORTH }], { kind: 'first-half-goals', through: clock(1, 45, 3) }), 'en')
  assert.equal(recorded.answer, 'Claim as understood: Northbridge scored before half-time. A first-half goal for Northbridge is recorded at 45+3′.')
  assert.equal(recorded.verdict, 'Supported')
  assert.equal(recorded.scope, 'First-half goals, checked at 45+3′')
  assert.deepEqual(recorded.limitations, ['A recorded first-half goal for Northbridge supports the claim.'])
  assert.match(render(mk(ANSWERS['half-time'][0]), 'de').answer, /Northbridge traf vor der Halbzeit\. .*45\+3′/)
  assert.match(render(mk(ANSWERS['half-time'][0]), 'ar').answer, /قبل الاستراحة.*45\+3′/)
  const early = render(mk(ANSWERS['half-time'][1]), 'en')
  assert.equal(early.verdict, 'Not enough evidence for a firm conclusion')
  assert.match(early.answer, /45\+2′/)
})

test('coaching renders per-team totals and areas', () => {
  const allPasses = render(mk(ANSWERS.coaching[0]), 'en')
  assert.equal(
    allPasses.answer,
    'Possession losses across all recorded passes: 11. Northbridge: 5 (defensive third 2, middle third 2, final third 1). Eastport: 6 (defensive third 3, middle third 3, final third 0).',
  )
  assert.equal(allPasses.verdict, 'Not enough evidence for a firm conclusion')
  assert.match(
    render(mk(ANSWERS.coaching[0]), 'ar').answer,
    /^مرات فقدان الكرة في كل التمريرات المسجّلة: 11\. Northbridge: 5 \(الثلث الدفاعي 2/,
  )
  const sample = render(mk(ANSWERS.coaching[1]), 'en').answer
  assert.match(sample, /^Possession losses in the annotated build-up sample: 3\./)
  assert.match(sample, /Northbridge: 3 \(defensive third 1, middle third 2, final third 0\)/)
})

test('unavailable metrics are localized and carry no verdict or figures', () => {
  const physical = render(mk(ANSWERS['unavailable-metric'][0], [{ code: 'physical-condition' }]), 'en')
  assert.equal(physical.answer, 'Physical condition is not recorded in this match’s data, so there is no figure and no verdict.')
  assert.equal(physical.verdict, 'Data not recorded')
  assert.deepEqual(physical.limitations, ['Physical condition and fitness are not recorded, so no judgement is possible.'])
  assert.equal(
    render(mk(ANSWERS['unavailable-metric'][0]), 'es').answer,
    'El estado físico no se registra en los datos de este partido, así que no hay cifra ni veredicto.',
  )
  assert.equal(render(mk(ANSWERS['unavailable-metric'][0]), 'de').verdict, 'Daten nicht erfasst')
  assert.equal(render(mk(ANSWERS['unavailable-metric'][0]), 'ar').verdict, 'بيانات غير مسجّلة')
})

test('topics and insufficient answers render literal expectations', () => {
  const topic = render(mk(ANSWERS.topic[0], [{ code: 'topic', topic: 'passing-quality' }], window(clock(2, 70))), 'en')
  assert.equal(topic.answer, 'Topic: passing quality. Northbridge completed 4 of 5 recorded passes (80%).')
  assert.equal(topic.verdict, 'Not enough evidence for a firm conclusion')
  assert.deepEqual(topic.limitations, ['This is a broad judgement about passing quality; the recorded figures are context and do not give a verdict.'])
  assert.equal(topic.scope, 'Match so far, up to 70′')
  assert.equal(render(mk(ANSWERS.topic[0]), 'de').answer, 'Thema: Passqualität. Northbridge spielte 4 von 5 erfassten Pässen erfolgreich (80%).')
  // No attempts: the rate is not recorded, so no percentage is shown.
  assert.doesNotMatch(render(mk(ANSWERS.topic[1]), 'en').answer, /%/)

  const insufficient = render(mk(ANSWERS.insufficient[0], [{ code: 'missing-data-prevents-conclusion', quote: 'Eastport were robbed' }]), 'en')
  assert.equal(insufficient.answer, '“Eastport were robbed” cannot be settled from the recorded data, so no verdict is given.')
  assert.equal(insufficient.verdict, 'Not enough evidence for a firm conclusion')
  assert.deepEqual(insufficient.limitations, ['Missing data prevents a firm conclusion on “Eastport were robbed”.'])
  assert.match(render(mk(ANSWERS.insufficient[0]), 'fr').answer, /^« Eastport were robbed » /)
  assert.match(render(mk(ANSWERS.insufficient[0]), 'ar').answer, /«Eastport were robbed»/)
})

test('Arabic uses singular, dual and plural count forms', () => {
  const countOf = (recorded) => render(mk({ code: 'count-assertion', verdict: 'supported', form: 'some', subject: team('Eastport'), metric: 'goals', recorded, of: null }), 'ar').answer
  const one = countOf(1)
  const two = countOf(2)
  const five = countOf(5)
  assert.notEqual(one, two)
  assert.notEqual(two, five)
  assert.match(one, /هدف/)
  assert.match(two, /هدفان|هدفين/)
  assert.match(five, /أهداف/)
})

test('unknown or unsupported descriptors give localized unsupported text, never English', () => {
  const unsupported = { en: 'not supported by this version', es: 'no admite', fr: 'ne prend pas en charge', de: 'nicht unterstützt', ar: 'غير مدعوم' }
  for (const language of LANGUAGES) {
    const unknown = render(mk({ code: 'future-answer' }), language)
    assert.match(unknown.answer, new RegExp(unsupported[language]), language)
    if (language !== 'en') assert.doesNotMatch(unknown.answer, /not supported/)
    const limitation = renderLimitationFact({ code: 'future-limitation' }, ctx, language)
    assert.match(limitation, new RegExp(unsupported[language]), language)
    const version = renderClaimPresentation({ ...mk(ANSWERS.insufficient[0]), version: 2 }, ctx, language)
    assert.match(version.answer, new RegExp(unsupported[language]), language)
    assert.match(renderPresentationReason('future-reason', language), new RegExp(unsupported[language]), language)
  }
})

test('assessment labels and the legacy-compatibility state are localized', () => {
  const assessments = [
    'supported', 'contradicted', 'insufficient evidence for a firm conclusion',
    'statistics provided', 'clarification needed', 'unavailable data', 'unrecognized language',
  ]
  for (const assessment of assessments) {
    const english = renderAssessmentLabel(assessment, 'en')
    for (const language of LANGUAGES) {
      const label = renderAssessmentLabel(assessment, language)
      assert.ok(label.length > 0)
      if (language !== 'en') assert.notEqual(label, english, `${assessment} ${language}`)
      if (language === 'ar') assert.match(label, ARABIC)
    }
  }
  assert.equal(renderAssessmentLabel('supported', 'en'), 'Supported')
  for (const language of LANGUAGES) {
    const text = renderLegacyCompatibility(language)
    assert.ok(text.length > 20)
    if (language === 'ar') assert.match(text, ARABIC)
  }
  assert.match(renderLegacyCompatibility('en'), /English/)
  assert.doesNotMatch(renderLegacyCompatibility('de'), /English source/)
})

test('rendering depends only on descriptor fields, not on incidental English', () => {
  const base = mk(ANSWERS['count-assertion'][0], [{ code: 'count-judged-on-outcomes', subject: team('Kingswell City') }])
  const polluted = {
    reply: 'Totally different English reply',
    limitation: 'Another English sentence',
    answer: 'Yet more prose',
    fanReply: 'More prose',
    summary: 'Summary prose',
    presentation: base,
  }
  for (const language of LANGUAGES) {
    assert.deepEqual(render(polluted.presentation, language), render(structuredClone(base), language), language)
    assert.doesNotMatch(JSON.stringify(render(polluted.presentation, language)), /prose|English/, language)
  }
  // The verbatim quote is the only free text that appears in output.
  const quoted = mk({ code: 'insufficient', quote: 'ZZ unique wording' })
  for (const language of LANGUAGES) assert.ok(render(quoted, language).answer.includes('ZZ unique wording'))
  // Entity names come only from the caller.
  const localized = renderClaimPresentation(mk(ANSWERS['count-assertion'][0]), { nameOf: () => 'نورثبريدج' }, 'ar')
  assert.ok(localized.answer.includes('نورثبريدج'))
  assert.ok(!localized.answer.includes('Kingswell'))
})

const load = (name) => JSON.parse(readFileSync(new URL(`./testdata/${name}.json`, import.meta.url), 'utf8'))
const OPINION = 'Eastport had more shots on target than Northbridge.'
const snap = (id, minute, name, period = 'match-so-far') =>
  createSnapshot(id, { opinion: OPINION, selectedClock: { period: 2, minute }, period }, load(name))

test('comparison facts are typed and localized', () => {
  const comparison = compareSnapshots(snap(1, 57, 'sot-57'), snap(2, 58, 'sot-58'))
  const { facts } = comparison
  assert.equal(facts.version, 1)
  assert.equal(facts.status, 'comparable')
  assert.deepEqual(facts.earlier.clock, { period: 2, minute: 57 })
  assert.deepEqual(facts.later.clock, { period: 2, minute: 58 })
  assert.equal(facts.pairs.length, 1)
  const [pair] = facts.pairs
  assert.equal(pair.before, 'contradicted')
  assert.equal(pair.after, 'supported')
  assert.equal(pair.accounting, 'complete')
  assert.deepEqual(pair.addedRecordIds, ['event-10'])
  assert.deepEqual(pair.removedRecordIds, [])
  assert.deepEqual(
    pair.figures.map(({ entity, metric, before, after }) => [entity, metric, before, after]),
    [[{ kind: 'team', team: 'Northbridge' }, 'shots-on-target', 2, 2], [{ kind: 'team', team: 'Eastport' }, 'shots-on-target', 2, 3]],
  )
  assert.deepEqual(facts.caveats, [{ code: 'accounting', accounting: 'complete' }])

  const en = renderComparisonFacts(facts, { nameOf }, 'en')
  assert.equal(en.headline, 'That’s changed: at 57′ it didn’t hold up; at 58′ it holds up.')
  assert.deepEqual(en.lines, ['Shots on target: Northbridge 2, Eastport 2 → 3.', 'New in the records: 1 recorded moment.'])
  assert.deepEqual(en.caveats, ['The listed moments match the change in the count. That’s a tally, not a reason: the records can’t say why it happened.'])
  const es = renderComparisonFacts(facts, { nameOf }, 'es')
  assert.equal(es.headline, 'Ha cambiado: en el 57′ no se sostuvo; en el 58′ se sostiene.')
  assert.equal(es.lines[0], 'Tiros a puerta: Northbridge 2, Eastport 2 → 3.')
  assert.equal(renderComparisonFacts(facts, { nameOf }, 'fr').lines[0], 'Tirs cadrés : Northbridge 2, Eastport 2 → 3.')
  assert.equal(renderComparisonFacts(facts, { nameOf }, 'de').lines[0], 'Schüsse aufs Tor: Northbridge 2, Eastport 2 → 3.')
  const ar = renderComparisonFacts(facts, { nameOf }, 'ar')
  assert.match(ar.headline, ARABIC)
  assert.ok(ar.headline.includes('57′') && ar.headline.includes('58′'))
  assert.match(ar.lines[0], /^التسديدات على المرمى: /)
  assert.equal(ar.lines[1], 'جديد في السجلات: لحظة مسجّلة واحدة.')

  const described = renderComparisonFacts(facts, { nameOf, describeRecord: (id) => `record ${id}.` }, 'en')
  assert.equal(described.lines[1], 'New in the records: record event-10.')
})

test('same-assessment, non-comparable and rolling-window facts render without legacy English', () => {
  const same = compareSnapshots(snap(1, 57, 'sot-57'), snap(2, 57, 'sot-57'))
  assert.equal(same.facts.pairs[0].accounting, 'unchanged')
  assert.deepEqual(same.facts.caveats, [])
  assert.equal(renderComparisonFacts(same.facts, { nameOf }, 'en').headline, 'Same call at both times: it doesn’t hold up.')
  assert.equal(renderComparisonFacts(same.facts, { nameOf }, 'de').headline, 'Bei beiden Prüfungen ist die Aussage nicht haltbar.')

  const periods = compareSnapshots(snap(1, 57, 'sot-57'), snap(2, 58, 'sot-58', 'last-10-minutes'))
  assert.equal(periods.facts.status, 'not-comparable')
  assert.deepEqual(periods.facts.caveats, [{ code: 'different-periods' }])
  for (const language of LANGUAGES) {
    const rendered = renderComparisonFacts(periods.facts, { nameOf }, language)
    assert.ok(rendered.headline.length > 0 && rendered.lines.length === 1 && rendered.caveats.length === 1, language)
    if (language === 'ar') assert.match(rendered.headline, ARABIC)
  }

  const rolling = compareSnapshots(snap(1, 57, 'sot-57', 'last-10-minutes'), snap(2, 58, 'sot-58', 'last-10-minutes'))
  assert.ok(rolling.facts.caveats.some(({ code }) => code === 'rolling-windows'))
  const text = renderComparisonFacts(rolling.facts, { nameOf }, 'fr').caveats.join(' ')
  assert.match(text, /Fenêtres glissantes/)
  assert.match(text, /57′/)
})

test('unsupported comparison facts and change-card labels are localized', () => {
  const comparison = compareSnapshots(snap(1, 57, 'sot-57'), snap(2, 58, 'sot-58'))
  const broken = { ...comparison.facts, version: 2 }
  assert.match(renderComparisonFacts(broken, { nameOf }, 'fr').headline, /ne prend pas en charge/)
  const odd = { ...comparison.facts, pairs: [{ ...comparison.facts.pairs[0], after: 'mystery' }] }
  assert.match(renderComparisonFacts(odd, { nameOf }, 'de').headline, /nicht unterstützt/)

  const labels = {
    en: ['Original wording', 'Decisive figures', 'New recorded moments', 'No longer in the window'],
    es: ['Formulación original', 'Cifras decisivas', 'Nuevos momentos registrados', 'Ya no están en la ventana'],
    fr: ['Formulation d’origine', 'Chiffres décisifs', 'Nouveaux moments enregistrés', 'N’est plus dans la fenêtre'],
    de: ['Ursprüngliche Formulierung', 'Entscheidende Zahlen', 'Neue erfasste Momente', 'Nicht mehr im Zeitfenster'],
    ar: ['الصياغة الأصلية', 'الأرقام الحاسمة', 'لحظات مسجّلة جديدة', 'لم تعد ضمن الفترة'],
  }
  for (const language of LANGUAGES) {
    const card = renderChangeCardLabels(language)
    assert.deepEqual([card.original, card.decisiveFigures, card.newMoments, card.noLongerInWindow], labels[language])
    assert.ok(card.checked(clock(2, 57), clock(2, 58)).includes('57′'))
    assert.ok(card.extended(3).length > 0)
  }
  const en = renderChangeCardLabels('en')
  assert.equal(en.checked(clock(1, 45, 3), clock(2, 58)), 'Checked at 45+3′, then again at 58′')
  assert.equal(en.extended(3), 'Extended card · 3 claims')
  assert.equal(
    en.bullet({ clock: clock(2, 57), period: 'match-so-far' }, 'contradicted'),
    '57′ (match so far): Contradicted',
  )
  assert.deepEqual(en.figures(comparison.facts.pairs[0], { nameOf }), ['Shots on target: Northbridge 2, Eastport 2 → 3.'])
})
