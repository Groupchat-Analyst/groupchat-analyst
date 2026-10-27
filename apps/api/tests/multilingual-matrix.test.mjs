import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import {
  BASELINE_DATASET_ID,
  RETURN_DATASET_ID_PUBLIC,
  WESTHAVEN_DATASET_ID_PUBLIC,
} from '../dist/shared/src/datasetCatalog.js'
import { elapsedMatchMinute } from '../dist/shared/src/matchClock.js'

const guidedClock = (minute) => ({ period: 2, minute })
const FULL_TIME = { period: 2, minute: 90, stoppageMinutes: 4 }
const languages = [
  {
    name: 'English',
    guided: 'Eastport had more shots on target than Northbridge.',
    negated: 'Eastport did not have more shots on target than Northbridge.',
    zero: 'Kingswell City had no shots on target.',
    bruno: 'How many passes did Bruno complete?',
    saka: 'Saka has had a horrible game.',
    distance: 'Northbridge covered more distance than Eastport',
  },
  {
    name: 'Español',
    guided: 'Eastport tuvo más tiros a puerta que Northbridge.',
    negated: 'Eastport no tuvo más tiros a puerta que Northbridge.',
    zero: 'Kingswell City no tuvo ningún tiro a puerta.',
    bruno: '¿Cuántos pases completó Bruno?',
    saka: 'Saka ha tenido un partido horrible.',
    distance: 'Northbridge recorrió más distancia que Eastport',
  },
  {
    name: 'Français',
    guided: 'Eastport a eu plus de tirs cadrés que Northbridge.',
    negated: 'Eastport n’a pas eu plus de tirs cadrés que Northbridge.',
    zero: 'Kingswell City n’a cadré aucun tir.',
    bruno: 'Combien de passes Bruno a-t-il réussies ?',
    saka: 'Saka a fait un match horrible.',
    distance: 'Northbridge a parcouru plus de distance qu’Eastport',
  },
  {
    name: 'Deutsch',
    guided: 'Eastport hatte mehr Schüsse aufs Tor als Northbridge.',
    negated: 'Eastport hatte nicht mehr Schüsse aufs Tor als Northbridge.',
    zero: 'Kingswell City hatte keinen Schuss aufs Tor.',
    bruno: 'Wie viele Pässe hat Bruno vervollständigt?',
    saka: 'Saka hat ein schreckliches Spiel gemacht.',
    distance: 'Northbridge legte mehr Strecke zurück als Eastport',
  },
  {
    name: 'العربية',
    guided: 'Eastport كان لديه تسديدات أكثر على المرمى من Northbridge.',
    negated: 'لم يكن لدى Eastport تسديدات على المرمى أكثر من Northbridge.',
    zero: 'لم يكن لدى Kingswell City أي تسديدة على المرمى.',
    bruno: 'كم تمريرة أكمل برونو؟',
    saka: 'قدم ساكا مباراة سيئة للغاية.',
    distance: 'قطع Northbridge مسافة أكبر من Eastport',
  },
]

async function ask(opinion, datasetId, selectedClock) {
  return analyzeOpinion({
    opinion,
    datasetId,
    selectedClock,
    period: 'match-so-far',
  })
}

