import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GENERIC_STATISTICS_LIMITATION,
  INTERNAL_ID_PATTERN,
  buildShareCardModel,
  describeEvidence,
  describePeriodLabel,
  isGenericStatisticsLimitation,
  selectRelevantEvidence,
  shareCardBlocks,
  shareCardText,
  summaryBody,
} from './presentation.ts'
import { getQuestionSuggestions } from './suggestions.ts'

const roster = [
  { id: 'north-player-09', name: 'Bukayo Saka' },
  { id: 'north-player-01', name: 'Aaron Ramsdale' },
  { id: 'east-player-10', name: 'Matheus Cunha' },
  { id: 'east-player-01', name: 'Jordan Pickford' },
]

const ref = (id, time, team, description) => ({ id, time, team, description })
const claimBase = {
  id: 'claim-1',
  playerSubject: null,
  playerMetric: null,
  intent: 'statistical-request',
  meaning: { category: 'other', description: 'x', comparison: null },
  requiredEvidence: [],
  timePeriod: { kind: 'selected' },
  historicalEventAnchor: null,
  clarificationNeeds: [],
}

const SUMMARY_TRAILER =
  '\n\nSelected period: Match so far through 90+4′. This is a fictional match using real-player names; all performances and results are fictional.'

function shotsResult() {
  const evidence = [
    ref('event-01', '12′', 'Northbridge', 'Low shot, saved. Shooter: Bukayo Saka (north-player-09).'),
    ref('event-02', '18′', 'Eastport', 'Effort goes wide. Shooter: Matheus Cunha (east-player-10).'),
    ref('event-05', '40′', 'Eastport', 'Shot saved. Shooter: Matheus Cunha (east-player-10).'),
  ].map((reference) => ({ role: 'context', reference }))
  return {
    claim: { ...claimBase, subject: 'Eastport', text: 'How many shots did Eastport have' },
    assessment: 'statistics provided',
    statistics: [{ team: 'Eastport', metric: 'shots', value: 8 }],
    playerStatistics: [],
    evidence,
    limitation: 'Descriptive statistics are provided from the recorded synthetic events.',
  }
}

function analysisOf(claims, summary) {
  return {
    summary: summary + SUMMARY_TRAILER,
    selectedPeriodLabel: 'Match so far through 90+4′',
    evidenceFoundation: { players: roster },
    claims,
  }
}

test('describeEvidence uses names and drops coordinates and identifiers', () => {
  const cases = [
    'Shooter: Bukayo Saka (north-player-09).',
    'Completed pass by north-player-01 intended for north-player-09, from (12, 22) to (22, 35).',
    'Lost possession by east-player-10 in the defensive third; recovered by Eastport.',
    'Recovery by east-player-01 following turnover-001 at (32, 31).',
    'Recorded pressured pass pressure by north-player-01 at (52, 35); pressure coverage is partial.',
  ]
  for (const input of cases) {
    const output = describeEvidence(input, roster)
    assert.doesNotMatch(output, INTERNAL_ID_PATTERN, output)
    assert.doesNotMatch(output, /\(\d+, \d+\)/, output)
  }
  assert.equal(
    describeEvidence('Shooter: Bukayo Saka (north-player-09).', roster),
    'Shooter: Bukayo Saka.',
  )
  assert.match(describeEvidence(cases[1], roster), /Aaron Ramsdale intended for Bukayo Saka/)
})

test('describeEvidence keeps unrelated parenthesised text', () => {
  assert.equal(
    describeEvidence('A clearance (headed) away.', roster),
    'A clearance (headed) away.',
  )
})

test('period labels lose only a trailing event anchor', () => {
  assert.equal(describePeriodLabel('Before half-time (event-07 Northbridge goal)'), 'Before half-time')
  assert.equal(describePeriodLabel('Match so far through 57′'), 'Match so far through 57′')
})

test('Eastport shots card uses only Eastport evidence and the authoritative statistic', () => {
  const result = shotsResult()
  const relevant = selectRelevantEvidence(result, roster)
  assert.deepEqual(relevant.map((e) => e.reference.team), ['Eastport', 'Eastport'])
  assert.equal(result.evidence.length, 3)

  const text = shareCardText(buildShareCardModel('How many shots did Eastport have?', analysisOf([result], 'Eastport recorded 8 shots.')))
  assert.match(text, /Eastport: 8 shots/)
  assert.match(text, /Matheus Cunha/)
  assert.doesNotMatch(text, /Saka|Northbridge:/)
  assert.doesNotMatch(text, INTERNAL_ID_PATTERN)
})

