import assert from 'node:assert/strict'
import { test } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import { analyzeOpinion } from '../../api/dist/api/src/service.js'
import { getReplayFrame } from '../../api/dist/api/src/functions/replay.js'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WESTHAVEN = 'westhaven-kingswell-demo'
const NORTHBRIDGE = 'northbridge-eastport-analysis-demo'

// The real app (Shell and MatchView) bundled once; each scenario mounts it in a fresh jsdom window.
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

function mountApp({ datasetId, language }) {
  const fetchCalls = []
  const writes = []
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: `http://localhost/#/match/${datasetId}`,
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

async function copied(app, button) {
  const before = app.writes.length
  button.click()
  await until(() => app.writes.length > before, 'clipboard write')
  return app.writes[app.writes.length - 1]
}

async function copyBoth(app) {
  const reply = app.document.querySelector('.share-row .copy-button')
  const card = reply.nextElementSibling
  return { reply: await copied(app, reply), card: await copied(app, card) }
}

const LANGUAGES = ['en', 'es', 'fr', 'de', 'ar']

// Literal expectations, written by hand per language; none of them come from the renderers.
const SCENARIOS = [
  {
    name: 'count assertion (no shots on target)',
    datasetId: WESTHAVEN,
    clock: '2-90-4',
    opinion: 'Kingswell City had no shots on target.',
    reply: {
      en: 'Claim as understood: Kingswell City had 0 shots on target. Recorded: 0 shots on target from 3 shots.',
      es: 'Afirmación tal como se entendió: Kingswell City tuvo 0 tiros a puerta. Registrado: 0 tiros a puerta de 3 tiros.',
      fr: 'Affirmation telle que comprise : Kingswell City a eu 0 tir cadré. Enregistré : 0 tir cadré sur 3 tirs.',
      de: 'Aussage, wie sie verstanden wurde: Kingswell City hatte 0 Schüsse aufs Tor. Erfasst: 0 Schüsse aufs Tor bei insgesamt 3 Schüssen.',
      ar: 'الادعاء كما فُهم: سجّل كينغزويل سيتي 0 تسديدة على المرمى. المسجّل: 0 تسديدة على المرمى من أصل 3 تسديدات.',
    },
    scope: {
      en: 'Match so far, up to 90+4′',
      es: 'El partido hasta ahora, hasta el 90+4′',
      fr: 'Match jusqu’ici, jusqu’à 90+4′',
      de: 'Spiel bisher, bis 90+4′',
      ar: 'المباراة حتى الآن، حتى 90+4′',
    },
    verdict: {
      en: 'Verdict: Supported',
      es: 'Veredicto: Respaldada',
      fr: 'Verdict : Confirmée',
      de: 'Urteil: Bestätigt',
      ar: 'التقييم: مؤيَّد',
    },
    limitation: {
      en: 'Limitation: Judged only on the recorded shot and goal outcomes for Kingswell City; chance quality is not recorded.',
      es: 'Limitación: Se juzga solo por los resultados registrados de tiros y goles de Kingswell City; la calidad de las ocasiones no se registra.',
      fr: 'Limite : Jugé uniquement sur les résultats enregistrés des tirs et des buts de Kingswell City ; la qualité des occasions n’est pas enregistrée.',
      de: 'Einschränkung: Beurteilt nur nach den erfassten Schuss- und Torergebnissen von Kingswell City; die Chancenqualität wird nicht erfasst.',
      ar: 'القيد: الحكم مبني فقط على نتائج التسديدات والأهداف المسجّلة لـكينغزويل سيتي؛ جودة الفرص غير مسجّلة.',
    },
  },
  {
    name: 'half-time goal at 45+3′',
    datasetId: NORTHBRIDGE,
    clock: '1-45-3',
    opinion: 'Northbridge scored before half-time.',
    reply: {
      en: 'Claim as understood: Northbridge scored before half-time. A first-half goal for Northbridge is recorded at 45+3′.',
      es: 'Afirmación tal como se entendió: Northbridge marcó antes del descanso. Consta un gol de Northbridge en la primera parte, en el 45+3′.',
      fr: 'Affirmation telle que comprise : Northbridge a marqué avant la mi-temps. Un but de Northbridge en première mi-temps est enregistré à 45+3′.',
      de: 'Aussage, wie sie verstanden wurde: Northbridge traf vor der Halbzeit. Ein Tor von Northbridge in der ersten Halbzeit ist bei 45+3′ erfasst.',
      ar: 'الادعاء كما فُهم: سجّل نورثبريدج قبل الاستراحة. سُجّل هدف لـنورثبريدج في الشوط الأول عند 45+3′.',
    },
    scope: {
      en: 'First-half goals, checked at 45+3′',
      es: 'Goles de la primera parte, comprobados en el 45+3′',
      fr: 'Buts de la première mi-temps, vérifiés à 45+3′',
      de: 'Tore der ersten Halbzeit, geprüft bei 45+3′',
      ar: 'أهداف الشوط الأول، فُحصت عند 45+3′',
    },
    verdict: {
      en: 'Verdict: Supported',
      es: 'Veredicto: Respaldada',
      fr: 'Verdict : Confirmée',
      de: 'Urteil: Bestätigt',
      ar: 'التقييم: مؤيَّد',
    },
    limitation: {
      en: 'Limitation: A recorded first-half goal for Northbridge supports the claim.',
      es: 'Limitación: Un gol registrado en la primera parte de Northbridge respalda la afirmación.',
      de: 'Einschränkung: Ein erfasstes Tor in der ersten Halbzeit von Northbridge stützt die Aussage.',
      ar: 'القيد: وجود هدف مسجّل في الشوط الأول لـنورثبريدج يؤيد الادعاء.',
    },
  },
  {
    name: 'unavailable metric (physical condition)',
    datasetId: NORTHBRIDGE,
    clock: '1-45-3',
    opinion: 'Northbridge are tired',
    reply: {
      en: 'Physical condition is not recorded in this match’s data, so there is no figure and no verdict.',
      es: 'El estado físico no se registra en los datos de este partido, así que no hay cifra ni veredicto.',
      fr: 'La condition physique : donnée non enregistrée dans ce match, donc ni chiffre ni verdict.',
      de: 'Die körperliche Verfassung wird in den Daten dieses Spiels nicht erfasst, daher gibt es weder eine Zahl noch ein Urteil.',
      ar: 'الحالة البدنية: لا توجد بيانات مسجّلة في هذه المباراة، لذلك لا يوجد رقم ولا حكم.',
    },
    scope: {
      en: 'Match so far, up to 45+3′',
      es: 'El partido hasta ahora, hasta el 45+3′',
      fr: 'Match jusqu’ici, jusqu’à 45+3′',
      de: 'Spiel bisher, bis 45+3′',
      ar: 'المباراة حتى الآن، حتى 45+3′',
    },
    verdict: {
      en: 'Verdict: Data not recorded',
      es: 'Veredicto: Datos no registrados',
      fr: 'Verdict : Données non enregistrées',
      de: 'Urteil: Daten nicht erfasst',
      ar: 'التقييم: بيانات غير مسجّلة',
    },
    limitation: {
      en: 'Limitation: Physical condition and fitness are not recorded, so no judgement is possible.',
      es: 'Limitación: El estado físico y la condición no se registran, así que no es posible ningún juicio.',
      fr: 'Limite : La condition physique n’est pas enregistrée ; aucun jugement n’est donc possible.',
      de: 'Einschränkung: Körperliche Verfassung und Fitness werden nicht erfasst, daher ist kein Urteil möglich.',
      ar: 'القيد: الحالة البدنية واللياقة غير مسجّلتين، لذلك لا يمكن إصدار حكم.',
    },
  },
  {
    name: 'player performance (selected player)',
    datasetId: NORTHBRIDGE,
    clock: '2-57-0',
    opinion: 'How did Saka perform?',
    reply: {
      en: 'Bukayo Saka: 1 goal, 2 shots on target, 1 of 2 passes completed, 1 recovery, 59 recorded minutes.',
      es: 'Bukayo Saka: 1 gol, 2 tiros a puerta, 1 de 2 pases completados, 1 recuperación, 59 minutos registrados.',
      fr: 'Bukayo Saka : 1 but, 2 tirs cadrés, 1 passes réussies sur 2, 1 récupération, 59 minutes enregistrées.',
      de: 'Bukayo Saka: 1 Tor, 2 Schüsse aufs Tor, 1 von 2 Pässen angekommen, 1 Ballgewinn, 59 erfasste Minuten.',
      ar: 'بوكايو ساكا: هدف، تسديدتان على المرمى، 1 من 2 تمريرة ناجحة، استخلاص، 59 دقيقة مسجّلة.',
    },
    scope: {
      en: 'Match so far, up to 57′',
      es: 'El partido hasta ahora, hasta el 57′',
      fr: 'Match jusqu’ici, jusqu’à 57′',
      de: 'Spiel bisher, bis 57′',
      ar: 'المباراة حتى الآن، حتى 57′',
    },
    verdict: {
      en: 'Verdict: Not enough evidence for a firm conclusion',
      es: 'Veredicto: No hay evidencia suficiente para una conclusión firme',
      fr: 'Verdict : Pas assez d’éléments pour une conclusion ferme',
      de: 'Urteil: Nicht genug Belege für ein sicheres Fazit',
      ar: 'التقييم: الأدلة لا تكفي لاستنتاج حاسم',
    },
    limitation: {
      en: 'Limitation: Bukayo Saka has few recorded actions, so these figures are thin evidence.',
      es: 'Limitación: Bukayo Saka tiene pocas acciones registradas, así que estas cifras son una evidencia escasa.',
      de: 'Einschränkung: Für Bukayo Saka sind nur wenige Aktionen erfasst, daher sind diese Zahlen ein dünner Beleg.',
      ar: 'القيد: إجراءات بوكايو ساكا المسجّلة قليلة، لذلك هذه الأرقام دليل ضعيف.',
    },
  },
]

const ORIGINAL_WORDING = {
  en: 'Original wording',
  es: 'Texto original',
  fr: 'Formulation originale',
  de: 'Ursprünglicher Wortlaut',
  ar: 'الصياغة الأصلية',
}

function assertInOrder(card, expected) {
  let from = 0
  for (const line of expected) {
    const found = card.indexOf(line, from)
    assert.ok(found >= 0, `missing or out of order: ${line}\n--- card ---\n${card}`)
    from = found + line.length
  }
}

for (const scenario of SCENARIOS) {
  for (const language of LANGUAGES) {
    test(`real App copy actions: ${scenario.name} in ${language}`, async () => {
      const app = mountApp({ datasetId: scenario.datasetId, language })
      try {
        await selectTime(app, scenario.clock)
        await ask(app, scenario.opinion)
        assert.equal(app.document.documentElement.lang, language)
        const { reply, card } = await copyBoth(app)
        assert.equal(reply, scenario.reply[language])
        assertInOrder(card, [
          ORIGINAL_WORDING[language],
          `“${scenario.opinion}”`,
          scenario.scope[language],
          scenario.reply[language],
          scenario.verdict[language],
          ...(scenario.limitation[language] ? [scenario.limitation[language]] : []),
        ])
        assert.ok(card.includes(`\n${ORIGINAL_WORDING[language]}\n`))
        if (language === 'ar') assert.match(reply, /[\u0600-\u06FF]/u)
        // The card text equals what the preview shows.
        const preview = [...app.document.querySelectorAll('.share-preview .share-block')].map((node) => node.textContent)
        assert.ok(preview.includes(scenario.scope[language]))
        assert.ok(preview.includes(scenario.verdict[language]))
      } finally {
        app.window.close()
      }
    })
  }
}

const HALF_TIME_FACT = {
  es: '• Northbridge: 1 gol',
  fr: '• Northbridge : 1 but',
  de: '• Northbridge: 1 Tor',
  ar: '• نورثبريدج: هدف',
}
const HALF_TIME_FACT_HEADING = {
  es: 'Datos clave',
  fr: 'Faits clés',
  de: 'Wichtige Fakten',
  ar: 'الحقائق الأساسية',
}

for (const language of ['es', 'fr', 'de', 'ar']) {
  test(`half-time card text has localized key facts and no English fact line in ${language}`, async () => {
    const app = mountApp({ datasetId: NORTHBRIDGE, language })
    try {
      await selectTime(app, '1-45-3')
      await ask(app, 'Northbridge scored before half-time.')
      const { card } = await copyBoth(app)
      assertInOrder(card, [HALF_TIME_FACT_HEADING[language], HALF_TIME_FACT[language]])
      assert.doesNotMatch(card, /\b1 goal\b/u)
      assert.doesNotMatch(card, /Selected recorded moments|Key facts|Verdict:|Limitation:/u)
      assert.doesNotMatch(card, /Synthetic data/u)
    } finally {
      app.window.close()
    }
  })
}

const ARABIC_POSSESSION_LIMITATION = 'قيد: يُحسب الاستحواذ من فترات سيطرة مقتطعة؛ ويُستثنى الوقت المتنازع عليه والكرة خارج الملعب.'

test('comparison limitation and card footer render in Arabic from typed facts', async () => {
  const app = mountApp({ datasetId: NORTHBRIDGE, language: 'ar' })
  try {
    await selectTime(app, '2-57-0')
    await ask(app, 'Northbridge had more possession than Eastport.')
    await selectTime(app, '2-58-0')
    const recheck = await until(() => app.document.querySelector('.check-again button'), 'check again')
    recheck.click()
    await until(() => app.document.querySelector('.what-changed .change-caveat'), 'comparison limitation')
    const caveats = [...app.document.querySelectorAll('.what-changed .change-caveat')].map((node) => node.textContent)
    assert.ok(caveats.includes(ARABIC_POSSESSION_LIMITATION), caveats.join('\n'))
    assert.ok(!caveats.some((text) => /Limitation|clipped|calculated/u.test(text)))
    const preview = [...app.document.querySelectorAll('.change-share .share-block')].map((node) => node.textContent)
    assert.ok(preview.includes(ARABIC_POSSESSION_LIMITATION), preview.join('\n'))
    const footer = preview.find((text) => text.startsWith('بيانات اصطناعية · مباراة خيالية'))
    assert.ok(footer, preview.join('\n'))
    assert.ok(footer.endsWith('تم تفسيره بالقواعد المحلية'), footer)
    assert.doesNotMatch(footer, /Synthetic|read by|Original match/u)
  } finally {
    app.window.close()
  }
})

const UNDERSTOOD = {
  es: 'Northbridge · goles · Goles de la primera parte, comprobados en el 45+3′',
  fr: 'Northbridge · buts · Buts de la première mi-temps, vérifiés à 45+3′',
  de: 'Northbridge · Tore · Tore der ersten Halbzeit, geprüft bei 45+3′',
  ar: 'نورثبريدج · أهداف · أهداف الشوط الأول، فُحصت عند 45+3′',
}

for (const language of ['es', 'fr', 'de', 'ar']) {
  test(`Checked against renders typed focus and scope in ${language}`, async () => {
    const app = mountApp({ datasetId: NORTHBRIDGE, language })
    try {
      await selectTime(app, '1-45-3')
      await ask(app, 'Northbridge scored before half-time.')
      const line = await until(
        () => [...app.document.querySelectorAll('.msg-note')].find((node) => node.querySelector('strong')),
        'checked against',
      )
      assert.ok(line.textContent.includes(UNDERSTOOD[language]), line.textContent)
    } finally {
      app.window.close()
    }
  })
}

const NETWORK_ERROR = {
  en: 'The analysis service could not be reached. You can try again or use local rules.',
  es: 'No se pudo conectar con el servicio de análisis. Puedes intentarlo de nuevo o usar las reglas locales.',
  fr: 'Le service d’analyse est injoignable. Vous pouvez réessayer ou utiliser les règles locales.',
  de: 'Der Analysedienst war nicht erreichbar. Du kannst es erneut versuchen oder lokale Regeln verwenden.',
  ar: 'تعذّر الوصول إلى خدمة التحليل. يمكنك المحاولة مرة أخرى أو استخدام القواعد المحلية.',
}

for (const language of LANGUAGES) {
  test(`request failure message is typed and localized in ${language}`, async () => {
    const app = mountApp({ datasetId: NORTHBRIDGE, language })
    try {
      await selectTime(app, '2-57-0')
      app.window.fetch = async () => { throw new app.window.TypeError('Failed to fetch') }
      const textarea = await until(() => app.document.getElementById('opinion-input'), 'opinion box')
      setValue(app.window, textarea, 'Northbridge had more possession than Eastport.')
      await sleep(20)
      app.document.querySelector('.check-button').click()
      const note = await until(() => app.document.querySelector('.msg-error .msg-note:last-of-type, .msg-error details .msg-note'), 'request error')
      assert.equal(note.textContent, NETWORK_ERROR[language])
    } finally {
      app.window.close()
    }
  })
}

test('switching language leaves a saved earlier answer and comparison figures unchanged and makes no requests', async () => {
  const app = mountApp({ datasetId: NORTHBRIDGE, language: 'en' })
  try {
    await selectTime(app, '2-57-0')
    await ask(app, 'Eastport had more shots on target than Northbridge.')
    await selectTime(app, '2-58-0')
    const recheck = await until(() => app.document.querySelector('.check-again button'), 'check again')
    recheck.click()
    await until(() => app.document.querySelector('.what-changed'), 'what changed')
    const earlier = () => app.document.querySelector('.earlier-answer')
    const figures = (node) => (node.textContent.match(/\d+/g) ?? []).join(',')
    const baseline = {
      earlierFigures: figures(earlier().querySelector('.server-summary')),
      earlierSummary: earlier().querySelector('summary').textContent,
      headlineFigures: figures(app.document.querySelector('.change-headline')),
    }
    assert.match(baseline.earlierSummary, /57′/u)
    assert.ok(baseline.earlierFigures.length > 0)
    const calls = app.fetchCalls.length
    for (const language of ['es', 'ar', 'de', 'fr', 'en']) {
      const selector = app.document.querySelector('.language-control select')
      setValue(app.window, selector, language)
      await until(() => app.document.documentElement.lang === language, `language ${language}`)
      await sleep(100)
      // Arabic spells small counts with dual forms (no digit), so the digit comparison applies elsewhere.
      if (language === 'ar') {
        assert.match(earlier().querySelector('.server-summary').textContent, /[\u0600-\u06FF]/u)
      } else {
        assert.equal(figures(earlier().querySelector('.server-summary')), baseline.earlierFigures, language)
        assert.equal(figures(app.document.querySelector('.change-headline')), baseline.headlineFigures, language)
      }
      assert.match(earlier().querySelector('summary').textContent, /57′/u, language)
      assert.doesNotMatch(earlier().querySelector('summary').textContent, /58′/u, language)
      assert.equal(app.fetchCalls.length, calls, `${language} made a request`)
    }
  } finally {
    app.window.close()
  }
})
