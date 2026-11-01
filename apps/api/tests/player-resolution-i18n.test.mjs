import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion, resolvePlayerSelection } from '../dist/api/src/service.js'
import { verifyPlayerResolution } from '../dist/api/src/playerResolution.js'

const ORIGINAL = 'northbridge-eastport-analysis-demo'
const RETURN = 'northbridge-eastport-return-demo'
const WESTHAVEN = 'westhaven-kingswell-demo'
const REDMERE = 'redmere-alderwick-demo'

const CLOCKS = [
  { label: '1′', selectedClock: { period: 1, minute: 1 } },
  { label: '58′', selectedClock: { period: 2, minute: 58 } },
  { label: '90+4′', selectedClock: { period: 2, minute: 90, stoppageMinutes: 4 } },
]

// Natural questions actually written in each language (not English text shown in translated chrome).
const PERFORMANCE = {
  en: ['How did {n} play?', 'How was {n}?', 'Was {n} good?', 'How good was {n} today?'],
  es: ['¿Cómo jugó {n}?', '¿Cómo estuvo {n}?'],
  fr: ['Comment {n} a-t-il joué ?', 'Comment était {n} ?'],
  de: ['Wie hat {n} gespielt?', 'Wie war {n}?'],
  ar: ['كيف لعب {n}؟', 'كيف كان أداء {n}؟'],
}
const PASSES = {
  en: ['How many passes did {n} complete?'],
  es: ['¿Cuántos pases completó {n}?'],
  fr: ['Combien de passes {n} a-t-il réussies ?'],
  de: ['Wie viele Pässe hat {n} abgeschlossen?'],
  ar: ['كم تمريرة أكمل {n}؟'],
}

// Fixture → ambiguous first names with their two stable candidate sets.
const AMBIGUOUS = [
  { dataset: ORIGINAL, name: 'Bruno', ids: ['north-player-18', 'east-player-08'], arabic: 'برونو' },
  { dataset: ORIGINAL, name: 'Martin', ids: ['north-player-07', 'north-player-08'], arabic: 'مارتن' },
  { dataset: RETURN, name: 'Bruno', ids: ['north-player-18', 'east-player-08'], arabic: 'برونو' },
  { dataset: RETURN, name: 'Martin', ids: ['north-player-07', 'north-player-08'], arabic: 'مارتن' },
  { dataset: WESTHAVEN, name: 'Pedro', pair: ['Pedro Neto', 'Joao Pedro'] },
  { dataset: WESTHAVEN, name: 'Rayan', pair: ['Rayan Cherki', 'Rayan Aït-Nouri'] },
  { dataset: REDMERE, name: 'Bradley', pair: ['Conor Bradley', 'Bradley Barcola'] },
]

const request = (dataset, opinion, selectedClock, language) => ({
  opinion,
  selectedClock,
  period: 'match-so-far',
  datasetId: dataset,
  inputLanguage: language,
})

const neverCalled = {
  name: 'local',
  async interpret() {
    throw new Error('Selecting a player must not invoke an interpreter.')
  },
}

// Problematic Foundry responses: generic prose, a paraphrase, an incomplete category, wrong intent.
function problematicClaim(text, variant) {
  const base = {
    id: 'claim-1',
    subject: null,
    playerSubject: null,
    playerMetric: null,
    text,
    historicalEventAnchor: null,
    timePeriod: { kind: 'selected' },
    requiredEvidence: [],
  }
  switch (variant) {
    case 'generic-prose':
      return {
        ...base,
        intent: 'unrecognized-language',
        meaning: { category: 'other', description: 'unclear', comparison: null },
        clarificationNeeds: ['Several players match; availablePlayers lists more than one. Which did you mean?'],
      }
    case 'paraphrase':
      return {
        ...base,
        intent: 'subjective-judgement',
        meaning: { category: 'other', description: 'Player question', comparison: null },
        clarificationNeeds: ['Could you tell me exactly which player you are asking about?'],
      }
    default:
      return {
        ...base,
        intent: 'subjective-judgement',
        meaning: { category: 'performance-judgement', description: 'Performance', comparison: null },
        clarificationNeeds: ['Please clarify the player.'],
      }
  }
}

function stubProvider(variant) {
  let calls = 0
  return {
    calls: () => calls,
    provider: {
      name: 'foundry',
      async interpret(opinion) {
        calls += 1
        return { claims: [problematicClaim(opinion, variant)] }
      },
    },
  }
}

