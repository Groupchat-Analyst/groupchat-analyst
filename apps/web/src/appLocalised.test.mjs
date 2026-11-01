import assert from 'node:assert/strict'
import { test } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import { analyzeOpinion } from '../../api/dist/api/src/service.js'
import { getReplayFrame } from '../../api/dist/api/src/functions/replay.js'
import { DATASET_CATALOG } from '../../shared/src/datasetCatalog.ts'
import { formatMatchClock } from '../../shared/src/matchClock.ts'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LANGUAGES = ['en', 'es', 'fr', 'de', 'ar']
const WESTHAVEN = 'westhaven-kingswell-demo'
const RETURN = 'northbridge-eastport-return-demo'
const ORIGINAL = 'northbridge-eastport-analysis-demo'

const bundle = await build({
  stdin: {
    contents: `
      import { createRoot } from 'react-dom/client'
      import { createElement } from 'react'
      import Shell from './src/Shell.tsx'
      createRoot(document.getElementById('root')).render(createElement(Shell))
    `,
    resolveDir: webRoot,
    sourcefile: 'entry.tsx',
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'silent',
})
const appScript = bundle.outputFiles[0].text

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function until(check, what, timeoutMs = 15000) {
  const started = Date.now()
  for (;;) {
    const value = check()
    if (value) return value
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for ${what}`)
    await sleep(25)
  }
}

function mountApp({ hash, language }) {
  const fetchCalls = []
  const writes = []
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: `http://localhost/${hash}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  })
  const { window } = dom
  window.localStorage.setItem('groupchat-analyst-language', language)
  window.structuredClone = structuredClone
  window.scrollTo = () => undefined
  window.HTMLElement.prototype.scrollIntoView = () => undefined
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: async (text) => { writes.push(text) } },
    configurable: true,
  })
  window.fetch = async (url, init) => {
    fetchCalls.push(String(url))
    const body = JSON.parse(init.body)
    let payload
    let status = 200
    try {
      payload = String(url).endsWith('/api/replay')
        ? getReplayFrame(body.selectedClock, body.datasetId)
        : await analyzeOpinion(body)
    } catch (error) {
      status = 400
      payload = { error: String(error) }
    }
    const text = JSON.stringify(payload)
    return { ok: status === 200, status, text: async () => text, json: async () => JSON.parse(text) }
  }
  window.eval(appScript)
  return { dom, window, document: window.document, writes, fetchCalls }
}

function setValue(window, element, value) {
  const isSelect = element.tagName === 'SELECT'
  const prototype = isSelect ? window.HTMLSelectElement.prototype : window.HTMLTextAreaElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
  element.dispatchEvent(new window.Event(isSelect ? 'change' : 'input', { bubbles: true }))
}

async function selectTime(app, key) {
  const select = await until(() => app.document.getElementById('match-time'), 'match time select')
  await until(() => !app.document.querySelector('.check-button')?.disabled, 'replay ready')
  setValue(app.window, select, key)
  await sleep(150)
  await until(() => !app.document.querySelector('.check-button')?.disabled, 'replay at selected time')
}

async function ask(app, opinion) {
  const textarea = await until(() => app.document.getElementById('opinion-input'), 'opinion box')
  setValue(app.window, textarea, opinion)
  await sleep(20)
  app.document.querySelector('.check-button').click()
  await until(() => app.document.querySelector('.share-row .copy-button'), 'answer actions')
}

// Examples are offered once the replay has reached their clock, so move to the final option first.
async function selectLatestTime(app) {
  const select = await until(() => app.document.getElementById('match-time'), 'match time select')
  await until(() => !app.document.querySelector('.check-button')?.disabled, 'replay ready')
  await selectTime(app, [...select.options].at(-1).value)
}

// Hand-written expectations: the example text and help in the composer for Westhaven at 62′.
const WESTHAVEN_PEDRO = {
  en: { text: 'How many passes did Pedro complete?', help: 'Ambiguous name: asks which Pedro · 62′' },
  es: { text: '¿Cuántos pases completó Pedro?', help: 'Nombre ambiguo: pregunta a qué Pedro te refieres. · 62′' },
  fr: { text: 'Combien de passes Pedro a-t-il réussies ?', help: 'Nom ambigu : demande de quel Pedro il s’agit. · 62′' },
  de: { text: 'Wie viele Pässe hat Pedro vervollständigt?', help: 'Mehrdeutiger Name: fragt, welcher Pedro gemeint ist. · 62′' },
}

