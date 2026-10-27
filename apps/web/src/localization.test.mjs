import assert from 'node:assert/strict'
import test from 'node:test'
import {
  APP_LANGUAGES,
  canonicalizeSupportedFootballOpinion,
  localizedExample,
  translateNarrative,
} from '../../shared/src/localization.ts'
import { createBlocksImage } from './shareCardImage.ts'

const acceptance = [
  {
    language: 'es',
    guided: 'Eastport tuvo más tiros a puerta que Northbridge.',
    negated: 'Eastport no tuvo más tiros a puerta que Northbridge.',
    zero: 'Kingswell City no tuvo ningún tiro a puerta.',
    bruno: '¿Cuántos pases completó Bruno?',
    saka: 'Saka ha tenido un partido horrible.',
    distance: 'Northbridge recorrió más distancia que Eastport',
  },
  {
    language: 'fr',
    guided: 'Eastport a eu plus de tirs cadrés que Northbridge.',
    negated: 'Eastport n’a pas eu plus de tirs cadrés que Northbridge.',
    zero: 'Kingswell City n’a cadré aucun tir.',
    bruno: 'Combien de passes Bruno a-t-il réussies ?',
    saka: 'Saka a fait un match horrible.',
    distance: 'Northbridge a parcouru plus de distance qu’Eastport',
  },
  {
    language: 'de',
    guided: 'Eastport hatte mehr Schüsse aufs Tor als Northbridge.',
    negated: 'Eastport hatte nicht mehr Schüsse aufs Tor als Northbridge.',
    zero: 'Kingswell City hatte keinen Schuss aufs Tor.',
    bruno: 'Wie viele Pässe hat Bruno vervollständigt?',
    saka: 'Saka hat ein schreckliches Spiel gemacht.',
    distance: 'Northbridge legte mehr Strecke zurück als Eastport',
  },
  {
    language: 'ar',
    guided: 'Eastport كان لديه تسديدات أكثر على المرمى من Northbridge.',
    negated: 'لم يكن لدى Eastport تسديدات على المرمى أكثر من Northbridge.',
    zero: 'لم يكن لدى Kingswell City أي تسديدة على المرمى.',
    bruno: 'كم تمريرة أكمل برونو؟',
    saka: 'قدم ساكا مباراة سيئة للغاية.',
    distance: 'قطع Northbridge مسافة أكبر من Eastport',
  },
]

test('all five locales have explicit label, native name, and direction metadata', () => {
  assert.deepEqual(APP_LANGUAGES.map(({ code }) => code), ['en', 'es', 'fr', 'de', 'ar'])
  assert.equal(APP_LANGUAGES.find(({ code }) => code === 'ar').direction, 'rtl')
  assert.equal(APP_LANGUAGES.find(({ code }) => code === 'es').nativeLabel, 'Español')
})

test('the homepage guided opinion is localized in the selected language', () => {
  for (const item of acceptance) {
    assert.equal(
      translateNarrative('Eastport had more shots on target than Northbridge.', item.language),
      item.guided,
    )
  }
})

for (const item of acceptance) {
  test(`${item.language}: supported opinion templates normalize without changing claims`, () => {
    for (const [key, canonical] of [
      ['guided', 'Eastport had more shots on target than Northbridge.'],
      ['negated', 'Eastport did not have more shots on target than Northbridge.'],
      ['zero', 'Kingswell City had no shots on target.'],
      ['bruno', 'How many passes did Bruno complete?'],
      ['saka', 'Saka has had a horrible game.'],
      ['distance', 'Northbridge covered more distance than Eastport.'],
    ]) {
      assert.equal(canonicalizeSupportedFootballOpinion(item[key]), canonical, key)
      const exampleText = key === 'distance' ? canonical.replace(/\.$/u, '') : canonical
      assert.equal(localizedExample(exampleText, item.language), item[key], `example wording for ${key}`)
    }
  })
}

