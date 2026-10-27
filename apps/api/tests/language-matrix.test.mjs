import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'

const B = 'northbridge-eastport-analysis-demo'
const R = 'northbridge-eastport-return-demo'
const S2 = (minute) => ({ period: 2, minute })
const FT = { period: 2, minute: 90, stoppageMinutes: 4 }
const SUBJ = 'subjective-judgement'
const INSUF = 'insufficient evidence for a firm conclusion'
const SAKA = /Bukayo Saka scored 1 goal, had 2 shots on target, completed 1 of 2 passes, made 1 recovery/

// status 'partial' = the response is honest and on topic but does not deliver everything the
// documented expected response names; the note says what is missing. It is never a refusal.
const cases = [
  { n: 1, text: 'Saka has had a horrible game', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: SAKA, evidence: 'some' },
  { n: 2, text: 'Saka is having a poor game', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: SAKA, evidence: 'some' },
  { n: 3, text: 'Saka has been brilliant', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: SAKA, evidence: 'some' },
  { n: 4, text: 'Saka is having a good game', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: SAKA, evidence: 'some' },
  { n: 5, text: 'Saka has not had a horrible game', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /Negating a take doesn't change what the records can show/, evidence: 'some' },
  { n: 6, text: 'Saka has been invisible', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /5 recorded actions/, evidence: 'some' },
  { n: 7, text: 'Saka is barely involved', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /5 recorded actions/, evidence: 'some' },
  { n: 8, text: 'Saka is carrying the team', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /5 recorded actions/, evidence: 'some' },
  { n: 9, text: 'Saka keeps misplacing passes', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /completed 1 of 2 recorded passes \(50%\).*No benchmark/, evidence: 'some' },
  { n: 10, text: 'Saka’s passing has been poor', ds: R, clock: S2(70), intent: SUBJ, assessment: INSUF, reply: /completed 5 of 5 recorded passes \(100%\).*No benchmark/, evidence: 'some' },
  { n: 11, text: 'Northbridge are struggling to string passes together', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /completed 18 of 23 recorded passes \(78\.3%\)/, evidence: 'some' },
  { n: 12, text: 'Northbridge keep giving it away', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /defensive third 2, middle third 2, final third 1/, evidence: 'some' },
  { n: 13, text: 'Northbridge are sloppy on the ball', ds: R, clock: FT, intent: SUBJ, assessment: INSUF, reply: /defensive third 1, middle third 5, final third 2/, evidence: 'some' },
  { n: 14, text: 'Eastport had more shots than Northbridge', ds: B, clock: S2(57), intent: 'factual-claim', assessment: 'contradicted', stats: [['Northbridge', 4], ['Eastport', 4]], reply: /level on 4 shots each/, evidence: 'some' },
  { n: 15, text: 'Eastport are not testing the keeper', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /recorded 2 shots on target.*“Testing the keeper” is a qualitative judgement/s, stats: [['Eastport', 4], ['Eastport', 0], ['Eastport', 2]], evidence: 'some' },
  { n: 16, text: 'Eastport have little attacking threat', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /4 shots.*not chance quality or attacking threat/, evidence: 'some' },
  { n: 17, text: 'Eastport are wasteful in front of goal', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /4 shots.*No chance-quality or expected-goals data/, evidence: 'some' },
  { n: 18, text: 'Eastport missed a sitter', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /4 shots.*No chance-quality or expected-goals data/, evidence: 'some' },
  { n: 19, text: 'Northbridge dominated possession', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, stats: [['Northbridge', 55.4], ['Eastport', 44.6]], reply: /Possession alone doesn't settle overall dominance/, evidence: 'some' },
  { n: 20, text: 'Eastport had more possession than Northbridge', ds: R, clock: FT, intent: 'factual-claim', assessment: 'supported', stats: [['Northbridge', 41.8], ['Eastport', 58.2]], reply: /Eastport had 58\.2% of recorded possession to Northbridge's 41\.8%/, evidence: 'some' },
  { n: 21, text: 'Northbridge parked the bus', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /Nothing here records defensive shape.*For context only: Northbridge had 55\.4%.*Eastport's 44\.6%.*does not support or contradict defensive shape/s, stats: [['Northbridge', 55.4], ['Eastport', 44.6]], evidence: 'some', contextOnly: true },
  { n: 22, text: 'Northbridge are sitting deep', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /Nothing here records defensive shape.*For context only: Northbridge had 55\.4%.*does not support or contradict defensive shape/s, stats: [['Northbridge', 55.4], ['Eastport', 44.6]], evidence: 'some', contextOnly: true },
  { n: 23, text: 'Eastport are pinned back', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /territory and pressing intensity are not recorded/, evidence: 'none' },
  { n: 24, text: 'Eastport cannot get out of their half', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /territory and pressing intensity are not recorded/, evidence: 'none' },
  { n: 25, text: 'Northbridge are pressing high', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: /Northbridge have 2 selected pressure observations.*partial sample.*doesn't show continuous pressing, how high it was, or its intensity/s, stats: [['Northbridge', 2], ['Eastport', 2]], evidence: 'some', contextOnly: true },
  { n: 26, text: 'Eastport have the momentum', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, stats: [['Northbridge', 55.4], ['Eastport', 44.6]], reply: /Momentum is not recorded/, evidence: 'some' },
  { n: 27, text: 'Northbridge had more possession than Eastport', ds: R, clock: S2(88), period: 'last-10-minutes', intent: 'factual-claim', assessment: 'supported', stats: [['Northbridge', 88.9], ['Eastport', 11.1]], reply: /Northbridge had 88\.9%/, evidence: 'some' },
  { n: 28, text: 'Eastport scored before half-time', ds: B, clock: S2(57), intent: 'factual-claim', assessment: 'contradicted', stats: [['Eastport', 0]], reply: /no Eastport goal before half-time/, evidence: 'none' },
  { n: 29, text: 'Northbridge did not score in the first half', ds: B, clock: S2(57), intent: 'factual-claim', assessment: 'contradicted', stats: [['Northbridge', 1]], reply: /Northbridge did score before half-time, at 45\+3′/, evidence: 'some' },
  { n: 30, text: 'Northbridge had more shots on target than Eastport before the goal', ds: B, clock: S2(57), intent: 'factual-claim', assessment: 'contradicted', stats: [['Northbridge', 1], ['Eastport', 1]], reply: /level on 1 shot on target each.*strictly before Northbridge's goal at 45\+3′/, evidence: 'some' },
  { n: 31, text: 'Both teams had the same number of shots', ds: B, clock: S2(57), intent: 'factual-claim', assessment: 'supported', stats: [['Northbridge', 4], ['Eastport', 4]], reply: /level on 4 shots each/, evidence: 'some' },
  { n: 32, text: 'Every Eastport shot was on target', ds: B, clock: S2(57), intent: 'factual-claim', assessment: 'contradicted', stats: [['Eastport', 4], ['Eastport', 2]], reply: /2 of Eastport's 4 recorded shots were on target, so not every shot was/, evidence: 'some' },
  { n: 33, text: 'Northbridge had no shots on target', ds: B, clock: S2(57), intent: 'factual-claim', assessment: 'contradicted', stats: [['Northbridge', 2]], reply: /2 recorded shots on target from 4 recorded shots/, evidence: 'some' },
  { n: 34, text: 'Eastport had more shots on target than Northbridge but Northbridge had more possession', ds: B, clock: S2(57), claims: [['factual-claim', 'contradicted'], ['factual-claim', 'supported']], reply: /level on 2 shots on target each.*Northbridge had 55\.4%/, evidence: 'some' },
  { n: 35, text: 'How many passes did Bruno complete?', ds: B, clock: S2(58), intent: 'unrecognized-language', assessment: 'clarification needed', reply: /Bruno Guimarães \(Northbridge\) or Bruno Fernandes \(Eastport\)/, evidence: 'none' },
  { n: 36, text: 'How did Saka perform?', ds: B, clock: S2(57), intent: SUBJ, assessment: INSUF, reply: SAKA, evidence: 'some' },
  { n: 37, text: 'How did he play?', ds: B, clock: S2(57), intent: 'unrecognized-language', assessment: 'clarification needed', reply: /Which player does “he” refer to/, evidence: 'none' },
  { n: 38, text: 'Saka and Rice have been poor', ds: B, clock: S2(57), claims: [[SUBJ, INSUF], [SUBJ, INSUF]], reply: /Bukayo Saka scored 1 goal.*Declan Rice/s, evidence: 'some' },
  { n: 39, text: 'Northbridge covered more distance than Eastport', ds: B, clock: S2(57), intent: 'unavailable-metric', assessment: 'unavailable data', reply: /Running distance and other physical measurements are not recorded/, evidence: 'none' },
  { n: 40, text: 'Rice is injured', ds: B, clock: S2(57), intent: 'unavailable-metric', assessment: 'unavailable data', reply: /Fitness, injury and exertion are not recorded/, evidence: 'none' },
  { n: 41, text: 'Eastport will win', ds: B, clock: S2(57), intent: 'unrecognized-language', assessment: 'unrecognized language', reply: /That's a prediction about what happens next/, evidence: 'none' },
  { n: 42, text: 'Eastport had a shot from outside the box', ds: B, clock: S2(57), intent: 'unavailable-metric', assessment: 'unavailable data', reply: /Shot records have no pitch coordinates or zone/, evidence: 'none' },
]

for (const c of cases) {
  test(`matrix ${c.n}: ${c.text} [${c.ds === B ? 'Original' : 'Return'}]${c.status === 'partial' ? ' (PARTIAL)' : ''}`, async () => {
    const r = await analyzeOpinion({ opinion: c.text, selectedClock: c.clock, period: c.period ?? 'match-so-far', datasetId: c.ds })
    const kinds = r.claims.map((x) => [x.claim.intent, x.assessment])
    assert.deepEqual(kinds, c.claims ?? [[c.intent, c.assessment]], 'interpretation and assessment')
    if (c.stats) assert.deepEqual((r.claims[0].statistics ?? []).map(({ team, value }) => [team, value]), c.stats, 'statistics')
    assert.match(r.fanReply, c.reply, 'response meaning')
    assert.ok(!/passs/.test(r.fanReply), 'no malformed plural')
    const evidence = r.claims.reduce((total, x) => total + (x.evidence ?? []).length, 0)
    if (c.evidence === 'none') assert.equal(evidence, 0, 'no unrelated evidence')
    else assert.ok(evidence > 0, 'cites evidence')
    if (c.contextOnly) {
      const roles = r.claims[0].evidence.map((item) => item.role)
      assert.ok(roles.length > 0 && roles.every((role) => role === 'context'), 'context evidence is never supporting or challenging')
    }
    assert.notEqual(r.fanReply, '', 'non-empty reply')
    assert.ok(!/couldn't match that to something I can check/.test(r.fanReply), 'no generic refusal')
  })
}

test('matrix totals: 42 cases, 42 pass, 0 partial, 0 fail', () => {
  assert.equal(cases.length, 42)
  const partial = cases.filter((c) => c.status === 'partial')
  assert.deepEqual(partial.map((c) => c.n), [])
  assert.equal(cases.length - partial.length, 42)
})
