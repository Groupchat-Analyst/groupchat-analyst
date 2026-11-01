import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

const DATASET = 'northbridge-eastport-analysis-demo'
const CLOCK = { period: 2, minute: 58 }
const compoundQuestions = [
  { language: 'English', text: 'Northbridge had more possession than Eastport but Eastport had more shots on target than Northbridge.' },
  { language: 'Español', text: 'Northbridge tuvo más posesión que Eastport pero Eastport tuvo más tiros a puerta que Northbridge.' },
  { language: 'Français', text: 'Northbridge avait plus de possession que Eastport mais Eastport a eu plus de tirs cadrés que Northbridge.' },
  { language: 'Deutsch', text: 'Northbridge hatte mehr Ballbesitz als Eastport, aber Eastport hatte mehr Schüsse aufs Tor als Northbridge.' },
  { language: 'العربية', text: 'نورثبريدج لديه استحواذ أكثر من إيستبورت لكن إيستبورت لديه تسديدات على المرمى أكثر من نورثبريدج.' },
]

for (const { language, text } of compoundQuestions) {
  test(`${language}: each supported proposition gets its own assessed claim`, async () => {
    const result = await analyzeOpinion({
      opinion: text,
      datasetId: DATASET,
      selectedClock: CLOCK,
      period: 'match-so-far',
    })

    assert.equal(result.provider, 'local')
    assert.equal(result.claims.length, 2)
    assert.deepEqual(
      result.claims.map(({ claim }) => claim.meaning.comparison?.metric),
      ['possession-percentage', 'shots-on-target'],
    )
    for (const claim of result.claims) {
      assert.equal(claim.claim.intent, 'factual-claim')
      assert.ok(['supported', 'contradicted'].includes(claim.assessment))
      assert.ok(claim.statistics.length >= 2)
    }
    assert.equal(result.claims[0].assessment, 'supported')
    assert.equal(result.claims[1].assessment, 'supported')
  })
}

test('Foundry single-claim response does not assess a compound opinion as complete', async () => {
  const opinion = 'Eastport had more possession than Northbridge but Northbridge had more shots.'
  const provider = {
    name: 'foundry',
    async interpret() {
      return {
        claims: [{
          id: 'claim-1',
          subject: 'Eastport',
          playerSubject: null,
          playerMetric: null,
          text: opinion,
          intent: 'factual-claim',
          meaning: {
            category: 'factual-comparison',
            description: 'Eastport had more possession than Northbridge.',
            comparison: {
              opponent: 'Northbridge',
              opponentPlayer: null,
              metric: 'possession-percentage',
              operator: 'greater-than',
            },
          },
          requiredEvidence: ['possession'],
          timePeriod: { kind: 'selected' },
          historicalEventAnchor: null,
          clarificationNeeds: [],
        }],
      }
    },
  }
  const result = await analyzeOpinion({
    opinion,
    datasetId: DATASET,
    selectedClock: CLOCK,
    period: 'match-so-far',
  }, provider)

  assert.equal(result.provider, 'foundry')
  assert.equal(result.claims.length, 1)
  assert.equal(result.claims[0].assessment, 'clarification needed')
  assert.equal(result.claims[0].resolution.status, 'needs-clarification')
  assert.deepEqual(result.claims[0].statistics, [])
  assert.match(result.claims[0].claim.clarificationNeeds[0], /multiple propositions/i)
})