test('answer translations preserve figures, clock boundaries, qualification, and identity', () => {
  const phrase = 'Bukayo Saka had 2 shots on target, completed 5 of 5 passes, was on the pitch for 62 elapsed minutes in the selected recorded window 1′–60′ (on-pitch interval 1′–60′; added time included, half-time excluded). Recorded passes, shots, goals, recoveries and selected pressure observations do not add up to a performance rating, and no benchmark for “good” or “bad” is recorded. For a specific count, ask “How many passes did Bukayo Saka complete?” or “How many shots did Bukayo Saka have?”'
  for (const language of ['es', 'fr', 'de', 'ar']) {
    const translated = translateNarrative(phrase, language)
    assert.match(translated, /62/u)
    assert.match(translated, /1′–60′/u)
    assert.match(translated, /Bukayo Saka/u)
    assert.match(translated, /benchmark|criterio|critère|Maßstab|معيار/u)
    assert.doesNotMatch(translated, /63 elapsed/u)
  }
})

test('clarification and failed-check messages are localized without changing player identities', () => {
  const expected = {
    es: {
      clarification: '¿A qué Bruno te refieres: Bruno Fernandes (Eastport) o Bruno Guimarães (Northbridge)?',
      error: 'La comprobación no terminó. Inténtalo de nuevo.',
    },
    fr: {
      clarification: 'De quel Bruno parlez-vous : Bruno Fernandes (Eastport) ou Bruno Guimarães (Northbridge) ?',
      error: 'La vérification n’a pas abouti. Veuillez réessayer.',
    },
    de: {
      clarification: 'Welchen Bruno meinst du: Bruno Fernandes (Eastport) oder Bruno Guimarães (Northbridge)?',
      error: 'Die Prüfung wurde nicht abgeschlossen. Bitte versuche es erneut.',
    },
    ar: {
      clarification: 'أي برونو تقصد: Bruno Fernandes (Eastport) أم Bruno Guimarães (Northbridge)؟',
      error: 'لم يكتمل التحقق. يُرجى المحاولة مرة أخرى.',
    },
  }
  const clarification = 'Which Bruno do you mean: Bruno Fernandes (Eastport) or Bruno Guimarães (Northbridge)?'
  const error = 'That check didn’t finish. Please try again.'
  for (const [language, phrases] of Object.entries(expected)) {
    assert.equal(translateNarrative(clarification, language), phrases.clarification)
    assert.equal(translateNarrative(error, language), phrases.error)
  }
})

