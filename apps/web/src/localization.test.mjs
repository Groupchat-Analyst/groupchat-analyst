import assert from 'node:assert/strict'
import test from 'node:test'
import {
  APP_LANGUAGES,
  canonicalizeSupportedFootballOpinion,
  localizedExample,
  translateNarrative,
} from '../../shared/src/localization.ts'
import { DATASET_CATALOG } from '../../shared/src/datasetCatalog.ts'
import {
  canonicalizeArabicMatchAliases,
  localizeMatchText,
  localizedPlayerName,
  localizedTeamMonogram,
} from '../../shared/src/displayNames.ts'
import { SYNTHETIC_MATCH_EVIDENCE } from '../../shared/src/evidence.ts'
import { SYNTHETIC_MATCH_EVENTS } from '../../shared/src/match.ts'
import { REDMERE_MATCH_EVIDENCE, REDMERE_MATCH_EVENTS } from '../../shared/src/redmereAlderwick.ts'
import { RETURN_MATCH_EVIDENCE, RETURN_MATCH_EVENTS } from '../../shared/src/returnMatch.ts'
import { WESTHAVEN_MATCH_EVIDENCE, WESTHAVEN_MATCH_EVENTS } from '../../shared/src/westhavenKingswell.ts'
import { formatMatchClock } from '../../shared/src/matchClock.ts'
import { blocksToText, describeEvidence } from './presentation.ts'
import { createBlocksImage } from './shareCardImage.ts'

const fixtureRecords = [
  { id: 'northbridge-eastport-analysis-demo', events: SYNTHETIC_MATCH_EVENTS, evidence: SYNTHETIC_MATCH_EVIDENCE },
  { id: 'northbridge-eastport-return-demo', events: RETURN_MATCH_EVENTS, evidence: RETURN_MATCH_EVIDENCE },
  { id: 'westhaven-kingswell-demo', events: WESTHAVEN_MATCH_EVENTS, evidence: WESTHAVEN_MATCH_EVIDENCE },
  { id: 'redmere-alderwick-demo', events: REDMERE_MATCH_EVENTS, evidence: REDMERE_MATCH_EVIDENCE },
].map((fixture) => ({
  ...fixture,
  displayTeams: DATASET_CATALOG.find(({ id }) => id === fixture.id).teams,
}))

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
    guided: 'سجل إيستبورت تسديدات أكثر على المرمى من نورثبريدج.',
    negated: 'لم يسجل إيستبورت تسديدات على المرمى أكثر من نورثبريدج.',
    zero: 'لم يسجل كينغزويل سيتي أي تسديدة على المرمى.',
    bruno: 'كم تمريرة أكمل برونو؟',
    saka: 'قدم ساكا مباراة سيئة للغاية.',
    distance: 'قطع نورثبريدج مسافة أكبر من إيستبورت',
  },
]

test('all five locales have explicit label, native name, and direction metadata', () => {
  assert.deepEqual(APP_LANGUAGES.map(({ code }) => code), ['en', 'es', 'fr', 'de', 'ar'])
  assert.equal(APP_LANGUAGES.find(({ code }) => code === 'ar').direction, 'rtl')
  assert.equal(APP_LANGUAGES.find(({ code }) => code === 'es').nativeLabel, 'Español')
})

test('Arabic display names cover every canonical team and player identity in all fixtures', () => {
  for (const fixture of fixtureRecords) {
    const roster = fixture.evidence.players
    assert.equal(roster.length, 40, fixture.id)
    for (const player of roster) {
      const localized = localizedPlayerName(fixture.id, player.id, player.name, 'ar')
      assert.notEqual(localized, player.name, `${fixture.id}/${player.id}`)
      assert.match(localized, /\p{Script=Arabic}/u, `${fixture.id}/${player.id}`)
      assert.doesNotMatch(localized, /[A-Za-z]/u, `${fixture.id}/${player.id}`)
      assert.equal(localizeMatchText(player.name, fixture.id, 'ar'), localized)
      assert.equal(
        canonicalizeArabicMatchAliases(`How many passes did ${localized} complete?`, fixture.id),
        `How many passes did ${player.name} complete?`,
        `${fixture.id}/${player.id} input alias`,
      )
    }

    const [home, away] = fixture.displayTeams
    const teams = localizeMatchText(`${home} v ${away}`, fixture.id, 'ar')
    assert.equal(teams, localizeMatchText(`${home} ضد ${away}`, fixture.id, 'ar'))
    assert.match(teams, /ضد/u)
    assert.match(teams, /\p{Script=Arabic}/u)
    assert.doesNotMatch(teams, /[A-Za-z]/u, fixture.id)
    assert.match(localizedTeamMonogram(fixture.id, home, 'ar'), /\p{Script=Arabic}/u)
    assert.match(localizedTeamMonogram(fixture.id, away, 'ar'), /\p{Script=Arabic}/u)
  }
})