test('duration receipt preserves the opinion, elapsed-window label, fixture version, and provider', () => {
  const opinion = 'Saka has had a horrible game'
  const answer = 'Bukayo Saka recorded contributions in the selected window.'
  const result = {
    claim: {
      ...claimBase,
      playerSubject: {
        id: 'north-player-09',
        name: 'Bukayo Saka',
        team: 'Northbridge',
      },
      text: 'Bukayo Saka has had a horrible game so far.',
      intent: 'subjective-judgement',
    },
    assessment: 'insufficient evidence for a firm conclusion',
    statistics: [],
    playerStatistics: [{
      playerId: 'north-player-09',
      playerName: 'Bukayo Saka',
      team: 'Northbridge',
      metric: 'minutes-played',
      value: 62,
      numerator: 62,
      denominator: 62,
      numeratorRecordIds: [],
      denominatorRecordIds: [],
    }],
    evidence: [],
    evidenceAvailability: [],
    limitation: 'Recorded contributions cannot establish an overall performance rating.',
  }
  const analysis = {
    summary: answer + SUMMARY_TRAILER,
    fanReply: answer,
    provider: 'foundry',
    selectedPeriodLabel: 'Match so far through 60′',
    evidenceFoundation: {
      players: roster,
      dataset: {
        id: 'northbridge-eastport-return-demo',
        version: '1.0.0',
      },
    },
    claims: [result],
  }
  const model = buildShareCardModel(opinion, analysis)
  const text = shareCardText(model)
  const blocks = shareCardBlocks(model)

  assert.match(text, /“Saka has had a horrible game”/)
  assert.match(text, /62 elapsed minutes of participation in recorded coverage \(added time included\)/)
  assert.match(text, /Northbridge v Eastport · Return match v1\.0\.0 · read by Foundry/)
  assert.ok(blocks.some(({ kind, text: blockText }) =>
    kind === 'bullet' && blockText.includes('62 elapsed minutes of participation in recorded coverage'),
  ))
})

test('half-time goal card shows the supporting goal and one synthetic label', () => {
  const result = {
    claim: { ...claimBase, subject: 'Northbridge', text: 'Northbridge scored before half-time.' },
    assessment: 'supported',
    statistics: [],
    playerStatistics: [],
    evidence: [
      { role: 'supporting', reference: ref('event-07', '45+3′', 'Northbridge', 'Goal. Scorer: Bukayo Saka (north-player-09).') },
    ],
    limitation: 'Only the recorded goal is assessed.',
  }
  const model = buildShareCardModel('Northbridge scored before half-time.', analysisOf([result], 'Yes, Northbridge scored at 45+3′.'))
  const text = shareCardText(model)
  assert.match(text, /Verdict: Supported/)
  assert.match(text, /45\+3′ · Northbridge: Goal\. Scorer: Bukayo Saka\./)
  assert.match(text, /Limitation: Only the recorded goal is assessed/)
  assert.equal(text.match(/Synthetic data/g)?.length, 1)
  assert.equal(text.match(/Groupchat Analyst/g)?.length, 1)
  assert.doesNotMatch(text, /Selected period/)
})

test('counterevidence is preserved for a contested claim', () => {
  const result = {
    claim: { ...claimBase, subject: 'Eastport', text: 'Eastport dominated.' },
    assessment: 'contradicted',
    statistics: [],
    playerStatistics: [],
    evidence: [
      { role: 'challenging', reference: ref('event-02', '18′', 'Eastport', 'Effort goes wide.') },
    ],
    limitation: 'Limited to recorded events.',
  }
  const text = shareCardText(buildShareCardModel('Eastport dominated.', analysisOf([result], 'Not supported.')))
  assert.match(text, /Evidence against/)
  assert.match(text, /18′ · Eastport: Effort goes wide\./)
})

test('multiple claims with long text use the extended card and keep every limitation', () => {
  const long = 'A material qualification. '.repeat(20).trim()
  const claims = [1, 2].map((n) => ({
    ...shotsResult(),
    claim: { ...claimBase, id: `claim-${n}`, subject: 'Eastport', text: `Claim ${n}` },
    limitation: `${long} ${n}`,
  }))
  const model = buildShareCardModel('Two claims', analysisOf(claims, 'Both noted.'))
  assert.equal(model.extended, true)
  const blocks = shareCardBlocks(model)
  assert.ok(blocks.some((b) => b.kind === 'notice' && /Extended card · 2 claims/.test(b.text)))
  for (const n of [1, 2]) {
    assert.ok(blocks.some((b) => b.text.endsWith(`${long} ${n}`)))
  }
})

