import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// Wyscout Events, figshare article 7770599, CC BY 4.0, match 2499799.
const rows = JSON.parse(readFileSync(
  new URL('../../shared/src/data/chelsea-watford-2499799.json', import.meta.url),
  'utf8',
))
const hasTag = (row, id) => row.tags.some((tag) => tag.id === id)

test('frozen Chelsea v Watford source: ten minutes before the 2-2 equaliser', () => {
  assert.equal(rows.length, 1693)
  const goals = rows.filter((row) => row.eventName === 'Shot' && hasTag(row, 101))
  const batshuayiGoals = goals.filter((row) => row.playerId === 38093)
  assert.deepEqual(batshuayiGoals.map((row) => row.id), [198369306, 198369664])
  const equaliser = batshuayiGoals[0]
  assert.equal(equaliser.matchPeriod, '2H')
  assert.equal(equaliser.eventSec, 1546.8602270000001)
  assert.equal(equaliser.teamId, 1610)
  const previousGoals = goals.filter((row) =>
    row.matchPeriod === '1H' || (row.matchPeriod === '2H' && row.eventSec < equaliser.eventSec))
  assert.deepEqual(previousGoals.map((row) => row.teamId), [1610, 1644, 1644])
  const start = equaliser.eventSec - 600
  assert.equal(start, 946.8602270000001)
  const window = rows.filter((row) =>
    row.matchPeriod === '2H' && row.eventSec >= start && row.eventSec < equaliser.eventSec)
  const shots = window.filter((row) => row.eventName === 'Shot')
  const corners = window.filter((row) => row.subEventName === 'Corner')
  assert.deepEqual(shots.map((row) => [row.id, row.teamId, row.playerId]), [
    [198369169, 1644, 70156],
    [198369222, 1644, 377071],
  ])
  for (const shot of shots) {
    assert.ok(hasTag(shot, 2101), `shot ${shot.id} must be blocked`)
    assert.ok(hasTag(shot, 1802), `shot ${shot.id} must be inaccurate`)
    assert.ok(!hasTag(shot, 101))
  }
  assert.deepEqual(corners.map((row) => [row.id, row.teamId]), [
    [198369163, 1644],
    [198369166, 1644],
    [198369226, 1644],
  ])
  assert.equal(shots.filter((row) => row.teamId === 1610).length, 0)
})
