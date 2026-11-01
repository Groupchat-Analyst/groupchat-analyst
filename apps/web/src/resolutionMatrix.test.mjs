import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion, resolvePlayerSelection } from '../../api/dist/api/src/service.js'
import { claimResolution, hasUnresolvedClaims, resolutionMessage } from '../../shared/src/claimState.ts'
import { translateText } from '../../shared/src/localization.ts'

const FIXTURES = [
  ['northbridge-eastport-analysis-demo', 'Bruno', ['Bruno Guimarães', 'Bruno Fernandes']],
  ['northbridge-eastport-analysis-demo', 'Martin', ['Martín Zubimendi', 'Martin Ødegaard']],
  ['northbridge-eastport-return-demo', 'Bruno', ['Bruno Guimarães', 'Bruno Fernandes']],
  ['westhaven-kingswell-demo', 'Pedro', ['Pedro Neto', 'João Pedro']],
  ['redmere-alderwick-demo', 'Bradley', ['Conor Bradley', 'Bradley Barcola']],
]
const QUESTIONS = {
  en: 'How did {n} play?',
  es: '¿Cómo jugó {n}?',
  fr: 'Comment {n} a-t-il joué ?',
  de: 'Wie hat {n} gespielt?',
  ar: 'كيف لعب {n}؟',
}
const ARABIC = { Bruno: 'برونو', Martin: 'مارتن' }
const CLOCKS = [{ period: 1, minute: 1 }, { period: 2, minute: 58 }, { period: 2, minute: 90, stoppageMinutes: 4 }]
const generic = {
  name: 'foundry',
  async interpret(opinion) {
    return {
      claims: [{
        id: 'claim-1', subject: null, playerSubject: null, playerMetric: null, text: opinion,
        historicalEventAnchor: null, timePeriod: { kind: 'selected' }, requiredEvidence: [],
        intent: 'unrecognized-language',
        meaning: { category: 'other', description: 'unclear', comparison: null },
        clarificationNeeds: ['Which one do you mean? availablePlayers: several'],
      }],
    }
  },
}
const strip = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '')
const ask = (datasetId, opinion, selectedClock, language, provider) =>
  analyzeOpinion({ opinion, selectedClock, period: 'match-so-far', datasetId, inputLanguage: language }, provider)

test('pending choices render localized guidance, name both candidates and block sharing (both providers)', async () => {
  for (const [datasetId, name, names] of FIXTURES) {
    for (const [language, template] of Object.entries(QUESTIONS)) {
      const nameText = language === 'ar' && ARABIC[name] ? ARABIC[name] : name
      const opinion = template.replace('{n}', nameText)
      for (const provider of [undefined, generic]) {
        for (const clock of CLOCKS) {
          const response = await ask(datasetId, opinion, clock, language, provider)
          assert.equal(hasUnresolvedClaims(response.claims), true, opinion)
          const [claim] = response.claims
          const state = claimResolution(claim)
          assert.equal(state.status, 'player-choice')
          for (const ui of Object.keys(QUESTIONS)) {
            const message = resolutionMessage(state, ui)
            for (const player of names) assert.ok(strip(message).includes(strip(player)), `${ui}: ${message}`)
            assert.doesNotMatch(message, /availablePlayers|\{|\}/)
            if (ui !== 'en') assert.notEqual(message, resolutionMessage(state, 'en'))
          }
          if (language === 'en') assert.ok(opinion.startsWith(claim.claim.text), 'claim text keeps the original wording')
        }
      }
    }
  }
})

test('a resolved answer is shareable at every clock and no longer pending', async () => {
  for (const [datasetId, name] of FIXTURES) {
    for (const clock of CLOCKS) {
      const initial = await ask(datasetId, `How did ${name} play?`, clock, 'en')
      const [pending] = initial.claims
      for (const choice of pending.playerResolution.candidates) {
        const resolved = await resolvePlayerSelection({
          action: 'resolve-player',
          continuation: pending.playerResolution.continuation,
          claimId: pending.claim.id,
          playerId: choice.id,
        })
        assert.equal(hasUnresolvedClaims(resolved.claims), false)
        assert.equal(claimResolution(resolved.claims[0]), undefined)
      }
    }
  }
})

test('mixed answers stay unshareable until every claim is resolved; absent players give a missing state', async () => {
  const clock = CLOCKS[2]
  const mixed = await ask(
    'northbridge-eastport-analysis-demo',
    'How did Bruno play, and Northbridge had more shots than Eastport',
    clock,
    'en',
  )
  assert.equal(hasUnresolvedClaims(mixed.claims), true)
  assert.ok(mixed.claims.some((claim) => claimResolution(claim) === undefined), 'the other claim still has its answer')
  const absent = await ask('northbridge-eastport-analysis-demo', 'How did Messi play?', clock, 'en')
  const state = claimResolution(absent.claims[0])
  assert.equal(state.status, 'player-not-in-fixture')
  for (const ui of Object.keys(QUESTIONS)) {
    assert.ok(resolutionMessage(state, ui).includes('Messi'))
  }
})

test('legacy saved responses without structured state degrade explicitly', () => {
  const legacyPending = { assessment: 'clarification needed', claim: { clarificationNeeds: ['Which player?'] } }
  assert.deepEqual(claimResolution(legacyPending), { status: 'needs-clarification' })
  assert.equal(hasUnresolvedClaims([legacyPending]), true)
  assert.equal(hasUnresolvedClaims([{ assessment: 'supported' }]), false)
})

test('loading and moving strings are localized in every language', () => {
  for (const text of ['Checking the match…', 'Loading the match…', 'Clarification:', 'Limitation:']) {
    for (const language of ['es', 'fr', 'de', 'ar']) {
      assert.notEqual(translateText(text, language), text, `${language}: ${text}`)
    }
  }
})




test('generated comparison and fallback sentences translate from their templates in every language', async () => {
  const { COMPARISON_MESSAGES } = await import('../../shared/src/comparisonLocale.ts')
  const { translateNarrative } = await import('../../shared/src/localization.ts')
  for (const language of ['es', 'fr', 'de', 'ar']) {
    for (const template of Object.values(COMPARISON_MESSAGES)) {
      const english = template.replace('{earlier}', '57′').replace('{later}', '58′')
      const translated = translateNarrative(english, language)
      assert.notEqual(translated, english, `${language}: ${english}`)
      assert.ok(!/\b(check|answers|match|the)\b/.test(translated) || language === 'fr' || language === 'de', translated)
      if (template.includes('{earlier}')) assert.ok(translated.includes('57′') && translated.includes('58′'))
    }
  }
})
