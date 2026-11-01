import assert from 'node:assert/strict'
import test from 'node:test'
import { claimResolution, resolutionMessage } from '../../shared/src/claimState.ts'

const languages = ['en', 'es', 'fr', 'de', 'ar']
const players = [{ name: 'Bruno Guimarães' }, { name: 'Bruno Fernandes' }]

test('every state renders localized guidance without implementation wording', () => {
  const states = [
    { status: 'player-choice', players },
    { status: 'player-not-in-fixture', name: 'Messi' },
    { status: 'unsupported-wording', players },
    { status: 'needs-clarification' },
  ]
  for (const language of languages) {
    const seen = new Set()
    for (const state of states) {
      const text = resolutionMessage(state, language)
      assert.ok(text && !/availablePlayers|\{|\}/.test(text), `${language} ${state.status}`)
      seen.add(text)
    }
    assert.equal(seen.size, states.length)
  }
  assert.notEqual(
    resolutionMessage(states[0], 'de'),
    resolutionMessage(states[0], 'en'),
  )
  assert.match(resolutionMessage(states[0], 'ar'), /،/)
})

test('claims without structured state are handled explicitly', () => {
  assert.equal(claimResolution({ assessment: 'supported' }), undefined)
  assert.deepEqual(claimResolution({ assessment: 'clarification needed' }), { status: 'needs-clarification' })
  assert.equal(claimResolution({ assessment: 'x', resolution: { status: 'player-not-in-fixture', name: 'M' } }).status, 'player-not-in-fixture')
})