test('Arabic name aliases preserve shared-name ambiguity and canonical full-name resolution', () => {
  assert.equal(
    canonicalizeArabicMatchAliases('كم تمريرة أكمل برونو؟', fixtureRecords[0].id),
    'كم تمريرة أكمل Bruno؟',
  )
  assert.equal(
    canonicalizeArabicMatchAliases('How many passes did مارتن complete?', fixtureRecords[1].id),
    'How many passes did Martin complete?',
  )
  assert.equal(
    canonicalizeArabicMatchAliases('كم تمريرة أكمل برونو فيرنانديز؟', fixtureRecords[0].id),
    'كم تمريرة أكمل Bruno Fernandes؟',
  )
  assert.equal(
    canonicalizeArabicMatchAliases('How many shots did وستهافن have?', fixtureRecords[2].id),
    'How many shots did Westhaven FC have?',
  )
  assert.equal(
    canonicalizeArabicMatchAliases('How many shots did كينغزويل سيتي have?', fixtureRecords[2].id),
    'How many shots did Kingswell City have?',
  )
  assert.equal(
    canonicalizeArabicMatchAliases('How many passes did Bruno complete?', fixtureRecords[0].id),
    'How many passes did Bruno complete?',
  )
  assert.equal(
    canonicalizeArabicMatchAliases('How many passes did بيدرو complete?', fixtureRecords[2].id),
    'How many passes did Pedro complete?',
  )
})

test('Arabic metadata, metric explanation, and period translations retain identity and figures', () => {
  const baselineId = fixtureRecords[0].id
  assert.equal(translateNarrative('statistics provided', 'ar'), 'إحصاءات فقط، بلا حكم')
  assert.equal(translateNarrative('Match so far through 58′', 'ar'), 'من بداية المباراة حتى 58′')
  assert.equal(translateNarrative('Last 10 minutes ending 90+4′', 'ar'), 'آخر عشر دقائق حتى 90+4′')
  assert.equal(
    translateNarrative('15 more recorded moments are in the full record.', 'ar'),
    'يوجد 15 لحظة إضافية في السجل الكامل.',
  )
  assert.equal(translateNarrative('Moving to 57′…', 'ar'), 'جارٍ الانتقال إلى 57′…')
  assert.equal(translateNarrative('Loading the match…', 'ar'), 'جارٍ تحميل المباراة…')
  assert.equal(translateNarrative('GOAL', 'ar'), 'هدف')
  assert.equal(translateNarrative('Bruno Fernandes: 18 passes completed.', 'ar'), 'Bruno Fernandes: 18 تمريرة مكتملة.')
  assert.equal(translateNarrative('18 pass completions', 'ar'), '18 تمريرة مكتملة')
  assert.equal(translateNarrative('Bruno Fernandes: 2 passes completed.', 'ar'), 'Bruno Fernandes: 2 تمريرتان مكتملتان.')
  assert.equal(translateNarrative('Bruno Fernandes: 8 passes completed.', 'ar'), 'Bruno Fernandes: 8 تمريرات مكتملة.')
  assert.equal(translateNarrative('18 recorded recoveries', 'ar'), '18 استعادة مسجلة')
  assert.equal(
    translateNarrative('62 elapsed participation minutes (recorded window; added time included)', 'ar'),
    '62 دقيقة مشاركة منقضية (ضمن النافذة المسجلة؛ تشمل الوقت بدل الضائع)',
  )
  assert.equal(
    localizeMatchText(
      translateNarrative('Bruno Fernandes · passes completed · Match so far through 57′', 'ar'),
      baselineId,
      'ar',
    ),
    'برونو فرنانديز · تمريرات مكتملة · من بداية المباراة حتى 57′',
  )
  assert.equal(
    localizeMatchText(
      translateNarrative('Northbridge vs Eastport · shots on target · Match so far through 57′', 'ar'),
      baselineId,
      'ar',
    ),
    'نورثبريدج ضد إيستبورت · تسديدات على المرمى · من بداية المباراة حتى 57′',
  )
  assert.equal(
    translateNarrative('Ambiguous name: asks which Pedro', 'ar'),
    'اسم ملتبس: يُطلب تحديد بيدرو المقصود.',
  )
  const teamSentence = localizeMatchText(
    translateNarrative('No — Eastport and Northbridge are level on 2 shots on target each.', 'ar'),
    baselineId,
    'ar',
  )
  assert.match(teamSentence, /إيستبورت/u)
  assert.match(teamSentence, /نورثبريدج/u)
  assert.doesNotMatch(teamSentence, /Eastport|Northbridge/u)
  assert.equal(
    localizeMatchText(translateNarrative('Original match v3.0.0', 'ar'), baselineId, 'ar'),
    'المباراة الأصلية v3.0.0',
  )
  const explanation = localizeMatchText(
    translateNarrative(
      'Report pass completions for Bruno Fernandes from selected synthetic records.',
      'ar',
    ),
    fixtureRecords[1].id,
    'ar',
  )
  assert.match(explanation, /برونو فرنانديز/u)
  assert.match(explanation, /التمريرات المكتملة/u)
  assert.doesNotMatch(explanation, /undefined|Report|pass completions/u)
  assert.equal(
    translateNarrative('Checked against', 'ar'),
    'تم التحقق مقابل',
  )
})