test('statistical cards omit the verdict heading and generic mechanics but keep data limitations', () => {
  const generic = { ...shotsResult(), limitation: GENERIC_STATISTICS_LIMITATION }
  const genericModel = buildShareCardModel('How many shots did Eastport have?', analysisOf([generic], 'Eastport recorded 8 shots.'))
  const genericText = shareCardText(genericModel)
  assert.doesNotMatch(genericText, /Verdict:|Statistics only|truth verdict|Limitation:/)
  assert.equal(genericModel.claims[0].verdict, null)

  const partial = {
    ...generic,
    limitation: 'Pass counts describe the recorded subset only. Pass-completion percentage is unavailable because pass coverage is incomplete.',
  }
  const partialText = shareCardText(buildShareCardModel('Passes?', analysisOf([partial], 'Some passes.')))
  assert.doesNotMatch(partialText, /Verdict:/)
  assert.match(partialText, /Limitation: Pass counts describe the recorded subset only/)
  assert.match(partialText, /pass coverage is incomplete/)
  assert.equal(isGenericStatisticsLimitation(generic), true)
  assert.equal(isGenericStatisticsLimitation(partial), false)
})

test('assessed claims keep their verdict even with the generic wording', () => {
  const supported = {
    ...shotsResult(),
    assessment: 'supported',
    limitation: GENERIC_STATISTICS_LIMITATION,
  }
  assert.equal(isGenericStatisticsLimitation(supported), false)
  const text = shareCardText(buildShareCardModel('Claim', analysisOf([supported], 'Yes.')))
  assert.match(text, /Verdict: Supported/)
  assert.match(text, /Limitation: Descriptive statistics/)
})

test('aggregate statistics are separated from selected recorded moments with the omitted count', () => {
  const evidence = Array.from({ length: 8 }, (_, index) => ({
    role: 'context',
    reference: ref(`event-${index}`, `${10 + index}′`, 'Eastport', 'Shot saved. Shooter: Matheus Cunha (east-player-10).'),
  }))
  const result = { ...shotsResult(), evidence }
  const blocks = shareCardBlocks(buildShareCardModel('How many shots did Eastport have?', analysisOf([result], 'Eastport recorded 8 shots.')))
  const kinds = blocks.map((block) => `${block.kind}:${block.text}`)
  const factsAt = kinds.indexOf('label:Key facts')
  const momentsAt = kinds.indexOf('label:Selected recorded moments')
  assert.ok(factsAt > -1 && momentsAt > factsAt)
  assert.equal(blocks[factsAt + 1].text, 'Eastport: 8 shots')
  assert.equal(blocks[factsAt + 2].kind, 'label')
  assert.equal(blocks.slice(momentsAt + 1).filter((block) => block.kind === 'bullet').length, 3)
  assert.ok(blocks.some((block) => block.text === '5 more recorded moments are in the full record.'))
})

test('multi-claim headings leave the verdict off statistical claims only', () => {
  const stat = { ...shotsResult(), limitation: GENERIC_STATISTICS_LIMITATION }
  const assessed = {
    ...shotsResult(),
    assessment: 'contradicted',
    claim: { ...claimBase, id: 'claim-2', subject: 'Eastport', text: 'Eastport dominated.' },
  }
  const headings = shareCardBlocks(buildShareCardModel('Both', analysisOf([stat, assessed], 'Both.')))
    .filter((block) => block.kind === 'heading')
    .map((block) => block.text)
  assert.deepEqual(headings, ['1. How many shots did Eastport have', '2. Eastport dominated. — Contradicted'])
})

test('summary trailer is removed only when it is the trailing paragraph', () => {
  assert.equal(summaryBody('Answer.' + SUMMARY_TRAILER), 'Answer.')
  assert.equal(summaryBody('Answer.\n\nSelected period mid-text.\n\nMore.'), 'Answer.\n\nSelected period mid-text.\n\nMore.')
})

test('single-unit statistics are not pluralised and team names are not repeated', () => {
  const result = {
    claim: { ...claimBase, subject: 'Northbridge', text: 'Goals?' },
    assessment: 'statistics provided',
    statistics: [{ team: 'Northbridge', metric: 'goals', value: 1 }],
    playerStatistics: [],
    evidence: [
      { role: 'supporting', reference: ref('event-07', '45+3′', 'Northbridge', 'Northbridge score with a close-range shot.') },
    ],
    limitation: 'Limited.',
  }
  const text = shareCardText(buildShareCardModel('Goals?', analysisOf([result], 'One goal.')))
  assert.match(text, /Northbridge: 1 goal\n/)
  assert.match(text, /45\+3′ · Northbridge score with a close-range shot\./)
})

test('suggestions respect the selected time and never offer unsupported phrasing', () => {
  const early = getQuestionSuggestions({ period: 1, minute: 20 }).map((s) => s.text)
  assert.ok(!early.some((t) => /half-time/.test(t)))
  const late = getQuestionSuggestions({ period: 2, minute: 57 }).map((s) => s.text)
  assert.ok(late.includes('Northbridge scored before half-time.'))
  assert.ok(!late.includes('Did Eastport have more shots than Northbridge?'))
})
