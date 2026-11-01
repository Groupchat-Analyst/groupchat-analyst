import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../../api/dist/api/src/service.js'
import {
  comparisonFactsFromResult,
  comparisonLimitation,
  formatFactualComparison,
} from '../../shared/src/factualPresentation.ts'
import {
  formatLegacyEvidence,
  formatPossessionEvidence,
  formatTurnoverEvidence,
} from '../../shared/src/evidenceLocale.ts'

const DATASET = 'northbridge-eastport-analysis-demo'
const cases = [
  ['en', 'Eastport had more shots on target than Northbridge.', 'Yes — ', 'No — '],
  ['es', 'Eastport tuvo más tiros a puerta que Northbridge.', 'Sí — ', 'No — '],
  ['fr', 'Eastport a eu plus de tirs cadrés que Northbridge.', 'Oui — ', 'Non — '],
  ['de', 'Eastport hatte mehr Schüsse aufs Tor als Northbridge.', 'Ja — ', 'Nein — '],
  ['ar', 'إيستبورت لديه تسديدات على المرمى أكثر من نورثبريدج.', 'نعم — ', 'لا — '],
]
const ask = (opinion, minute) =>
  analyzeOpinion({ opinion, datasetId: DATASET, selectedClock: { period: 2, minute }, period: 'match-so-far' })
const facts = (result) =>
  comparisonFactsFromResult(result.claims[0], (team) => team, (player) => player.name)

for (const [language, text, yes, no] of cases) {
  test(`${language}: 57′→58′ comparison is rendered from typed facts`, async () => {
    const [before, after] = await Promise.all([ask(text, 57), ask(text, 58)])
    const earlier = formatFactualComparison(facts(before), language)
    const later = formatFactualComparison(facts(after), language)
    assert.ok(earlier.startsWith(no), earlier)
    assert.ok(later.startsWith(yes), later)
    assert.notEqual(earlier, later)
    assert.match(earlier, language === 'ar' ? /تسديدتان/ : /2/)
    assert.match(later, /3/)
    assert.match(later, /Eastport/)
    if (language !== 'en') {
      assert.doesNotMatch(later, /\b(have|shots on target|Yes|No)\b/)
    }
  })
}

test('incidental English narrative cannot change typed output', async () => {
  const result = await ask(cases[4][1], 58)
  const baseline = cases.map(([language]) => formatFactualComparison(facts(result), language))
  const claim = result.claims[0]
  claim.reply = 'Totally different English prose.'
  claim.limitation = 'Another sentence.'
  claim.answer = 'Unrelated.'
  for (const item of claim.evidence) item.reference.description = 'Rewritten.'
  const after = cases.map(([language]) => formatFactualComparison(facts(result), language))
  assert.deepEqual(after, baseline)
})

test('possession comparison carries a localized scope note; counts have none', async () => {
  const result = await ask('Eastport had more possession than Northbridge', 58)
  const f = facts(result)
  assert.equal(f.metric, 'possession-percentage')
  for (const [language] of cases) {
    assert.ok(comparisonLimitation(f, language).length > 20)
    assert.match(formatFactualComparison(f, language), /%/)
  }
  const sot = facts(await ask(cases[0][1], 58))
  assert.equal(comparisonLimitation(sot, 'de'), '')
})

test('unavailable data and plural forms are explicit in every language', () => {
  const base = { verdict: 'unsettled', metric: 'shots', subject: { name: 'A', value: null }, opponent: { name: 'B', value: 3 } }
  for (const [language] of cases) {
    assert.match(formatFactualComparison(base, language), /3/)
  }
  const ar = (value) => formatFactualComparison(
    { verdict: 'supported', metric: 'shots', subject: { name: 'A', value }, opponent: { name: 'B', value: 0 } }, 'ar')
  assert.match(ar(2), /تسديدتان/)
  assert.match(ar(4), /4 تسديدات/)
  assert.match(ar(1), /تسديدة/)
})

test('evidence formatters localize typed records and keep legacy source labelled', () => {
  for (const [language] of cases) {
    const t = formatTurnoverEvidence({ time: '10′', team: 'X', player: 'P', passId: 'pass-1' }, language)
    assert.match(t, /pass-1/)
    assert.match(formatPossessionEvidence({ time: '1′–3′', team: 'X', minutes: 2, status: 'controlled' }, language), language === 'ar' ? /دقيقتان/ : /2/)
    assert.match(formatLegacyEvidence({ time: '1′', team: 'X', source: 'RAW' }, language), /RAW/)
  }
  assert.doesNotMatch(formatTurnoverEvidence({ time: '10′', team: 'X', player: 'P', passId: 'p' }, 'de'), /turnover/i)
})