test('all fixture examples render in Arabic with transliterated team and player names', () => {
  for (const fixture of fixtureRecords) {
    for (const example of DATASET_CATALOG.find(({ id }) => id === fixture.id).examples) {
      const localized = localizeMatchText(localizedExample(example.text, 'ar'), fixture.id, 'ar')
      const description = localizeMatchText(translateNarrative(example.shows, 'ar'), fixture.id, 'ar')
      assert.match(localized, /\p{Script=Arabic}/u, `${fixture.id}/${example.id}`)
      assert.doesNotMatch(localized, /[A-Za-z]/u, `${fixture.id}/${example.id}`)
      assert.match(description, /\p{Script=Arabic}/u, `${fixture.id}/${example.id} metadata`)
      assert.doesNotMatch(description, /[A-Za-z]/u, `${fixture.id}/${example.id} metadata`)
    }
  }
})

test('expanded source records identify preserved English wording in the selected language', () => {
  const expected = {
    es: ['Registro técnico · identificadores y texto original de origen (inglés)', 'Redacción original de origen (inglés):'],
    fr: ['Données techniques · identifiants et texte source original (anglais)', 'Texte source original (anglais) :'],
    de: ['Technischer Datensatz · IDs und ursprünglicher Quelltext (Englisch)', 'Ursprünglicher Quelltext (Englisch):'],
    ar: ['السجل التقني · المعرّفات والنص الأصلي المصدر (بالإنجليزية)', 'النص الأصلي المصدر (بالإنجليزية):'],
  }
  for (const [language, [summary, sourceLabel]] of Object.entries(expected)) {
    assert.equal(translateNarrative('Technical record · IDs and original source wording (English)', language), summary)
    assert.equal(translateNarrative('Original source wording (English):', language), sourceLabel)
    assert.notEqual(
      translateNarrative('The descriptions above are localized. The records below retain original English source wording.', language),
      'The descriptions above are localized. The records below retain original English source wording.',
    )
  }
})

