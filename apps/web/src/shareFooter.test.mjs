import assert from 'node:assert/strict'
import test from 'node:test'
import { buildShareCardModel, shareCardBlocks, sourceFooter } from './presentation.ts'

const analysis = (provider, id, version) => ({ provider, evidenceFoundation: { dataset: { id, version } } })

test('share footer names the fictional fixture, its version and how the opinion was read', () => {
  assert.equal(
    sourceFooter(analysis('local', 'northbridge-eastport-return-demo', '1.0.0')),
    'Synthetic data · fictional match · Northbridge v Eastport · Return match v1.0.0 · read by local rules',
  )
  assert.match(sourceFooter(analysis('foundry', 'northbridge-eastport-analysis-demo', '3.0.0')), /Northbridge v Eastport · Original match v3\.0\.0 · read by Foundry/)
  assert.match(sourceFooter(analysis('local', 'westhaven-kingswell-demo', '1.0.0')), /Westhaven FC v Kingswell City · Westhaven fixture v1\.0\.0 · read by local rules/)
  assert.match(sourceFooter(analysis('local', 'redmere-alderwick-demo', '1.0.0')), /Redmere FC v Alderwick United · Redmere fixture v1\.0\.0 · read by local rules/)
})

test('an unknown dataset still keeps the synthetic label and never claims a match', () => {
  const footer = sourceFooter(analysis('local', 'other', '9'))
  assert.match(footer, /^Synthetic data · fictional match/)
  assert.doesNotMatch(footer, /Original|Return/)
})

test('historical replay footer preserves source attribution and license', () => {
  const footer = sourceFooter(
    analysis('local', 'arsenal-leicester-wyscout-2499719', '1.0.0'),
  )
  assert.match(footer, /^Historical replay · observed source data/)
  assert.match(footer, /Wyscout, Events, Figshare article 7770599, match 2499719/)
  assert.match(footer, /Luca Pappalardo and Emanuele Massucco/)
  assert.match(footer, /CC BY 4\.0/)
})

test('historical share card includes aggregate records, exact goal window, and source credit', () => {
  const shotIds = [
    '177960786',
    '177960827',
    '177960831',
    '177960849',
    '177960899',
  ]
  const claim = {
    claim: {
      text: 'Who had more shots in the ten minutes before Giroud’s winner?',
      subject: 'Arsenal',
      playerSubject: null,
      meaning: {
        category: 'factual-comparison',
        description: 'Compare recorded shots in the ten-minute window before the winning goal.',
        comparison: {
          opponent: 'Leicester City',
          opponentPlayer: null,
          metric: 'shots',
          operator: 'comparison-request',
        },
      },
      intent: 'statistical-request',
      clarificationNeeds: [],
    },
    assessment: 'statistics provided',
    periodLabel: 'Recorded shots from 2H 29:34.621 inclusive up to, but excluding, 2H 39:34.621 (177960902).',
    statistics: [
      { team: 'Arsenal', metric: 'shots', value: 5 },
      { team: 'Leicester City', metric: 'shots', value: 0 },
    ],
    playerStatistics: [],
    calculations: [
      {
        team: 'Arsenal',
        metric: 'shots',
        value: 5,
        numerator: 5,
        denominator: 5,
        numeratorRecordIds: shotIds,
        denominatorRecordIds: shotIds,
        denominatorDescription: 'All 5 recorded Arsenal shot events in the claim window; this is a count, not a rate.',
      },
      {
        team: 'Leicester City',
        metric: 'shots',
        value: 0,
        numerator: 0,
        denominator: 0,
        numeratorRecordIds: [],
        denominatorRecordIds: [],
        denominatorDescription: 'All 0 recorded Leicester City shot events in the claim window; this is a count, not a rate.',
      },
    ],
    evidence: shotIds.map((id) => ({
      role: 'calculation',
      reference: {
        id,
        time: '2H 30:00.000',
        team: 'Arsenal',
        description: 'Recorded Wyscout shot event.',
      },
    })).concat([{
      role: 'anchor',
      reference: {
        id: '177960902',
        time: '2H 39:34.621',
        team: 'Arsenal',
        description: 'Recorded Wyscout winning goal.',
      },
    }]),
    evidenceAvailability: [{ kind: 'shots', available: true, detail: 'Shot events are mapped.' }],
    limitation: 'Descriptive statistics are provided from recorded events; no truth verdict is assigned.',
  }
  const analysis = {
    provider: 'local',
    evidenceFoundation: {
      dataset: { id: 'arsenal-leicester-wyscout-2499719', version: '1.0.0' },
      players: [],
    },
    selectedPeriodLabel: 'Match so far through 85′',
    fanReply: 'Arsenal had 5 shots to Leicester City’s 0 in the 10 minutes before Giroud’s winner.',
    summary: '',
    claims: [claim],
  }
  const model = buildShareCardModel(claim.claim.text, analysis)
  const card = shareCardBlocks(model).map(({ text }) => text).join('\n')
  assert.match(card, /Arsenal: 5 shots/)
  assert.match(card, /Leicester City: 0 shots/)
  assert.match(card, /numerator 5 \[177960786, 177960827, 177960831, 177960849, 177960899\]; denominator 5/)
  assert.match(card, /2H 29:34\.621 inclusive up to, but excluding, 2H 39:34\.621/)
  assert.match(card, /Wyscout, Events, Figshare article 7770599, match 2499719/)
  assert.match(card, /CC BY 4\.0/)
})
