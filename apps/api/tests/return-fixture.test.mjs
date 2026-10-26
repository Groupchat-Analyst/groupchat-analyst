import assert from 'node:assert/strict'
import test from 'node:test'
import { RETURN_MATCH_EVENTS, RETURN_MATCH_EVIDENCE, RETURN_DATASET_ID } from '../dist/shared/src/returnMatch.js'
import { validateFixtureIntegrity } from '../dist/shared/src/fixtureIntegrity.js'
import { SYNTHETIC_MATCH_EVIDENCE } from '../dist/shared/src/evidence.js'
import { SYNTHETIC_MATCH_EVENTS } from '../dist/shared/src/match.js'
import { elapsedMatchMinute } from '../dist/shared/src/matchClock.js'

const clone = (value) => structuredClone(value)

test('return fixture has its own dataset identity and passes integrity validation', () => {
  assert.equal(RETURN_MATCH_EVIDENCE.dataset.id, RETURN_DATASET_ID)
  assert.notEqual(RETURN_MATCH_EVIDENCE.dataset.id, SYNTHETIC_MATCH_EVIDENCE.dataset.id)
  assert.deepEqual(validateFixtureIntegrity(RETURN_MATCH_EVENTS, RETURN_MATCH_EVIDENCE), [])
})

test('baseline fixture also passes the same integrity validation', () => {
  assert.deepEqual(validateFixtureIntegrity(SYNTHETIC_MATCH_EVENTS, SYNTHETIC_MATCH_EVIDENCE), [])
})

test('return fixture contains counterexamples: possession majority differs from shot majority', () => {
  const held = (team, from = 0) =>
    RETURN_MATCH_EVIDENCE.possessions
      .filter((p) => p.team === team)
      .reduce((sum, p) => sum + Math.max(0, elapsedMatchMinute(p.end) - Math.max(elapsedMatchMinute(p.start), from)), 0)
  const shots = (team) => RETURN_MATCH_EVENTS.filter((e) => e.team === team).length
  assert.ok(held('Eastport') > held('Northbridge'))
  assert.ok(shots('Northbridge') > shots('Eastport'))
  assert.ok(held('Northbridge', 80) > held('Eastport', 80), 'final ten minutes differ from cumulative')
  const goals = RETURN_MATCH_EVENTS.filter((e) => e.outcome === 'goal')
  assert.deepEqual(goals.map((g) => g.team), ['Eastport', 'Northbridge', 'Northbridge'])
  assert.ok(RETURN_MATCH_EVENTS.some((e) => e.clock.stoppageMinutes && e.clock.period === 1))
  assert.ok(RETURN_MATCH_EVENTS.some((e) => e.clock.stoppageMinutes && e.clock.period === 2))
})

test('integrity validation rejects broken references and chronology', () => {
  const badShooter = clone(RETURN_MATCH_EVENTS)
  badShooter[0].playerId = 'east-player-12'
  assert.ok(validateFixtureIntegrity(badShooter, RETURN_MATCH_EVIDENCE).some((m) => /shooter/.test(m)))

  const unordered = clone(RETURN_MATCH_EVENTS).reverse()
  assert.ok(validateFixtureIntegrity(unordered, RETURN_MATCH_EVIDENCE).some((m) => /chronological/.test(m)))

  const overlap = clone(RETURN_MATCH_EVIDENCE)
  overlap.possessions[1].start = overlap.possessions[0].start
  assert.ok(validateFixtureIntegrity(RETURN_MATCH_EVENTS, overlap).some((m) => /overlap/.test(m)))

  const wrongPass = clone(RETURN_MATCH_EVIDENCE)
  wrongPass.passes[0].receiverId = wrongPass.passes[0].playerId
  assert.ok(validateFixtureIntegrity(RETURN_MATCH_EVENTS, wrongPass).some((m) => /same passer/.test(m)))
})