function questionsFor(entry) {
  const out = []
  for (const [language, templates] of Object.entries({ ...PERFORMANCE })) {
    for (const template of templates) {
      out.push({ language, family: 'performance', text: template.replace('{n}', language === 'ar' && entry.arabic ? entry.arabic : entry.name) })
    }
  }
  for (const [language, templates] of Object.entries(PASSES)) {
    for (const template of templates) {
      out.push({ language, family: 'passes', text: template.replace('{n}', language === 'ar' && entry.arabic ? entry.arabic : entry.name) })
    }
  }
  return out
}

function assertChoice(response, entry, text, clock) {
  assert.equal(response.claims.length, 1, text)
  const [result] = response.claims
  assert.equal(result.resolution?.status, 'player-choice', text)
  assert.ok(result.playerResolution, `${text}: structured choices required`)
  const candidates = result.playerResolution.candidates
  assert.equal(candidates.length, 2, text)
  if (entry.ids) assert.deepEqual(candidates.map(({ id }) => id).sort(), [...entry.ids].sort(), text)
  if (entry.pair) assert.deepEqual(candidates.map(({ name }) => name).sort(), [...entry.pair].sort(), text)
  assert.deepEqual(result.resolution.players.map(({ id }) => id), candidates.map(({ id }) => id))
  assert.equal(result.assessment, 'clarification needed')
  assert.equal(result.claim.playerSubject, null)
  assert.deepEqual(result.playerStatistics, [])
  const grant = verifyPlayerResolution(result.playerResolution.continuation)
  assert.equal(grant.request.opinion, text, 'original wording is preserved verbatim')
  assert.deepEqual(grant.request.selectedClock, clock)
  return result
}

test('ambiguous names in native-language questions give structured choices under local rules in every fixture', async () => {
  for (const entry of AMBIGUOUS) {
    for (const question of questionsFor(entry)) {
      for (const { selectedClock } of CLOCKS) {
        const response = await analyzeOpinion(request(entry.dataset, question.text, selectedClock, question.language))
        assert.equal(response.provider, 'local')
        assertChoice(response, entry, question.text, selectedClock)
      }
    }
  }
})

test('problematic Foundry clarifications still yield choices, and both selections need no further interpreter call', async () => {
  for (const variant of ['generic-prose', 'paraphrase', 'incomplete-category']) {
    for (const entry of AMBIGUOUS) {
      for (const question of questionsFor(entry)) {
        const stub = stubProvider(variant)
        const clock = CLOCKS[1].selectedClock
        const initial = await analyzeOpinion(request(entry.dataset, question.text, clock, question.language), stub.provider)
        assert.equal(initial.provider, 'foundry')
        const result = assertChoice(initial, entry, question.text, clock)
        assert.equal(stub.calls(), 1)
        for (const chosen of result.playerResolution.candidates) {
          const resolved = await resolvePlayerSelection({
            action: 'resolve-player',
            continuation: result.playerResolution.continuation,
            claimId: result.claim.id,
            playerId: chosen.id,
          })
          const [answer] = resolved.claims
          assert.equal(answer.claim.playerSubject.id, chosen.id)
          assert.equal(answer.playerResolution, undefined)
          assert.equal(answer.resolution, undefined, 'a resolved answer carries no pending state')
          assert.notEqual(answer.assessment, 'clarification needed', question.text)
          assert.equal(resolved.selectedTime, '58′')
          assert.ok(answer.playerStatistics.every(({ playerId }) => playerId === chosen.id))
        }
        assert.equal(stub.calls(), 1, `${variant}: selection reused the saved interpretation`)
      }
    }
  }
})

test('selecting either candidate resolves through the signed continuation at 1′, 58′ and full time', async () => {
  const entry = AMBIGUOUS[0]
  for (const { label, selectedClock } of CLOCKS) {
    const initial = await analyzeOpinion(request(entry.dataset, 'Wie hat Bruno gespielt?', selectedClock, 'de'))
    const result = assertChoice(initial, entry, 'Wie hat Bruno gespielt?', selectedClock)
    for (const chosen of result.playerResolution.candidates) {
      const resolved = await analyzeOpinion(
        { action: 'resolve-player', continuation: result.playerResolution.continuation, claimId: result.claim.id, playerId: chosen.id },
        neverCalled,
      )
      assert.equal(resolved.selectedTime, label)
      assert.equal(resolved.claims[0].claim.playerSubject.id, chosen.id)
      assert.equal(resolved.evidenceFoundation.dataset.id, ORIGINAL)
    }
  }
})

