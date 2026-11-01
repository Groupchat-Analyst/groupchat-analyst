import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion, resolvePlayerSelection } from '../dist/api/src/service.js'
import { ANSWER_CODES } from '../dist/shared/src/claimPresentation.js'
import { DATASET_CATALOG } from '../dist/shared/src/datasetCatalog.js'

const B = 'northbridge-eastport-analysis-demo'
const RT = 'northbridge-eastport-return-demo'
const W = 'westhaven-kingswell-demo'
const R = 'redmere-alderwick-demo'
const FT = { period: 2, minute: 90, stoppageMinutes: 4 }

const run = async (opinion, datasetId, selectedClock, period = 'match-so-far') =>
  analyzeOpinion({ opinion, selectedClock, period, datasetId, inputLanguage: 'en' })
const first = async (...args) => (await run(...args)).claims[0]

test('count assertions carry verdict, form, subject and numbers', async () => {
  const none = (await first('Kingswell City had no shots on target.', W, FT)).presentation
  assert.deepEqual(
    { ...none.answer },
    { code: 'count-assertion', verdict: 'supported', form: 'none', subject: { kind: 'team', team: 'Kingswell City' }, metric: 'shots-on-target', recorded: 0, of: 3 },
  )
  assert.deepEqual(none.limitations.map((l) => l.code), ['count-judged-on-outcomes'])
  assert.deepEqual(none.scope, { kind: 'window', period: 'match-so-far', through: FT })

  const every = (await first('Every Alderwick United shot was on target', R, FT)).presentation.answer
  assert.equal(every.verdict, 'contradicted')
  assert.equal(every.form, 'every')
  assert.equal(every.recorded, 3)
  assert.equal(every.of, 5)
  const notEvery = (await first('Not every Alderwick United shot was on target', R, FT)).presentation.answer
  assert.equal(notEvery.form, 'not-every')
  assert.equal(notEvery.verdict, 'supported')

  const zero = (await first('Every Northbridge shot was on target', B, { period: 1, minute: 2 })).presentation
  assert.equal(zero.answer.verdict, 'unsettled')
  assert.equal(zero.answer.of, 0)
  assert.equal(zero.reason, 'no-attempts')
  assert.deepEqual(zero.limitations.map((l) => l.code), ['zero-attempts-universal'])

  const player = (await first('Abraham has scored', R, { period: 2, minute: 60 })).presentation.answer
  assert.equal(player.code, 'count-assertion')
  assert.deepEqual(player.subject, { kind: 'player', id: 'east-player-19', name: 'Tammy Abraham', team: 'Alderwick United' })
  assert.equal(player.metric, 'goals')
  assert.equal(player.recorded, 0)
})

test('anchored count assertion has a before-goal scope', async () => {
  const p = (await first('Eastport had no shots on target before the equaliser', B, { period: 2, minute: 58 })).presentation
  assert.equal(p.answer.verdict, 'contradicted')
  assert.equal(p.answer.recorded, 2)
  assert.equal(p.answer.of, 4)
  assert.deepEqual(p.scope, {
    kind: 'before-goal',
    anchorEventId: 'event-10',
    anchorTeam: 'Eastport',
    anchorClock: { period: 2, minute: 58 },
  })
})

test('half-time keeps period and stoppage semantics', async () => {
  const stop3 = { period: 1, minute: 45, stoppageMinutes: 3 }
  const stop2 = { period: 1, minute: 45, stoppageMinutes: 2 }
  const ok = (await first('Northbridge scored before half-time.', B, stop3)).presentation
  assert.equal(ok.answer.code, 'half-time')
  assert.equal(ok.answer.outcome, 'goal-recorded')
  assert.equal(ok.answer.verdict, 'supported')
  assert.deepEqual(ok.answer.goalClock, stop3)
  assert.equal(ok.scope.kind, 'first-half-goals')

  const early = (await first('Northbridge scored before half-time.', B, stop2)).presentation
  assert.equal(early.answer.outcome, 'not-yet-final')
  assert.equal(early.answer.verdict, 'unsettled')
  assert.equal(early.answer.goalClock, undefined)
  assert.deepEqual(early.answer.selectedClock, stop2)
  assert.equal(early.reason, 'not-yet-final')
  assert.deepEqual(early.limitations.map((l) => l.code), ['halftime-unsettled'])

  const later = (await first('Northbridge scored before half-time.', B, { period: 2, minute: 58 })).presentation
  assert.deepEqual(later.answer.goalClock, stop3)

  const none = (await first('Eastport did not score before half-time.', B, { period: 2, minute: 58 })).presentation
  assert.equal(none.answer.assertion, 'did-not-score')
  assert.equal(none.answer.outcome, 'no-goal-recorded')
  assert.equal(none.answer.verdict, 'supported')
  assert.deepEqual(none.limitations[0], {
    code: 'halftime-supported',
    recordedGoal: false,
    assertion: 'did-not-score',
    subject: { kind: 'team', team: 'Eastport' },
  })

  const contradicted = (await first('Northbridge did not score before half-time.', B, { period: 2, minute: 57 })).presentation
  assert.equal(contradicted.answer.verdict, 'contradicted')
  assert.equal(contradicted.limitations[0].code, 'halftime-contradicted')
})