for (const language of ['en', 'es', 'fr', 'de']) {
  test(`Westhaven Pedro example and its accessible help are localised in ${language}`, async () => {
    const app = mountApp({ hash: `#/match/${WESTHAVEN}`, language })
    await selectLatestTime(app)
    await until(() => app.document.querySelector('.suggestions button'), 'examples')
    const buttons = [...app.document.querySelectorAll('.suggestions button')]
    const pedro = buttons.find((button) => button.title.includes(' · 62′'))
    assert.ok(pedro, 'a 62′ example is offered')
    assert.equal(pedro.textContent, WESTHAVEN_PEDRO[language].text)
    assert.equal(pedro.title, WESTHAVEN_PEDRO[language].help)
    pedro.click()
    await sleep(100)
    assert.equal(app.document.getElementById('opinion-input').value, WESTHAVEN_PEDRO[language].text)
    app.window.close()
  })
}

test('Westhaven Pedro example is localised in Arabic with Arabic help', async () => {
  const app = mountApp({ hash: `#/match/${WESTHAVEN}`, language: 'ar' })
  await selectLatestTime(app)
  await until(() => app.document.querySelector('.suggestions button'), 'examples')
  const pedro = [...app.document.querySelectorAll('.suggestions button')].find((button) => button.title.includes('62′'))
  assert.ok(pedro)
  assert.match(pedro.textContent, /بيدرو/u)
  assert.match(pedro.title, /[\u0600-\u06ff]/u)
  assert.doesNotMatch(pedro.title, /Ambiguous|Pedro/u)
  app.window.close()
})

test('every fixture offers examples and help in the selected language, never the English source', async () => {
  for (const dataset of DATASET_CATALOG) {
    for (const language of LANGUAGES.filter((code) => code !== 'en')) {
      const app = mountApp({ hash: `#/match/${dataset.id}`, language })
      await selectLatestTime(app)
      await until(() => app.document.querySelector('.suggestions button'), `${dataset.id} examples`)
      const buttons = [...app.document.querySelectorAll('.suggestions button')]
      assert.equal(buttons.length, dataset.examples.length, `${dataset.id} ${language} example count`)
      for (const example of dataset.examples) {
        const clock = formatMatchClock(example.clock)
        const button = buttons.find((candidate) => candidate.title.endsWith(` · ${clock}`) && candidate.title.length > clock.length + 3)
        assert.ok(button, `${dataset.id} ${language} ${example.id}`)
        assert.notEqual(button.textContent, example.text, `${dataset.id} ${language} text ${example.id}`)
        assert.ok(!button.title.startsWith(example.shows), `${dataset.id} ${language} help ${example.id}`)
      }
      assert.deepEqual(app.fetchCalls.filter((url) => url.endsWith('/api/analyze')), [], 'showing examples asks for no analysis')
      app.window.close()
    }
  }
})

test('French Analyst pass completion uses the French decimal separator on screen, in copy and on the card', async () => {
  const app = mountApp({ hash: `#/match/${RETURN}`, language: 'fr' })
  await selectTime(app, '2-60-0')
  await ask(app, 'Comment Ødegaard a-t-il joué ?')
  const analyst = [...app.document.querySelectorAll('button[aria-pressed]')].find((button) => button.textContent.trim() === 'Analyste')
  assert.ok(analyst, 'Analyst view toggle')
  analyst.click()
  await sleep(100)
  const screen = app.document.body.textContent
  assert.match(screen, /16,7%/u)
  assert.doesNotMatch(screen, /16\.7%/u)
  assert.match(screen, /1 passe réussie sur 6/u)
  assert.doesNotMatch(screen, /1 passes réussies/u)

  const reply = app.document.querySelector('.share-row .copy-button')
  reply.click()
  await until(() => app.writes.length > 0, 'copy reply')
  const card = reply.nextElementSibling
  card.click()
  await until(() => app.writes.length > 1, 'copy card')
  for (const text of app.writes) {
    assert.doesNotMatch(text, /16\.7/u)
    assert.match(text, /1 passe réussie sur 6/u)
  }
  app.window.close()
})

