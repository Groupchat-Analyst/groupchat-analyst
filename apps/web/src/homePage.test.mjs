import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { HOME_PREVIEW } from '../../shared/src/homePreview.ts'
import { matchHash } from './routes.ts'
import { BASELINE_DATASET_ID } from '../../shared/src/datasetCatalog.ts'

test('the homepage never requests analysis and its preview is a static model', async () => {
  const source = await readFile(new URL('./HomePage.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /fetch\(|requestAnalysis|analysisClient|replayApi|\/api\//)
  assert.match(source, /HOME_PREVIEW/)
})

test('the only primary action is Try it Out and it opens match selection, not the walkthrough', async () => {
  const source = await readFile(new URL('./HomePage.tsx', import.meta.url), 'utf8')
  assert.match(source, /MATCHES_HASH = '#\/matches'/)
  assert.match(source, /className="lp-primary" href=\{MATCHES_HASH\}>Try it Out</)
  assert.equal((source.match(/lp-primary/g) ?? []).length, 1)
  assert.doesNotMatch(source, /matchHash|\/demo|Try the 57/)
  assert.match(source, /Your mate’s football opinion\./)
  assert.match(source, /Pick a match\. Check the moment\. Bring the evidence back to the chat\./)
  assert.equal(matchHash(BASELINE_DATASET_ID, true), '#/match/northbridge-eastport-analysis-demo/demo')
})

test('the homepage states the disclosure and avoids unsupported claims', async () => {
  const source = await readFile(new URL('./HomePage.tsx', import.meta.url), 'utf8')
  assert.match(source, /Fictional matches · Local rules · No AI model connected/)
  assert.match(source, /WhatsApp companion is planned/)
  assert.doesNotMatch(source, /testimonial|users love|live data|powered by AI/i)
})

test('the preview model targets the Original fixture and keeps the opinion fixed', () => {
  assert.equal(HOME_PREVIEW.datasetId, BASELINE_DATASET_ID)
  assert.deepEqual(HOME_PREVIEW.frames.map(({ minute }) => minute), [57, 58])
})
