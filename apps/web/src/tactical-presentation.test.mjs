import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { checkedAgainst, needsPassMap } from './investigation.ts'
import {
  CONTEXT_ONLY_LABEL,
  buildShareCardModel,
  canonicalReply,
  isUnsupportedJudgement,
  shareCardBlocks,
  shareCardText,
} from './presentation.ts'

// Captured-output replay of the saved 90b7e97 call-3 interpretation through the real
// application path (offline stub), plus the original live response. Not new Foundry verification.
const load = (name) => JSON.parse(readFileSync(new URL(`./testdata/${name}.json`, import.meta.url), 'utf8'))
const TAKE = 'Northbridge parked the bus.'
const replay = load('foundry-parked-bus-57-replay')
const live = load('foundry-parked-bus-57-live-response')

test('the live response and its replay are the same unsupported tactical judgement', () => {
  for (const analysis of [live, replay]) {
    assert.equal(isUnsupportedJudgement(analysis.claims[0]), true)
    assert.equal(analysis.claims[0].assessment, 'insufficient evidence for a firm conclusion')
  }
})

test('Checked against names the missing shape evidence and never possession', () => {
  for (const analysis of [live, replay]) {
    const [line] = checkedAgainst(analysis)
    assert.match(line, /defensive shape and positioning \(not recorded, so no verdict\)/)
    assert.match(line, /Match so far through 57′/)
    assert.doesNotMatch(line, /possession/i)
  }
})

test('no pass map is offered for a tactical judgement that merely lists passing evidence', () => {
  assert.ok(replay.claims[0].claim.requiredEvidence.includes('passing'))
  assert.equal(needsPassMap(replay), false)
})

test('the share card and copied text label possession as context and quote the user wording', () => {
  const model = buildShareCardModel(TAKE, replay)
  const blocks = shareCardBlocks(model)
  const text = shareCardText(model)
  assert.equal(model.claims[0].contextOnly, true)
  assert.equal(blocks.some(({ text: t }) => t === 'Key facts'), false)
  assert.equal(blocks.some(({ kind, text: t }) => kind === 'label' && t === CONTEXT_ONLY_LABEL), true)
  assert.match(text, /“Northbridge parked the bus\.”/)
  assert.doesNotMatch(text, /extremely defensive|low-block/)
  assert.doesNotMatch(text, /Verdict: (supported|contradicted)/i)
  assert.match(text, /Limitation: .*defensive-shape tracking/)
  assert.match(text, /Synthetic data/)
  assert.match(canonicalReply(replay), /Nothing here records defensive shape/)
})

test('a genuine possession question keeps its possession evidence and wording', () => {
  const possession = load('possession-57')
  assert.equal(isUnsupportedJudgement(possession.claims[0]), false)
  const [line] = checkedAgainst(possession)
  assert.match(line, /possession/i)
  const model = buildShareCardModel('Did Northbridge have more possession?', possession)
  assert.equal(model.claims[0].contextOnly, false)
  assert.equal(shareCardBlocks(model).some(({ text }) => text === 'Key facts'), true)
})

test('passing claims still get the pass map', () => {
  const analysis = structuredClone(replay)
  analysis.claims[0].claim.intent = 'statistical-request'
  assert.equal(needsPassMap(analysis), true)
})