test('French pass counts are singular for zero and one and plural from two', async () => {
  const cases = [
    ['1-30-0', /0 passe réussie sur 3/u],
    ['2-60-0', /1 passe réussie sur 6/u],
    ['2-75-0', /2 passes réussies sur 7/u],
  ]
  for (const [clock, expected] of cases) {
    const app = mountApp({ hash: `#/match/${RETURN}`, language: 'fr' })
    await selectTime(app, clock)
    await ask(app, 'Comment Ødegaard a-t-il joué ?')
    assert.match(app.document.body.textContent, expected, clock)
    app.window.close()
  }
})

test('the earlier-answer label shows the earlier clock once', async () => {
  for (const language of ['en', 'fr']) {
    const app = mountApp({ hash: `#/match/${ORIGINAL}`, language })
    await selectTime(app, '2-57-0')
    await ask(app, 'Eastport had more shots on target than Northbridge.')
    await selectTime(app, '2-58-0')
    const recheck = await until(() => app.document.querySelector('.check-again button'), 'check again')
    recheck.click()
    const summary = await until(() => app.document.querySelector('.earlier-answer > summary'), 'earlier-answer label')
    const occurrences = summary.textContent.match(/57′/gu) ?? []
    assert.equal(occurrences.length, 1, summary.textContent)
    app.window.close()
  }
})

const HOME = {
  en: { eyebrow: /AI reads questions when enabled/u, caption: /no AI is involved in this homepage illustration/u, privacy: /hashed network identifier/u },
  es: { eyebrow: /La IA lee las preguntas cuando está activada/u, caption: /no interviene ninguna IA/u, privacy: /identificador de red cifrado/u },
  fr: { eyebrow: /L’IA lit les questions lorsqu’elle est activée/u, caption: /aucune IA n’intervient/u, privacy: /identifiant réseau haché/u },
  de: { eyebrow: /KI liest Fragen, wenn aktiviert/u, caption: /keine KI beteiligt/u, privacy: /gehashte Netzwerkkennung/u },
  ar: { eyebrow: /يقرأ الذكاء الاصطناعي الأسئلة عند تفعيله/u, caption: /لا يشارك أي ذكاء اصطناعي/u, privacy: /معرّف شبكة مشفّر/u },
}

for (const language of LANGUAGES) {
  test(`the homepage describes AI, local rules and storage accurately in ${language} without any request`, async () => {
    const app = mountApp({ hash: '', language })
    await until(() => app.document.querySelector('.lp-disclosure'), 'homepage')
    const text = app.document.body.textContent
    assert.match(app.document.querySelector('.lp-disclosure').textContent, HOME[language].eyebrow)
    assert.match(app.document.querySelector('.lp-caption').textContent, HOME[language].caption)
    assert.match(text, HOME[language].privacy)
    assert.doesNotMatch(text, /No AI model connected|not an AI model|Nothing is stored/u)
    if (language !== 'en') assert.doesNotMatch(app.document.querySelector('.lp-disclosure').textContent, /Fictional|AI reads/u)
    assert.deepEqual(app.fetchCalls, [], 'loading the homepage makes no requests')
    app.window.close()
  })
}

test('changing language on the homepage makes no requests and updates the disclosure', async () => {
  const app = mountApp({ hash: '', language: 'en' })
  await until(() => app.document.querySelector('.lp-disclosure'), 'homepage')
  const select = app.document.querySelector('.language-control select')
  assert.ok(select, 'language selector')
  setValue(app.window, select, 'es')
  await until(() => app.document.documentElement.lang === 'es', 'language es')
  assert.match(app.document.querySelector('.lp-disclosure').textContent, HOME.es.eyebrow)
  assert.deepEqual(app.fetchCalls, [])
  app.window.close()
})
