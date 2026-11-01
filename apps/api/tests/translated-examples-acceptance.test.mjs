import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { DATASET_CATALOG } from '../dist/shared/src/datasetCatalog.js'
import { localizedExample } from '../dist/shared/src/localization.js'

const LANGUAGES = ['es', 'fr', 'de', 'ar']

// Prose and per-request tokens legitimately differ between wordings; every
// structured fact (intent, metrics, entities, values, record IDs, scope) is kept.
const PROSE_KEYS = new Set([
  'text', 'description', 'detail', 'limitation', 'reply', 'summary', 'fanReply',
  'continuation', 'token', 'originalText', 'label',
])

function structure(value) {
  if (Array.isArray(value)) return value.map(structure)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !PROSE_KEYS.has(key))
        .map(([key, item]) => [key, structure(item)]),
    )
  }
  return value
}

function project(response) {
  return {
    selectedTime: response.selectedTime,
    score: response.score,
    claims: response.claims.map((entry) => structure({
      intent: entry.claim.intent,
      subject: entry.claim.subject,
      playerSubject: entry.claim.playerSubject,
      playerMetric: entry.claim.playerMetric,
      meaning: entry.claim.meaning,
      requiredEvidence: entry.claim.requiredEvidence,
      timePeriod: entry.claim.timePeriod,
      historicalEventAnchor: entry.claim.historicalEventAnchor,
      clarificationNeeds: entry.claim.clarificationNeeds,
      assessment: entry.assessment,
      statistics: entry.statistics,
      playerStatistics: entry.playerStatistics,
      playerCalculations: entry.playerCalculations,
      evidenceAvailability: entry.evidenceAvailability,
      evidence: entry.evidence,
      calculations: entry.calculations,
      presentation: entry.presentation,
      playerResolution: entry.playerResolution,
    })),
  }
}

const run = (dataset, example, opinion, inputLanguage) => analyzeOpinion({
  opinion,
  selectedClock: example.clock,
  datasetId: dataset.id,
  period: example.period,
  inputLanguage,
})

const cases = DATASET_CATALOG.flatMap((dataset) => dataset.examples.map((example) => ({ dataset, example })))

test('the catalogue offers 20 examples, giving 80 translated wordings', () => {
  assert.equal(cases.length * LANGUAGES.length, 80)
})

for (const { dataset, example } of cases) {
  for (const language of LANGUAGES) {
    test(`${dataset.id} @ ${example.clock.minute}′ — ${language}: ${example.text}`, async () => {
      const translated = localizedExample(example.text, language)
      assert.notEqual(translated, example.text, 'the composer text must be in the selected language')
      const english = await run(dataset, example, example.text, 'en')
      const native = await run(dataset, example, translated, language)

      for (const entry of native.claims) {
        assert.notEqual(entry.claim.intent, 'unrecognized-language', `${translated} must not become unsupported`)
      }
      assert.deepEqual(project(native), project(english))
    })
  }
}

test('the matrix is not trivially empty: it contains assessed, unavailable and clarification outcomes', async () => {
  const outcomes = new Set()
  for (const { dataset, example } of cases) {
    const response = await run(dataset, example, example.text, 'en')
    for (const entry of response.claims) {
      outcomes.add(entry.claim.intent)
      outcomes.add(`assessment:${entry.assessment}`)
      if (entry.playerResolution) outcomes.add('player-resolution')
    }
  }
  assert.ok(outcomes.has('unavailable-metric'))
  assert.ok(outcomes.has('subjective-judgement'))
  assert.ok(outcomes.has('statistical-request'))
  assert.ok([...outcomes].some((value) => value.startsWith('assessment:')))
})

// Reasonable grammatical variations route through the same grammar, not per-example answers.
const VARIATIONS = [
  ['northbridge-eastport-analysis-demo', 'es', 'Eastport tuvo más tiros a puerta que Northbridge', 'Eastport had more shots on target than Northbridge.'],
  ['northbridge-eastport-analysis-demo', 'es', 'Eastport ha tenido menos posesión que Northbridge', 'Eastport had fewer possession than Northbridge.'],
  ['northbridge-eastport-analysis-demo', 'fr', "Eastport a eu plus de tirs cadrés qu'Northbridge", 'Eastport had more shots on target than Northbridge.'],
  ['northbridge-eastport-analysis-demo', 'de', 'Eastport hatte mehr Schüsse aufs Tor als Northbridge', 'Eastport had more shots on target than Northbridge.'],
  ['westhaven-kingswell-demo', 'ar', 'لم يسجل كينغزويل سيتي أي تسديدة على المرمى', 'Kingswell City had no shots on target.'],
]

for (const [datasetId, language, native, english] of VARIATIONS) {
  test(`variation ${language}: ${native}`, async () => {
    const dataset = DATASET_CATALOG.find((item) => item.id === datasetId)
    const example = { clock: { period: 2, minute: 90, stoppageMinutes: 4 }, period: 'match-so-far' }
    const [a, b] = await Promise.all([
      run(dataset, example, native, language),
      run(dataset, example, english, 'en'),
    ])
    assert.deepEqual(project(a), project(b))
  })
}

test('unsupported wording stays unsupported rather than being guessed', async () => {
  const dataset = DATASET_CATALOG[0]
  const example = { clock: { period: 2, minute: 57 }, period: 'match-so-far' }
  for (const [language, text] of [
    ['es', 'El árbitro se parece a mi abuelo'],
    ['fr', 'Le ciel est bleu aujourd’hui'],
    ['de', 'Ich mag Kuchen'],
    ['ar', 'الطقس جميل اليوم'],
  ]) {
    const response = await run(dataset, example, text, language)
    for (const entry of response.claims) {
      assert.equal(entry.claim.intent, 'unrecognized-language')
      assert.equal(entry.evidence.length, 0)
    }
  }
})