for (const language of languages) {
  test(`${language.name}: 57′ → 58′ guided comparison preserves meaning and evidence`, async () => {
    const before = await ask(language.guided, BASELINE_DATASET_ID, guidedClock(57))
    const after = await ask(language.guided, BASELINE_DATASET_ID, guidedClock(58))
    for (const [result, expected, eastport] of [
      [before, 'contradicted', 2],
      [after, 'supported', 3],
    ]) {
      const claim = result.claims[0]
      assert.equal(result.provider, 'local')
      assert.equal(result.evidenceFoundation.dataset.id, BASELINE_DATASET_ID)
      assert.equal(claim.claim.intent, 'factual-claim')
      assert.equal(claim.claim.meaning.category, 'factual-comparison')
      assert.equal(claim.claim.meaning.comparison.metric, 'shots-on-target')
      assert.equal(claim.assessment, expected)
      assert.deepEqual(
        Object.fromEntries(claim.statistics.map(({ team, value }) => [team, value])),
        { Eastport: eastport, Northbridge: 2 },
      )
      assert.ok(claim.evidence.length >= 2)
      assert.match(result.fanReply, /Eastport/u)
      assert.match(result.fanReply, /Northbridge/u)
    }
    assert.equal(before.selectedTime, '57′')
    assert.equal(after.selectedTime, '58′')
  })

  test(`${language.name}: Bruno clarification retains metric without guessing identity`, async () => {
    const result = await ask(language.bruno, BASELINE_DATASET_ID, guidedClock(58))
    const claim = result.claims[0]
    assert.equal(result.provider, 'local')
    assert.equal(claim.claim.intent, 'statistical-request')
    assert.equal(claim.claim.playerSubject, null)
    assert.equal(claim.claim.playerMetric, 'pass-completions')
    assert.equal(claim.assessment, 'clarification needed')
    assert.deepEqual(claim.statistics, [])
    assert.deepEqual(claim.playerStatistics, [])
    assert.deepEqual(claim.evidence, [])
    assert.match(result.fanReply, /Bruno Fernandes/u)
    assert.match(result.fanReply, /Bruno Guimarães/u)
  })

  test(`${language.name}: negated comparison retains polarity and exact figures`, async () => {
    const result = await ask(language.negated, BASELINE_DATASET_ID, guidedClock(57))
    const claim = result.claims[0]
    assert.equal(claim.claim.intent, 'factual-claim')
    assert.equal(claim.claim.meaning.comparison.metric, 'shots-on-target')
    assert.equal(claim.assessment, 'supported')
    assert.deepEqual(
      Object.fromEntries(claim.statistics.map(({ team, value }) => [team, value])),
      { Eastport: 2, Northbridge: 2 },
    )
    assert.ok(claim.evidence.length >= 2)
  })

  test(`${language.name}: zero-count claim distinguishes recorded zero from unavailable`, async () => {
    const result = await ask(language.zero, WESTHAVEN_DATASET_ID_PUBLIC, FULL_TIME)
    const claim = result.claims[0]
    assert.equal(result.provider, 'local')
    assert.equal(result.evidenceFoundation.dataset.id, WESTHAVEN_DATASET_ID_PUBLIC)
    assert.equal(claim.claim.intent, 'factual-claim')
    assert.equal(claim.assessment, 'supported')
    assert.deepEqual(claim.statistics.map(({ value }) => value), [0])
    assert.ok(claim.evidence.length > 0)
    assert.match(result.fanReply, /no recorded shots on target.*0 of 3 recorded shots/iu)
  })

  test(`${language.name}: evidence-limited Saka judgement remains qualified at the selected time`, async () => {
    const result = await ask(language.saka, RETURN_DATASET_ID_PUBLIC, guidedClock(60))
    const claim = result.claims[0]
    assert.equal(result.provider, 'local')
    assert.equal(result.evidenceFoundation.dataset.id, RETURN_DATASET_ID_PUBLIC)
    assert.equal(claim.claim.intent, 'subjective-judgement')
    assert.equal(claim.claim.playerSubject.name, 'Bukayo Saka')
    assert.equal(claim.assessment, 'insufficient evidence for a firm conclusion')
    assert.ok(claim.playerStatistics.length > 0)
    assert.ok(claim.evidence.length > 0)
    assert.match(result.fanReply, /performance rating|no benchmark|overall game/iu)
    const selectedElapsed = elapsedMatchMinute(guidedClock(60))
    for (const { reference } of claim.evidence) {
      const [minuteText, addedText] = reference.time.replace('′', '').split('+')
      const minute = Number(minuteText)
      const clock = minute <= 45
        ? { period: 1, minute, stoppageMinutes: Number(addedText ?? 0) }
        : { period: 2, minute, stoppageMinutes: Number(addedText ?? 0) }
      assert.ok(elapsedMatchMinute(clock) <= selectedElapsed, `${reference.id} at ${reference.time} is not future evidence`)
    }
  })

  test(`${language.name}: unavailable physical metric is explicitly unavailable`, async () => {
    const result = await ask(language.distance, BASELINE_DATASET_ID, guidedClock(57))
    const claim = result.claims[0]
    assert.equal(result.provider, 'local')
    assert.equal(claim.claim.intent, 'unavailable-metric')
    assert.equal(claim.assessment, 'unavailable data')
    assert.deepEqual(claim.evidence, [])
    assert.match(result.fanReply, /Running distance.*not recorded/u)
  })
}