test('analyst presentation localizes dynamic result labels and attributed metrics', () => {
  const expected = {
    es: ['contradicha', '2 tiros a puerta', 'Tú ·', 'Cómo se comprobó'],
    fr: ['contredite', '2 tirs cadrés', 'Vous ·', 'Comment cela a été vérifié'],
    de: ['widerlegt', '2 Schüsse aufs Tor', 'Du ·', 'So wurde dies geprüft'],
    ar: ['مناقض', '2 تسديدات على المرمى', 'أنت ·', 'كيف تم التحقق من ذلك'],
  }
  const eventDescriptions = {
    es: 'El portero atrapa un cabezazo tras un centro.',
    fr: 'La tête sur un centre est captée par le gardien.',
    de: 'Ein Kopfball nach einer Flanke wird vom Torwart gehalten.',
    ar: 'يمسك الحارس رأسية من عرضية.',
  }
  const starterLabels = {
    es: 'David Raya · titular',
    fr: 'David Raya · titulaire',
    de: 'David Raya · Startelf',
    ar: 'David Raya · أساسي',
  }
  const substituteLabels = {
    es: 'suplente',
    fr: 'remplaçant',
    de: 'Ersatzspieler',
    ar: 'بديل',
  }
  const yesNoLabels = {
    es: ['Sí', 'No'],
    fr: ['Oui', 'Non'],
    de: ['Ja', 'Nein'],
    ar: ['نعم', 'لا'],
  }
  for (const [language, phrases] of Object.entries(expected)) {
    assert.equal(translateNarrative('contradicted', language), phrases[0])
    assert.equal(translateNarrative('2 shots on target', language), phrases[1])
    assert.equal(translateNarrative('You ·', language), phrases[2])
    assert.equal(translateNarrative('How this was checked', language), phrases[3])
    assert.match(translateNarrative('Limitations: This is a comparison of recorded events in the synthetic fixture, not a claim about chance quality or overall performance.', language), /sintétic|synthétique|fictif|fiktiv|خيالية/u)
    assert.match(translateNarrative('2 shots on target', language), /2/u)
    assert.doesNotMatch(translateNarrative('2 shots on target', language), /shots on target/u)
    const event = translateNarrative('Low shot from the edge of the box, saved by the goalkeeper. Shooter: Bukayo Saka.', language)
    assert.match(event, /Bukayo Saka/u)
    assert.doesNotMatch(event, /Low shot|Shooter:/u)
    assert.match(translateNarrative('Northbridge · challenging', language), /Northbridge/u)
    assert.doesNotMatch(translateNarrative('Northbridge · challenging', language), /challenging/u)
    assert.doesNotMatch(translateNarrative('All 4 claim evidence references', language), /claim evidence references/u)
    assert.doesNotMatch(translateNarrative('The synthetic fixture records shots on target events.', language), /synthetic fixture|shots on target/u)
    assert.doesNotMatch(translateNarrative('Each record below is labelled as supporting, challenging, contextual, calculation evidence, or a historical anchor.', language), /Each record|supporting|challenging/u)

    const marker = translateNarrative('45+3′ · Northbridge goal', language)
    assert.match(marker, /45\+3′/u)
    assert.doesNotMatch(marker, /Northbridge goal/u)

    const prefixedEvent = translateNarrative(
      '31′ · Eastport: Header from a cross is held by the goalkeeper. Shooter: Benjamin Šeško.',
      language,
    )
    assert.ok(prefixedEvent.includes(eventDescriptions[language]), prefixedEvent)
    assert.match(prefixedEvent, /31′.*Eastport.*Benjamin Šeško/u)
    assert.doesNotMatch(prefixedEvent, /Header from a cross|Shooter:/u)
    const eventImage = createBlocksImage([{ kind: 'bullet', text: prefixedEvent }], language)
    const imageText = eventImage.svg.replace(/<[^>]*>/gu, ' ').replace(/\s+/gu, ' ')
    assert.ok(imageText.includes(eventDescriptions[language]), imageText)
    assert.doesNotMatch(eventImage.svg, /Header from a cross|Shooter:/u)

    const eventCount = translateNarrative('10 recorded', language)
    assert.doesNotMatch(eventCount, /recorded/u)
    assert.match(eventCount, /10/u)
    assert.doesNotMatch(translateNarrative(' recorded', language), /recorded/u)
    assert.equal(translateNarrative('David Raya · starter', language), starterLabels[language])
    assert.equal(translateNarrative('substitute', language), substituteLabels[language])
    assert.equal(translateNarrative('Yes', language), yesNoLabels[language][0])
    assert.equal(translateNarrative('No', language), yesNoLabels[language][1])
  }
})