test('historical run-of-play answer exposes possession and anchor', async () => {
  const p = (await first('Northbridge scored against the run of play', B, { period: 2, minute: 57 })).presentation
  assert.equal(p.answer.code, 'historical')
  assert.equal(p.answer.kind, 'run-of-play')
  assert.equal(p.answer.verdict, 'unsettled')
  assert.equal(p.answer.quote, 'Northbridge scored against the run of play')
  assert.deepEqual(p.answer.possession, { team: 'Northbridge', value: 55.6, opponent: 'Eastport', opponentValue: 44.4, minutes: 45 })
  assert.deepEqual(p.limitations.map((l) => l.code), ['territory-or-chance-quality-absent'])
  assert.deepEqual(p.scope.anchorClock, { period: 1, minute: 45, stoppageMinutes: 3 })
  assert.equal(p.scope.anchorEventId, 'event-07')
})

test('possession dominance', async () => {
  const p = (await first('Northbridge dominated possession', B, { period: 2, minute: 57 })).presentation
  assert.deepEqual(p.answer, { code: 'possession-dominance', aspect: 'supports', team: 'Northbridge', value: 55.4, opponent: 'Eastport', opponentValue: 44.6 })
  assert.equal(p.limitations[0].code, 'possession-share-limit')
})

test('topics keep zero attempts distinct from a null rate', async () => {
  const saka = (await first('Saka’s passing has been poor', RT, { period: 2, minute: 70 })).presentation.answer
  assert.equal(saka.code, 'topic')
  assert.equal(saka.topic, 'passing-quality')
  assert.equal(saka.subject.id, 'north-player-09')
  assert.deepEqual(saka.facts, { kind: 'passing', attempts: 5, completions: 5, ratePercent: 100 })

  const haaland = (await first('Haaland’s passing has been poor', W, FT)).presentation
  assert.deepEqual(haaland.answer.facts, { kind: 'passing', attempts: 0, completions: 0, ratePercent: null })
  assert.deepEqual(haaland.limitations.map((l) => l.code), ['topic', 'player-sparse'])

  const sloppy = (await first('Northbridge are sloppy on the ball', B, FT)).presentation.answer
  assert.equal(sloppy.topic, 'possession-losses')
  assert.deepEqual(sloppy.facts.areas, [
    { area: 'defensive-third', count: 3 },
    { area: 'middle-third', count: 3 },
    { area: 'final-third', count: 2 },
  ])

  const bus = (await first('Northbridge parked the bus', B, { period: 2, minute: 57 })).presentation
  assert.equal(bus.answer.code, 'subjective-unsettled')
  assert.equal(bus.answer.quote, 'Northbridge parked the bus')
  assert.deepEqual(bus.limitations.map((l) => l.code), ['unavailable-evidence', 'missing-data-prevents-conclusion'])
})

test('player-broad participation states', async () => {
  const p = (await first('Abraham has been poor', R, { period: 2, minute: 60 })).presentation
  assert.equal(p.answer.code, 'player-broad')
  assert.equal(p.answer.participation, 'not-yet-on-pitch')
  assert.equal(p.reason, 'player-not-yet-on-pitch')
  assert.equal(p.answer.player.id, 'east-player-19')
})

test('unavailable metrics', async () => {
  const dist = (await first('Northbridge covered more distance than Eastport', B, { period: 2, minute: 57 })).presentation
  assert.equal(dist.answer.code, 'unavailable-metric')
  assert.equal(dist.reason, 'metric-not-recorded')
  const loc = (await first('How many shots did Northbridge have inside the box?', B, { period: 2, minute: 57 })).presentation
  assert.equal(loc.answer.metric, 'shot-location')
  assert.deepEqual(loc.answer.evidenceKinds, ['shot-location'])
  const tired = (await first('Northbridge are tired', B, { period: 2, minute: 57 })).presentation
  assert.equal(tired.answer.metric, 'physical-condition')
  assert.deepEqual(tired.limitations.map((l) => l.code), ['physical-condition'])
  const phase = (await first('Compare Northbridge and Eastport build-up pass completion', B, { period: 2, minute: 57 })).presentation
  assert.equal(phase.answer.metric, 'build-up-pass-scope')
  assert.equal(phase.reason, 'phase-scope-unavailable')
})

test('coaching answers distinguish build-up sample from all passes', async () => {
  const clock = { period: 2, minute: 58 }
  const sample = (await first('Where is Northbridge losing possession during build-up?', B, clock)).presentation
  assert.equal(sample.answer.code, 'coaching')
  assert.equal(sample.answer.phase, 'build-up-sample')
  assert.equal(sample.answer.total, 3)
  assert.deepEqual(sample.answer.teams[0].areas.map((a) => a.count), [1, 2, 0])
  assert.equal(sample.limitations[0].code, 'coaching-build-up-sample')
  const all = (await first('Where are we losing possession?', B, clock)).presentation
  assert.equal(all.answer.phase, 'all-passes')
  assert.equal(all.answer.total, 11)
  assert.equal(all.answer.teams.length, 2)
  assert.equal(all.limitations[0].code, 'coaching-all-passes')
})

