import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceFooter } from './presentation.ts'

const analysis = (provider, id, version) => ({ provider, evidenceFoundation: { dataset: { id, version } } })

test('share footer names the fictional fixture, its version and how the opinion was read', () => {
  assert.equal(
    sourceFooter(analysis('local', 'northbridge-eastport-return-demo', '1.0.0')),
    'Synthetic data · fictional match · Return match v1.0.0 · read by local rules',
  )
  assert.match(sourceFooter(analysis('foundry', 'northbridge-eastport-analysis-demo', '3.0.0')), /Original match v3\.0\.0 · read by Foundry/)
})

test('an unknown dataset still keeps the synthetic label and never claims a match', () => {
  const footer = sourceFooter(analysis('local', 'other', '9'))
  assert.match(footer, /^Synthetic data · fictional match/)
  assert.doesNotMatch(footer, /Original|Return/)
})