test('comparison narrative and receipt localization preserve assessments, figures, events, and scope', () => {
  const expected = {
    es: ['Cambió:', 'Tiros a puerta:', 'Eastport', 'Matheus Cunha', 'Respuesta anterior', 'Eastport empata'],
    fr: ['Cela a changé', 'Tirs cadrés:', 'Eastport', 'Matheus Cunha', 'Réponse précédente', 'Eastport égalise'],
    de: ['Das hat sich geändert', 'Schüsse aufs Tor:', 'Eastport', 'Matheus Cunha', 'Vorherige Antwort', 'Eastport gleicht'],
    ar: ['تغيّر الأمر', 'تسديدات على المرمى:', 'Eastport', 'Matheus Cunha', 'الإجابة السابقة', 'عادل Eastport'],
  }
  const changed = "That's changed: at 57′ it didn't hold up; at 58′ it holds up."
  const figures = 'Shots on target: Northbridge 2, Eastport 2 → 3.'
  const recorded = 'New in the records: 58′ · Eastport level the score with a shot from the area. Shooter: Matheus Cunha'
  const previous = 'Earlier answer · 57′ · Match so far'
  const caveat = "The listed moments match the change in the count. That's a tally, not a reason: the records can't say why it happened."

  for (const [language, phrases] of Object.entries(expected)) {
    const translatedChange = translateNarrative(changed, language)
    const translatedFigures = translateNarrative(figures, language)
    const translatedEvent = translateNarrative(recorded, language)
    const translatedPrevious = translateNarrative(previous, language)
    const translatedCaveat = translateNarrative(caveat, language)
    const translatedWindow = translateNarrative('57′ (Match so far through 57′): Contradicted', language)
    const decisiveLabel = translateNarrative('Decisive figures', language)
    const recordedLabel = translateNarrative('New recorded moments', language)
    const translatedNote = translateNarrative(`Note: ${caveat}`, language)
    const translatedQuotedChange = translateNarrative(`“Eastport had more shots on target than Northbridge.” — ${changed}`, language)
    assert.ok(translatedChange.startsWith(phrases[0]), translatedChange)
    assert.ok(translatedFigures.startsWith(phrases[1]), translatedFigures)
    assert.match(translatedFigures, /Northbridge 2/u)
    assert.match(translatedFigures, /Eastport 2 → 3/u)
    assert.ok(translatedEvent.includes(phrases[2]), translatedEvent)
    assert.ok(translatedEvent.includes(phrases[3]), translatedEvent)
    assert.ok(translatedEvent.includes(phrases[5]), translatedEvent)
    assert.match(translatedEvent, /58′/u)
    assert.ok(translatedPrevious.startsWith(phrases[4]), translatedPrevious)
    assert.match(translatedPrevious, /57′/u)
    assert.doesNotMatch(
      [translatedChange, translatedFigures, translatedEvent, translatedPrevious, translatedCaveat].join(' '),
      /That's changed|Shots on target|New in the records|Shooter:|Earlier answer|The listed moments match|Eastport level the score|Match so far|Contradicted/u,
    )
    assert.doesNotMatch([decisiveLabel, recordedLabel, translatedNote].join(' '), /Decisive figures|New recorded moments|Note:|The listed moments match/u)
    assert.doesNotMatch(translatedQuotedChange, /That's changed|shots on target/u)
    const image = createBlocksImage([
      { kind: 'answer', text: translatedChange },
      { kind: 'bullet', text: translatedWindow },
      { kind: 'bullet', text: translatedFigures },
      { kind: 'label', text: decisiveLabel },
      { kind: 'label', text: recordedLabel },
      { kind: 'bullet', text: translatedEvent },
      { kind: 'note', text: translatedNote },
    ], language)
    assert.doesNotMatch(image.svg, /That's changed|Shots on target|New in the records|Shooter:|Eastport level the score|Match so far|Contradicted|Decisive figures|New recorded moments|Note:|The listed moments match/iu)
    assert.match(image.svg, /Northbridge 2/u)
    assert.match(image.svg, /Eastport 2/u)
    assert.match(image.svg, /→/u)
  }
  assert.equal(translateNarrative(changed, 'en'), changed)
})

test('conversation draft, stale-answer, and recheck guidance localize without changing scope', () => {
  const expected = {
    es: ['La respuesta más reciente', 'no se ha recalculado', 'Volver a comprobar en 58′', 'opinión guardada', 'Comprobar este minuto'],
    fr: ['La dernière réponse', 'n’a pas été recalculée', 'Vérifier de nouveau à 58′', 'avis enregistré', 'Vérifier cette minute'],
    de: ['Die letzte Antwort', 'wurde nicht neu berechnet', 'Erneut prüfen bei 58′', 'gespeicherte Meinung', 'Diesen Moment prüfen'],
    ar: ['الإجابة الأخيرة', 'لم يُعَد حساب', 'أعِد التحقق عند 58′', 'الرأي المحفوظ', 'تحقق من هذه اللحظة'],
  }
  const stale = 'The latest reply is for 58′ · Match so far. The replay is now at 57′; that answer has not been recalculated.'
  const draft = 'The latest reply is for the saved opinion above, not the wording now in the box. “Check this moment” submits the edited wording instead.'
  const recheck = 'Check again at 58′'
  const savedScope = 'Same wording, same match-so-far option — this checks the saved opinion, not your edit.'
  for (const [language, phrases] of Object.entries(expected)) {
    const translatedStale = translateNarrative(stale, language)
    const translatedDraft = translateNarrative(draft, language)
    const translatedScope = translateNarrative(savedScope, language)
    assert.ok(translatedStale.startsWith(phrases[0]), translatedStale)
    assert.ok(translatedStale.includes(phrases[1]), translatedStale)
    assert.match(translatedStale, /58′.*57′/u)
    assert.ok(translatedDraft.includes(phrases[4]), translatedDraft)
    assert.ok(translatedScope.includes(phrases[3]), translatedScope)
    assert.match(translateNarrative(recheck, language), new RegExp(phrases[2].replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'))
    assert.doesNotMatch(
      [translatedStale, translatedDraft, translatedScope, translateNarrative(recheck, language)].join(' '),
      /The latest reply|saved opinion|Check this moment|Same wording|Check again|Match so far|not been recalculated/u,
    )
  }
})

test('fixture identity and provider disclosures translate without changing names or responsibilities', () => {
  const disclosure = 'Westhaven FC and Kingswell City are fictional teams using real-player names. Every performance and result is invented.'
  const translations = {
    es: 'Westhaven FC y Kingswell City',
    fr: 'Westhaven FC et Kingswell City',
    de: 'Westhaven FC und Kingswell City',
    ar: 'Westhaven FC وKingswell City',
  }
  for (const [language, identity] of Object.entries(translations)) {
    const translated = translateNarrative(disclosure, language)
    assert.ok(translated.startsWith(identity), translated)
    assert.match(translateNarrative('Foundry · server-side interpretation', language), /Foundry/u)
    assert.match(translateNarrative('Microsoft Foundry structured-output model. Statistics are still calculated by the application, not by AI.', language), /Microsoft Foundry/u)
    assert.match(translateNarrative('2 elapsed minutes', language), /2/u)
  }
})

test('Arabic receipt SVG sets RTL and isolates Latin names, times and figures', () => {
  const original = 'Eastport tuvo más tiros a puerta que Northbridge.'
  const image = createBlocksImage([
    { kind: 'brand', text: 'Groupchat Analyst' },
    { kind: 'take', text: `“${original}”` },
    { kind: 'scope', text: 'حتى 58′ من المباراة' },
    { kind: 'answer', text: 'نعم — لدى Eastport وNorthbridge العدد نفسه: 2 تسديدات على المرمى.' },
    { kind: 'bullet', text: '57′ (حتى 57′ من المباراة): مخالف للأدلة' },
    { kind: 'bullet', text: '31′ · Eastport: يمسك الحارس رأسية من عرضية. مسدد الكرة: Benjamin Šeško.' },
    { kind: 'footer', text: 'مباراة خيالية · Foundry' },
  ], 'ar')
  assert.match(image.svg, /direction="rtl" lang="ar"/u)
  assert.match(image.svg, /unicode-bidi="plaintext" text-anchor="start"/u)
  assert.match(image.svg, /text-anchor="end"/u)
  const takeLine = image.svg.split('\n').find((line) => line.includes('Eastport') && line.includes('tuvo'))
  const timedEventLine = image.svg.split('\n').find((line) => line.includes('Eastport') && line.includes('يمسك'))
  assert.match(takeLine, /text-anchor="start"/u)
  assert.match(timedEventLine, /text-anchor="end"/u)
  assert.match(image.svg, /<tspan direction="ltr" unicode-bidi="isolate">Eastport/u)
  assert.match(image.svg, /<tspan direction="ltr" unicode-bidi="isolate">58′/u)
  assert.match(image.svg, /Eastport tuvo m/u)
  assert.match(image.svg, /Northbridge/u)
  assert.doesNotMatch(image.svg, /Northbridge.*slots?/iu)
})

test('LTR receipt SVG keeps left alignment and escapes user text', () => {
  const image = createBlocksImage([
    { kind: 'take', text: '<original & unchanged>' },
  ], 'es')
  assert.match(image.svg, /direction="ltr" lang="es"/u)
  assert.match(image.svg, /&lt;original &amp; unchanged&gt;/u)
  assert.doesNotMatch(image.svg, /text-anchor="end"/u)
})
