import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { comparisonLimitation } from '../../shared/src/factualPresentation.ts'

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'node_modules' || name === 'dist' ? [] : sources(path)
    return /\.(ts|tsx|mjs)$/.test(name) ? [path] : []
  })
}

test('source files contain no replacement characters or question-mark runs from lossy encoding', () => {
  const offenders = []
  for (const root of ['../../shared/src', '.']) {
    for (const file of sources(new URL(root, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
      const text = readFileSync(file, 'utf8')
      if (text.includes('\uFFFD') || /\?{4,}/.test(text)) offenders.push(file)
    }
  }
  assert.deepEqual(offenders, [])
})

test('possession limitation is real text in every language', () => {
  const facts = { metric: 'possession-percentage' }
  const expected = {
    en: 'Possession only counts recorded controlled time',
    es: 'La posesión solo cuenta el tiempo de control registrado',
    fr: 'La possession ne compte que le temps de contrôle enregistré',
    de: 'Ballbesitz zählt nur erfasste Kontrollzeit',
    ar: 'يحتسب الاستحواذ وقت السيطرة المسجّل فقط',
  }
  for (const [language, start] of Object.entries(expected)) {
    const text = comparisonLimitation(facts, language)
    assert.ok(text.startsWith(start), `${language}: ${text}`)
    assert.ok(!text.includes('?') && !text.includes('\uFFFD'), language)
  }
})
