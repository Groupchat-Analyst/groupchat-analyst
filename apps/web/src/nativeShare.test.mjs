import assert from 'node:assert/strict'
import { test } from 'node:test'
import { imageKey, preparedFor, shareReceipts, supportsFileShare } from './nativeShare.ts'

const blocks = [{ kind: 'take', text: 'Eastport had more shots.' }, { kind: 'footer', text: 'Synthetic data · fictional match' }]
const file = () => new File(['png'], 'card.png', { type: 'image/png' })
const key = imageKey('single', blocks)

test('file sharing is detected only when share and canShare accept an image file', () => {
  assert.equal(supportsFileShare(undefined, file()), false)
  assert.equal(supportsFileShare({ share: async () => {} }, file()), false)
  assert.equal(supportsFileShare({ share: async () => {}, canShare: () => false }, file()), false)
  assert.equal(supportsFileShare({ share: async () => {}, canShare: () => { throw new Error('x') } }, file()), false)
  assert.equal(supportsFileShare({ share: async () => {}, canShare: (d) => d.files.length === 1 }, file()), true)
})

test('a prepared image is invalidated when the card content changes', () => {
  const prepared = { key, file: file() }
  assert.equal(preparedFor(prepared, key), prepared.file)
  assert.notEqual(key, imageKey('single', [...blocks, { kind: 'note', text: 'Limitation: partial coverage' }]))
  assert.equal(preparedFor(prepared, imageKey('single', [...blocks, { kind: 'note', text: 'Limitation: partial coverage' }])), null)
  assert.notEqual(key, imageKey('change', blocks))
  assert.equal(preparedFor(null, key), null)
})

test('sharing hands the prepared PNG to the share sheet synchronously, before any await', async () => {
  const calls = []
  const nav = { share: (data) => { calls.push(data); return Promise.resolve() }, canShare: () => true }
  const pending = shareReceipts(nav, { key, file: file() }, key, 'Groupchat Analyst receipt')
  assert.equal(calls.length, 1)
  const outcome = await pending
  assert.equal(calls[0].files[0].type, 'image/png')
  assert.deepEqual(Object.keys(calls[0]).sort(), ['files', 'title'])
  assert.equal(outcome.status, 'shared')
  assert.doesNotMatch(outcome.message, /sent|delivered|posted/i)
})

test('cancelling the share sheet is normal and shows no error', async () => {
  const nav = { share: () => Promise.reject(new DOMException('cancelled', 'AbortError')), canShare: () => true }
  assert.deepEqual(await shareReceipts(nav, { key, file: file() }, key, 't'), { status: 'cancelled', message: '' })
})

test('other share failures point to the copy and download fallbacks', async () => {
  const nav = { share: () => Promise.reject(new Error('boom')), canShare: () => true }
  const outcome = await shareReceipts(nav, { key, file: file() }, key, 't')
  assert.equal(outcome.status, 'failed')
  assert.match(outcome.message, /Copy the card text or download/)
})

test('a missing or stale prepared image never reaches the share sheet', async () => {
  let called = 0
  const nav = { share: async () => { called++ }, canShare: () => true }
  assert.equal((await shareReceipts(nav, null, key, 't')).status, 'not-ready')
  assert.equal((await shareReceipts(nav, { key: 'old', file: file() }, key, 't')).status, 'not-ready')
  assert.equal((await shareReceipts(undefined, { key, file: file() }, key, 't')).status, 'unsupported')
  assert.equal(called, 0)
})