test('statistics, comparison and resolution use structured-elsewhere', async () => {
  const clock = { period: 2, minute: 57 }
  const stats = (await first('Compare Northbridge and Eastport pass completion', B, clock)).presentation.answer
  assert.deepEqual(stats, { code: 'structured-elsewhere', family: 'statistics' })
  const player = (await first('How many passes did Rice complete?', B, clock)).presentation.answer
  assert.equal(player.family, 'player-performance')
  const comparison = (await first('Eastport had more shots on target than Northbridge.', B, clock)).presentation.answer
  assert.equal(comparison.family, 'factual-comparison')
  const ambiguous = await first('How many passes did Bruno complete?', B, { period: 2, minute: 58 })
  assert.equal(ambiguous.presentation.answer.family, 'resolution')
  assert.equal(ambiguous.presentation.reason, 'player-choice')
  const prediction = (await first('Eastport will win this', B, clock)).presentation
  assert.equal(prediction.answer.family, 'resolution')
  assert.deepEqual(prediction.limitations.map((l) => l.code), ['prediction'])
  assert.equal(prediction.reason, 'prediction')
})

test('foreign-team override and player selection carry fresh presentations', async () => {
  const foreign = await run('Northbridge had more shots than Redmere', W, FT)
  for (const claim of foreign.claims) {
    assert.equal(claim.presentation.answer.code, 'unrecognized')
    assert.equal(claim.presentation.answer.reason, 'foreign-team')
    assert.equal(claim.presentation.reason, 'foreign-team')
  }

  const ambiguous = await run('How many passes did Bruno complete?', B, { period: 2, minute: 58 })
  const claim = ambiguous.claims[0]
  assert.ok(ambiguous.playerResolutionContinuation ?? claim.playerResolution?.continuation)
  const continuation = ambiguous.playerResolutionContinuation ?? claim.playerResolution.continuation
  const choice = claim.playerResolution?.candidates?.[0] ?? claim.resolution?.candidates?.[0]
  if (choice) {
    const resolved = await resolvePlayerSelection({
      action: 'resolve-player',
      continuation,
      claimId: claim.claim.id,
      playerId: choice.id,
    })
    for (const c of resolved.claims) {
      assert.ok(ANSWER_CODES.includes(c.presentation.answer.code))
      assert.notEqual(c.presentation.answer.code, 'clarification')
    }
  }
})

test('descriptors are independent of English fields and contain no free prose', async () => {
  const response = await run('Northbridge scored before half-time.', B, { period: 2, minute: 58 })
  const claim = response.claims[0]
  const before = JSON.stringify(claim.presentation)
  const mutated = { ...claim, reply: 'x', limitation: 'x', answer: 'x', fanReply: 'x' }
  assert.equal(JSON.stringify(mutated.presentation), before)

  const allowedFree = new Set(['quote', 'name', 'foreignTeams', 'team', 'opponent', 'anchorTeam', 'id', 'anchorEventId', 'subject'])
  const walk = (value, key) => {
    if (typeof value === 'string') {
      assert.ok(!/\s/.test(value) || allowedFree.has(key) || key === undefined, `unexpected prose in ${key}: ${value}`)
    } else if (Array.isArray(value)) value.forEach((v) => walk(v, key))
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => walk(v, k))
  }
  for (const [opinion, id, clock] of [
    ['Northbridge parked the bus', B, { period: 2, minute: 57 }],
    ['Kingswell City had no shots on target.', W, FT],
    ['Where are we losing possession?', B, { period: 2, minute: 58 }],
  ]) {
    for (const c of (await run(opinion, id, clock)).claims) walk(c.presentation, undefined)
  }
})

test('every claim across all catalog examples and clocks has a known presentation', async () => {
  const clocks = [
    { period: 1, minute: 20 },
    { period: 1, minute: 45, stoppageMinutes: 3 },
    { period: 2, minute: 57 },
    FT,
  ]
  const opinions = new Set()
  for (const dataset of DATASET_CATALOG) for (const e of dataset.examples) opinions.add(e.text)
  opinions.add('Northbridge had more shots than Redmere')
  opinions.add('Northbridge scored before half-time.')
  opinions.add('Eastport will win this')
  let count = 0
  for (const dataset of DATASET_CATALOG) {
    for (const opinion of opinions) {
      for (const clock of clocks) {
        for (const period of ['match-so-far', 'last-10-minutes']) {
          const response = await run(opinion, dataset.id, clock, period)
          for (const claim of response.claims) {
            count += 1
            const p = claim.presentation
            assert.ok(p, `${dataset.id} ${opinion}`)
            assert.equal(p.version, 1)
            assert.ok(ANSWER_CODES.includes(p.answer.code), p.answer.code)
            assert.ok(Array.isArray(p.limitations))
            assert.ok(['window', 'before-goal', 'first-half-goals'].includes(p.scope.kind))
          }
        }
      }
    }
  }
  assert.ok(count > 100)
})