test('pass and turnover evidence-coverage details are localized', () => {
  const details = {
    es: ['El partido sintético contiene eventos de pases registrados.', 'El partido sintético contiene eventos de pérdidas de posesión registradas.'],
    fr: ['Le match fictif contient des passes enregistrées.', 'Le match fictif contient des pertes de balle enregistrées.'],
    de: ['Das fiktive Spiel enthält erfasste Passereignisse.', 'Das fiktive Spiel enthält erfasste Ballverluste.'],
    ar: ['تتضمن المباراة الخيالية أحداث تمرير مسجلة.', 'تتضمن المباراة الخيالية أحداث فقدان استحواذ مسجلة.'],
  }
  for (const [language, expected] of Object.entries(details)) {
    assert.deepEqual(
      [
        translateNarrative('The synthetic fixture records passing events.', language),
        translateNarrative('The synthetic fixture records possession losses events.', language),
      ],
      expected,
    )
  }
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
    const normalizeInput = (opinion, key) =>
      item.language === 'ar'
        ? canonicalizeArabicMatchAliases(
            opinion,
            key === 'zero' ? fixtureRecords[2].id : fixtureRecords[0].id,
          )
        : opinion
    for (const [key, canonical] of [
      ['guided', 'Eastport had more shots on target than Northbridge.'],
      ['negated', 'Eastport did not have more shots on target than Northbridge.'],
      ['zero', 'Kingswell City had no shots on target.'],
      ['bruno', 'How many passes did Bruno complete?'],
      ['saka', 'Saka has had a horrible game.'],
      ['distance', 'Northbridge covered more distance than Eastport.'],
    ]) {
      assert.equal(
        canonicalizeSupportedFootballOpinion(normalizeInput(item[key], key)),
        canonical,
        key,
      )
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
    ar: ['مناقض', '2 تسديدتان على المرمى', 'أنت ·', 'كيف تم التحقق من ذلك'],
  }
  const playerStatisticsLabels = {
    es: 'Estadísticas del jugador',
    fr: 'Statistiques du joueur',
    de: 'Spielerstatistiken',
    ar: 'إحصاءات اللاعب',
  }
  const readyLabels = {
    es: 'Respuesta lista',
    fr: 'Réponse prête',
    de: 'Antwort bereit',
    ar: 'الإجابة جاهزة',
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
    assert.equal(translateNarrative('Player statistics', language), playerStatisticsLabels[language])
    assert.equal(translateNarrative('Answer ready', language), readyLabels[language])
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

test('fixture event details localize from structured records in every non-English presentation surface', () => {
  const wording = {
    es: { complete: /completado/u, incomplete: /incompleto/u, pressure: /parcial/u, turnover: /Pérdida registrada/u },
    fr: { complete: /réussie/u, incomplete: /incomplète/u, pressure: /partielle/u, turnover: /Perte de balle enregistrée/u },
    de: { complete: /angekommen/u, incomplete: /unvollständig/u, pressure: /teilweise/u, turnover: /Erfasster Ballverlust/u },
    ar: { complete: /مكتملة/u, incomplete: /غير مكتملة/u, pressure: /جزئية/u, turnover: /فقدان مسجل/u },
  }

  for (const fixture of fixtureRecords) {
    const roster = fixture.evidence.players
    const playerName = (id) => roster.find(({ id: playerId }) => playerId === id)?.name
    const teamFor = (slot) => fixture.displayTeams[slot === 'Northbridge' ? 0 : 1]

    for (const event of fixture.events) {
      const shooter = event.playerId ? playerName(event.playerId) : null
      const raw = `${event.description}${shooter ? ` Shooter: ${shooter} (${event.playerId}).` : ''}`
      const described = describeEvidence(raw, roster)
      assert.doesNotMatch(described, /\b(?:north|east)-player-\d+\b/u)

      for (const language of Object.keys(wording)) {
        const eventLine = `${formatMatchClock(event.clock)} · ${teamFor(event.team)}: ${described}`
        const localized = translateNarrative(eventLine, language)
        assert.notEqual(localized, eventLine, `${fixture.id} ${event.id} ${language}`)
        assert.ok(localized.includes(formatMatchClock(event.clock)), localized)
        assert.ok(localized.includes(teamFor(event.team)), localized)
        if (shooter) assert.ok(localized.includes(shooter), localized)
        assert.doesNotMatch(localized, /Shooter:/u)
      }
    }

    for (const outcome of ['complete', 'incomplete']) {
      const pass = fixture.evidence.passes.find(({ outcome: result }) => result === outcome)
      const verb = outcome === 'complete' ? 'Completed' : 'Incomplete'
      const rawVariants = [
        { description: `${verb} pass by ${pass.playerId} intended for ${pass.receiverId}.`, linked: false },
        { description: `${verb} pass by ${pass.playerId}, intended for ${pass.receiverId}.`, linked: false },
        {
          description: `Linked ${outcome} pass by ${pass.playerId} intended for ${pass.receiverId}, from (${pass.start.x}, ${pass.start.y}) to (${pass.end.x}, ${pass.end.y}).`,
          linked: true,
        },
      ]
      const passer = playerName(pass.playerId)
      const receiver = playerName(pass.receiverId)

      for (const variant of rawVariants) {
        const described = describeEvidence(variant.description, roster)
        for (const language of Object.keys(wording)) {
          const line = `${formatMatchClock(pass.clock)} · ${teamFor(pass.team)}: ${described}`
          const localized = translateNarrative(line, language)
          assert.match(localized, wording[language][outcome], `${fixture.id} ${outcome} ${language}`)
          assert.ok(localized.includes(passer) && localized.includes(receiver), localized)
          assert.ok(localized.includes(formatMatchClock(pass.clock)), localized)
          assert.ok(localized.includes(teamFor(pass.team)), localized)
          assert.doesNotMatch(localized, /intended for|pass by/u)
          if (variant.linked) {
            assert.match(localized, /vinculado|liée|Verknüpfter|المرتبطة/u)
          }

          const comparisonEvent = translateNarrative(`New in the records: ${line}`, language)
          assert.ok(comparisonEvent.includes(formatMatchClock(pass.clock)), comparisonEvent)
          assert.ok(comparisonEvent.includes(passer) && comparisonEvent.includes(receiver), comparisonEvent)
          assert.doesNotMatch(comparisonEvent, /intended for|pass by/u)

          const copied = blocksToText([{ kind: 'bullet', text: localized }])
          assert.equal(copied, `• ${localized}`)
          const image = createBlocksImage([{ kind: 'bullet', text: localized }], language)
          const imageText = image.svg.replace(/<[^>]*>/gu, '').replace(/\s+/gu, ' ')
          assert.ok(imageText.includes(passer) && imageText.includes(receiver), imageText)
          assert.match(image.svg, wording[language][outcome])
        }
      }
    }

    const turnover = fixture.evidence.turnovers[0]
    const area = turnover.location.x < 33.3
      ? 'defensive-third'
      : turnover.location.x < 66.7 ? 'middle-third' : 'final-third'
    const turnoverRawVariants = [
      `Recorded incomplete-pass turnover by ${turnover.playerId} in the ${area} at (${turnover.location.x}, ${turnover.location.y}); linked pass ${turnover.lostPassId}.`,
      `Recorded annotated build-up incomplete-pass turnover by ${turnover.playerId} in the ${area} at (${turnover.location.x}, ${turnover.location.y}); linked pass ${turnover.lostPassId}.`,
    ]
    const turnoverPlayer = playerName(turnover.playerId)

    for (const [index, raw] of turnoverRawVariants.entries()) {
      const description = describeEvidence(raw, roster)
      for (const language of Object.keys(wording)) {
        const localized = translateNarrative(description, language)
        assert.match(localized, wording[language].turnover, `${fixture.id} turnover ${language}`)
        assert.ok(localized.includes(turnoverPlayer), localized)
        assert.doesNotMatch(localized, /defensive-third|middle-third|final-third|linked pass|turnover by/u)
        if (index === 1) {
          assert.match(localized, /muestra anotada de salida|échantillon annoté de relance|annotierten Aufbau-Stichprobe|عينة البناء المعلّمة/u)
        }
      }
    }

    const pressure = fixture.evidence.pressures[0]
    const pressureType = pressure.type.replaceAll('-', ' ')
    const pressureRawVariants = [
      `Selected ${pressureType} observation by ${pressure.playerId}; pressure coverage is partial.`,
      `Selected ${pressureType} observation by ${pressure.playerId}; pressure coverage is partial (context only).`,
    ]
    const pressurePlayer = playerName(pressure.playerId)

    for (const [index, raw] of pressureRawVariants.entries()) {
      const description = describeEvidence(raw, roster)
      for (const language of Object.keys(wording)) {
        const localized = translateNarrative(description, language)
        assert.match(localized, wording[language].pressure, `${fixture.id} pressure ${language}`)
        assert.ok(localized.includes(pressurePlayer), localized)
        assert.doesNotMatch(localized, /Selected|observation by|pressure coverage/u)
        if (index === 1) {
          assert.match(localized, /solo contexto|contexte uniquement|nur Kontext|للسياق فقط/u)
        }
      }
    }
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

test('resolved Bruno answer and pass-coverage limitation stay localized in receipts', () => {
  const opinion = 'كم تمريرة أكمل برونو؟'
  const answer = 'Bruno Guimarães: 0 pass completions.'
  const limitation = 'Limitation: Descriptive statistics are provided from recorded synthetic passes. Pass-completion percentage is not available when no attempts are recorded; zero attempts is distinct from attempted passes with no completions.'
  const localized = {
    en: {
      answer,
      limitation,
    },
    es: {
      answer: 'Bruno Guimarães: 0 pases completados.',
      limitation: 'Limitación: Se ofrecen estadísticas descriptivas a partir de los pases sintéticos registrados. El porcentaje de pases completados no está disponible si no se registraron intentos; cero intentos es distinto de intentos registrados sin pases completados.',
    },
    fr: {
      answer: 'Bruno Guimarães: 0 passes réussies.',
      limitation: 'Limite : Les statistiques descriptives proviennent des passes synthétiques enregistrées. Le pourcentage de passes réussies n’est pas disponible si aucune tentative n’est enregistrée ; zéro tentative est différent de tentatives enregistrées sans passe réussie.',
    },
    de: {
      answer: 'Bruno Guimarães: 0 vollständige Pässe.',
      limitation: 'Einschränkung: Beschreibende Statistiken beruhen auf erfassten synthetischen Pässen. Ein Passerfolgsprozentsatz ist nicht verfügbar, wenn keine Versuche erfasst wurden; null Versuche unterscheiden sich von erfassten Versuchen ohne erfolgreichen Pass.',
    },
    ar: {
      answer: 'Bruno Guimarães: 0 تمريرات مكتملة.',
      limitation: 'القيد: تُعرض إحصاءات وصفية استناداً إلى تمريرات اصطناعية مسجلة. لا تتوفر نسبة التمريرات المكتملة عند عدم تسجيل أي محاولات؛ فعدم وجود محاولات يختلف عن تسجيل محاولات لم تسفر عن تمريرات مكتملة.',
    },
  }
  for (const { code } of APP_LANGUAGES) {
    const translatedAnswer = translateNarrative(answer, code)
    const translatedLimitation = translateNarrative(limitation, code)
    assert.equal(translatedAnswer, localized[code].answer)
    assert.equal(translatedLimitation, localized[code].limitation)
    const image = createBlocksImage([
      { kind: 'take', text: `“${opinion}”` },
      { kind: 'scope', text: 'حتى 57′ من المباراة' },
      { kind: 'answer', text: translatedAnswer },
      { kind: 'note', text: translatedLimitation },
    ], code)
    const imageText = image.svg
      .replace(/<\/text>/gu, ' ')
      .replace(/<[^>]*>/gu, '')
      .replace(/&amp;/gu, '&')
      .replace(/&lt;/gu, '<')
      .replace(/&gt;/gu, '>')
      .replace(/\s+/gu, ' ')
      .replace(/\s+([:;,.])/gu, '$1')
    assert.ok(imageText.includes(opinion))
    assert.ok(
      imageText.includes(translatedAnswer.replace(/\s+([:;,.])/gu, '$1')),
      `${code}: ${imageText}`,
    )
    assert.ok(
      imageText.includes(translatedLimitation.replace(/\s+([:;,.])/gu, '$1')),
      `${code}: ${imageText}`,
    )
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
