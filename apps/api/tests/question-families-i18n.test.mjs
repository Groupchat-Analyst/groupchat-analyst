import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

const DATASET = 'northbridge-eastport-analysis-demo'
const options = {
  datasetId: DATASET,
  selectedClock: { period: 2, minute: 58 },
  period: 'match-so-far',
}

const comparisons = [
  { language: 'English', shots: 'Eastport had more shots than Northbridge.', goals: 'Eastport had more goals than Northbridge.', possession: 'Eastport had more possession than Northbridge.' },
  { language: 'Español', shots: 'Eastport tuvo más tiros que Northbridge.', goals: 'Eastport tuvo más goles que Northbridge.', possession: 'Eastport tuvo más posesión que Northbridge.' },
  { language: 'Français', shots: 'Eastport a eu plus de tirs que Northbridge.', goals: 'Eastport a eu plus de buts que Northbridge.', possession: 'Eastport a eu plus de possession que Northbridge.' },
  { language: 'Deutsch', shots: 'Eastport hatte mehr Schüsse als Northbridge.', goals: 'Eastport hatte mehr Tore als Northbridge.', possession: 'Eastport hatte mehr Ballbesitz als Northbridge.' },
  { language: 'العربية', shots: 'إيستبورت لديه تسديدات أكثر من نورثبريدج.', goals: 'إيستبورت لديه أهداف أكثر من نورثبريدج.', possession: 'إيستبورت لديه استحواذ أكثر من نورثبريدج.' },
]

const fewerShotClaims = [
  { language: 'English', text: 'Eastport had fewer shots than Northbridge.' },
  { language: 'Español', text: 'Eastport tuvo menos tiros que Northbridge.' },
  { language: 'Français', text: 'Eastport a eu moins de tirs que Northbridge.' },
  { language: 'Deutsch', text: 'Eastport hatte weniger Schüsse als Northbridge.' },
  { language: 'العربية', text: 'إيستبورت لديه تسديدات أقل من نورثبريدج.' },
]

for (const { language, text } of fewerShotClaims) {
  test(`${language}: lower-count comparison keeps its direction`, async () => {
    const result = await analyzeOpinion({ ...options, opinion: text })
    const comparison = result.claims[0].claim.meaning.comparison
    assert.equal(comparison.metric, 'shots')
    assert.equal(comparison.operator, 'less-than')
  })
}
for (const language of comparisons) {
  for (const [family, text, metric] of [
    ['shots', language.shots, 'shots'],
    ['goals', language.goals, 'goals'],
    ['possession', language.possession, 'possession-percentage'],
  ]) {
    test(`${language.language}: ${family} comparison remains recognized`, async () => {
      const result = await analyzeOpinion({ ...options, opinion: text })
      const claim = result.claims[0]
      assert.equal(claim.claim.intent, 'factual-claim')
      assert.equal(claim.claim.meaning.comparison.metric, metric)
      assert.ok(['supported', 'contradicted'].includes(claim.assessment))
      assert.deepEqual(new Set(claim.statistics.map(({ team }) => team)), new Set(['Northbridge', 'Eastport']))
    })
  }
}

const countQuestions = [
  { language: 'English', text: 'How many shots did Eastport have?' },
  { language: 'Español', text: '¿Cuántos tiros tuvo Eastport?' },
  { language: 'Français', text: 'Combien de tirs Eastport a-t-il eu ?' },
  { language: 'Deutsch', text: 'Wie viele Schüsse hatte Eastport?' },
  { language: 'العربية', text: 'كم تسديدة لدى إيستبورت؟' },
]

for (const { language, text } of countQuestions) {
  test(`${language}: single-team shot count request returns its recorded statistic`, async () => {
    const result = await analyzeOpinion({ ...options, opinion: text })
    const claim = result.claims[0]
    assert.equal(claim.claim.intent, 'statistical-request')
    assert.equal(claim.assessment, 'statistics provided')
    assert.equal(claim.statistics.length, 1)
    assert.equal(claim.statistics[0].team, 'Eastport')
    assert.equal(claim.statistics[0].value, 5)
  })
}

const completedPasses = [
  { language: 'English', text: 'Northbridge completed more passes than Eastport.' },
  { language: 'Español', text: 'Northbridge completó más pases que Eastport.' },
  { language: 'Français', text: 'Northbridge a réussi plus de passes que Eastport.' },
  { language: 'Deutsch', text: 'Northbridge hat mehr Pässe abgeschlossen als Eastport.' },
  { language: 'العربية', text: 'نورثبريدج أكمل تمريرات أكثر من إيستبورت.' },
]

for (const { language, text } of completedPasses) {
  test(`${language}: completed-pass count comparison remains distinct from attempts`, async () => {
    const result = await analyzeOpinion({ ...options, opinion: text })
    const claim = result.claims[0]
    assert.equal(claim.claim.intent, 'factual-claim')
    assert.equal(claim.claim.meaning.comparison.metric, 'pass-completions')
    assert.equal(claim.assessment, 'supported')
    assert.ok(claim.statistics.every(({ metric }) => metric === 'pass-completions'))
  })
}

const completionRates = [
  { language: 'English', text: 'Northbridge had higher pass completion percentage than Eastport.' },
  { language: 'Español', text: 'Northbridge tuvo un mayor porcentaje de pases completados que Eastport.' },
  { language: 'Français', text: 'Northbridge a un meilleur taux de réussite des passes que Eastport.' },
  { language: 'Deutsch', text: 'Northbridge hat eine höhere Passquote als Eastport.' },
  { language: 'العربية', text: 'نورثبريدج لديه نسبة إكمال التمريرات أعلى من إيستبورت.' },
]

for (const { language, text } of completionRates) {
  test(`${language}: pass completion rate comparison remains recognized`, async () => {
    const result = await analyzeOpinion({ ...options, opinion: text })
    const claim = result.claims[0]
    assert.equal(claim.claim.intent, 'factual-claim')
    assert.equal(claim.claim.meaning.comparison.metric, 'pass-completion-percentage')
    assert.ok(['supported', 'contradicted'].includes(claim.assessment))
    assert.equal(claim.statistics.length, 2)
  })
}