test('Gomes and Gomez never swap, under local rules and under a generic Foundry response', async () => {
  const cases = [
    ['How did Gomes play?', 'João Gomes'],
    ['How did Gomez play?', 'Joe Gomez'],
    ['Wie hat Gomes gespielt?', 'João Gomes'],
    ['كيف لعب Gomez؟', 'Joe Gomez'],
  ]
  for (const [text, expected] of cases) {
    for (const stub of [undefined, stubProvider('generic-prose').provider]) {
      const response = await analyzeOpinion(request(REDMERE, text, CLOCKS[1].selectedClock, 'en'), stub)
      const [result] = response.claims
      assert.equal(result.claim.playerSubject?.name, expected, `${text} (${response.provider})`)
      assert.equal(result.playerResolution, undefined)
      assert.equal(result.resolution, undefined)
    }
  }
})

test('Martin is not Martínez and a team qualifier cannot resolve two Northbridge Martins', async () => {
  const martinez = await analyzeOpinion(request(ORIGINAL, 'How did Martínez play?', CLOCKS[1].selectedClock, 'en'))
  assert.match(martinez.claims[0].claim.playerSubject?.name ?? '', /Mart[ií]nez/u)
  const martin = await analyzeOpinion(request(ORIGINAL, 'How did Martin play?', CLOCKS[1].selectedClock, 'en'))
  assert.deepEqual(
    martin.claims[0].playerResolution.candidates.map(({ name }) => name).sort(),
    ['Martin Ødegaard', 'Martín Zubimendi'],
  )
  const qualified = await analyzeOpinion(request(ORIGINAL, 'How did Northbridge Martin play?', CLOCKS[1].selectedClock, 'en'))
  const [result] = qualified.claims
  assert.ok(result.playerResolution?.candidates.length === 2 || result.resolution !== undefined)
})

test('names absent from the selected fixture give a missing-player state and never borrow another fixture', async () => {
  const absent = [
    [ORIGINAL, 'Messi', 'en', 'How did Messi play?'],
    [ORIGINAL, 'Messi', 'es', '¿Cómo jugó Messi?'],
    [ORIGINAL, 'Messi', 'fr', 'Comment Messi a-t-il joué ?'],
    [ORIGINAL, 'Messi', 'de', 'Wie hat Messi gespielt?'],
    [ORIGINAL, 'Messi', 'ar', 'كيف لعب Messi؟'],
    [ORIGINAL, 'Pedro', 'en', 'How did Pedro play?'],
    [REDMERE, 'Rayan', 'en', 'How did Rayan play?'],
    [WESTHAVEN, 'Bradley', 'en', 'How did Bradley play?'],
  ]
  for (const [dataset, name, language, text] of absent) {
    for (const stub of [undefined, stubProvider('generic-prose').provider]) {
      for (const { selectedClock } of CLOCKS) {
        const response = await analyzeOpinion(request(dataset, text, selectedClock, language), stub)
        const [result] = response.claims
        assert.deepEqual(result.resolution, { status: 'player-not-in-fixture', name }, text)
        assert.equal(result.playerResolution, undefined)
        assert.equal(result.claim.playerSubject, null)
        assert.deepEqual(result.playerStatistics, [])
        assert.equal(response.playerResolutionContinuation, undefined)
      }
    }
  }
})

test('general noun phrases and pronouns are not treated as absent players', async () => {
  for (const text of ['How was the second half?', 'How did he play?', 'How was today?', "How was Northbridge's defence?"]) {
    const response = await analyzeOpinion(request(ORIGINAL, text, CLOCKS[1].selectedClock, 'en'))
    assert.notEqual(response.claims[0].resolution?.status, 'player-not-in-fixture', text)
  }
})

test('unsupported wording that names an identifiable player keeps the player in a structured state', async () => {
  const response = await analyzeOpinion(request(ORIGINAL, 'Is Bruno Guimarães a wizard?', CLOCKS[1].selectedClock, 'en'))
  const [result] = response.claims
  if (result.assessment === 'unrecognized language' || result.assessment === 'clarification needed') {
    assert.ok(result.resolution, 'an unresolved claim carries a structured state')
    if (result.resolution.status === 'unsupported-wording') {
      assert.ok(result.resolution.players.some(({ name }) => name === 'Bruno Guimarães'))
    }
  }
})

test('a foreign-team override exposes no stale player candidates or continuation', async () => {
  for (const opinion of ['How did Bruno play against Westhaven?', 'How did Bruno play and did Westhaven have more possession than Redmere?']) {
    const response = await analyzeOpinion(request(ORIGINAL, opinion, CLOCKS[1].selectedClock, 'en'))
    const text = JSON.stringify(response)
    assert.ok(!text.includes('playerResolution'), opinion)
    assert.ok(!text.includes('player-choice'), opinion)
    assert.equal(response.playerResolutionContinuation, undefined, opinion)
    for (const claim of response.claims) {
      assert.equal(claim.resolution, undefined)
      assert.equal(claim.assessment === 'unrecognized language' || claim.assessment !== 'clarification needed', true)
    }
  }
})
