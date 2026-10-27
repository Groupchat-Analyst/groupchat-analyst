import assert from 'node:assert/strict'
import test from 'node:test'
import { isMatchReplayResponse } from './replayApi.ts'
import { teamMonogram } from './teamMonogram.ts'
import { DATASET_CATALOG } from '../../shared/src/datasetCatalog.ts'

const frame = (home, away) => ({
  selectedTime: '58′',
  score: { [home]: 1, [away]: 0 },
  events: [{ id: 'event-01', time: '10′', team: home, description: 'x', type: 'other' }],
})

test('replay validation defaults to the original teams', () => {
  assert.ok(isMatchReplayResponse(frame('Northbridge', 'Eastport'), '58′'))
  assert.ok(!isMatchReplayResponse(frame('Westhaven FC', 'Kingswell City'), '58′'))
})

test('replay validation accepts each catalog fixture only under its own team names', () => {
  for (const entry of DATASET_CATALOG) {
    const good = frame(entry.teams[0], entry.teams[1])
    assert.ok(isMatchReplayResponse(good, '58′', entry.teams), entry.id)
    assert.ok(!isMatchReplayResponse(frame('Northbridge', 'Eastport'), '58′', ['Other FC', 'Another FC']), entry.id)
  }
})

test('replay validation rejects a malformed score or an unknown event team', () => {
  const teams = ['Westhaven FC', 'Kingswell City']
  const bad = frame(...teams)
  bad.score['Kingswell City'] = -1
  assert.ok(!isMatchReplayResponse(bad, '58′', teams))
  const stray = frame(...teams)
  stray.events[0].team = 'Eastport'
  assert.ok(!isMatchReplayResponse(stray, '58′', teams))
})

test('monograms come from the displayed team name', () => {
  assert.equal(teamMonogram('Northbridge'), 'N')
  assert.equal(teamMonogram('Eastport'), 'E')
  assert.equal(teamMonogram('Westhaven FC'), 'WF')
  assert.equal(teamMonogram('Alderwick United'), 'AU')
})
