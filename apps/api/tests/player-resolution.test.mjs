import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { analyzeOpinion } from '../dist/api/src/service.js'
import { verifyPlayerResolution } from '../dist/api/src/playerResolution.js'

const ambiguousBruno = JSON.parse(
  await readFile(
    new URL('./fixtures/foundry-2026-10-27-call4-interpretation.json', import.meta.url),
    'utf8',
  ),
).claims[0]

const request = (opinion = '¿Cuántos pases completó Bruno?') => ({
  opinion,
  selectedClock: { period: 2, minute: 58 },
  period: 'match-so-far',
  datasetId: 'northbridge-eastport-analysis-demo',
  inputLanguage: 'es',
})

function providerFor(claims) {
  let calls = 0
  return {
    provider: {
      name: 'foundry',
      async interpret() {
        calls += 1
        return { claims }
      },
    },
    calls: () => calls,
  }
}

async function initialBruno(provider = providerFor([ambiguousBruno])) {
  const result = await analyzeOpinion(request(), provider.provider)
  assert.equal(result.claims[0].claim.playerSubject, null)
  assert.equal(result.claims[0].assessment, 'clarification needed')
  assert.deepEqual(result.claims[0].playerStatistics, [])
  assert.ok(result.claims[0].playerResolution)
  assert.equal(result.claims[0].playerResolution.candidates.length, 2)
  return result
}

test('both Bruno choices calculate only attributed records without another provider call', async () => {
  for (const candidateIndex of [0, 1]) {
    const stub = providerFor([ambiguousBruno])
    const initial = await initialBruno(stub)
    const chosen = initial.claims[0].playerResolution.candidates[candidateIndex]
    const resolved = await analyzeOpinion(
      {
        action: 'resolve-player',
        continuation: initial.claims[0].playerResolution.continuation,
        claimId: initial.claims[0].claim.id,
        playerId: chosen.id,
      },
      stub.provider,
    )
    const result = resolved.claims[0]
    const expectedCompletions = resolved.evidenceFoundation.passRecords.filter(
      (pass) => pass.playerId === chosen.id && pass.outcome === 'complete',
    ).length

    assert.equal(stub.calls(), 1)
    assert.equal(resolved.provider, 'foundry')
    assert.equal(resolved.evidenceFoundation.dataset.id, request().datasetId)
    assert.equal(resolved.evidenceFoundation.dataset.version, '3.0.0')
    assert.equal(resolved.selectedTime, '58′')
    assert.equal(result.claim.playerSubject.id, chosen.id)
    assert.equal(result.claim.playerSubject.name, chosen.name)
    assert.equal(result.claim.subject, chosen.team)
    assert.equal(result.assessment, 'statistics provided')
    assert.ok(result.playerStatistics.length > 0)
    assert.ok(result.playerStatistics.every(({ playerId }) => playerId === chosen.id))
    assert.equal(
      result.playerStatistics.find(({ metric }) => metric === 'pass-completions')?.value,
      expectedCompletions,
    )
    assert.ok(
      resolved.evidenceFoundation.passRecords.every(
        ({ time }) => Number.parseInt(time, 10) <= 58,
      ),
    )
    assert.deepEqual(resolved.selectedPlayers.map(({ id }) => id), [chosen.id])
    assert.ok(resolved.playerResolutionContinuation)
    assert.equal(verifyPlayerResolution(resolved.playerResolutionContinuation).request.inputLanguage, 'es')
  }
})

test('same-squad unrelated, foreign, and tampered continuation choices are rejected', async () => {
  const initial = await initialBruno()
  const clarification = initial.claims[0].playerResolution
  const candidateIds = new Set(clarification.candidates.map(({ id }) => id))
  const sameTeamOther = initial.evidenceFoundation.players.find(
    ({ team, id }) =>
      team === clarification.candidates[0].team && !candidateIds.has(id),
  )
  assert.ok(sameTeamOther)

  for (const playerId of [sameTeamOther.id, 'east-player-99', 'west-player-01']) {
    await assert.rejects(
      analyzeOpinion({
        action: 'resolve-player',
        continuation: clarification.continuation,
        claimId: initial.claims[0].claim.id,
        playerId,
      }),
      /not a candidate/,
    )
  }
  await assert.rejects(
    analyzeOpinion({
      action: 'resolve-player',
      continuation: `${clarification.continuation.slice(0, -1)}x`,
      claimId: initial.claims[0].claim.id,
      playerId: clarification.candidates[0].id,
    }),
    /token is invalid/,
  )
  await assert.rejects(
    analyzeOpinion({
      action: 'resolve-player',
      continuation: clarification.continuation,
      claimId: initial.claims[0].claim.id,
      playerId: clarification.candidates[0].id,
      selectedClock: { period: 2, minute: 90 },
      opinion: 'tampered question',
    }),
    /request is invalid/,
  )
  await assert.rejects(
    analyzeOpinion({
      action: 'resolve-player',
      continuation: clarification.continuation,
      claimId: initial.claims[0].claim.id,
      playerId: clarification.candidates[0].id,
      datasetId: 'westhaven-kingswell-demo',
    }),
    /request is invalid/,
  )
})

test('full player names and explicit team context do not expose an ambiguous choice', async () => {
  for (const opinion of [
    'How many passes did Bruno Fernandes complete?',
    'How many passes did Bruno complete for Eastport?',
  ]) {
    const result = await analyzeOpinion(
      request(opinion),
      providerFor([ambiguousBruno]).provider,
    )
    assert.equal(result.claims[0].assessment, 'clarification needed')
    assert.equal(result.claims[0].playerResolution, undefined)
    assert.equal(result.claims[0].playerSubject, undefined)
  }
})

test('Arabic Bruno clarification uses localized opinion meaning to offer canonical player choices', async () => {
  const opinion = 'كم تمريرة أكمل برونو؟'
  const stub = providerFor([ambiguousBruno])
  const result = await analyzeOpinion(
    {
      ...request(opinion),
      inputLanguage: 'ar',
    },
    stub.provider,
  )

  assert.equal(stub.calls(), 1)
  assert.equal(result.claims[0].assessment, 'clarification needed')
  assert.equal(result.claims[0].claim.playerSubject, null)
  assert.deepEqual(result.claims[0].statistics, [])
  assert.deepEqual(result.claims[0].playerStatistics, [])
  assert.deepEqual(result.claims[0].evidence, [])
  assert.deepEqual(
    result.claims[0].playerResolution.candidates.map(({ name, team }) => ({ name, team })),
    [
      { name: 'Bruno Guimarães', team: 'Northbridge' },
      { name: 'Bruno Fernandes', team: 'Eastport' },
    ],
  )
  const grant = verifyPlayerResolution(
    result.claims[0].playerResolution.continuation,
  )
  assert.equal(grant.request.opinion, opinion)
  assert.equal(grant.request.inputLanguage, 'ar')
})

test('selection retains original clock despite replay movement; explicit recheck retains identity and scope rules', async () => {
  const stub = providerFor([ambiguousBruno])
  const initial = await initialBruno(stub)
  const chosen = initial.claims[0].playerResolution.candidates[0]
  const resolved = await analyzeOpinion({
    action: 'resolve-player',
    continuation: initial.playerResolutionContinuation,
    claimId: initial.claims[0].claim.id,
    playerId: chosen.id,
  })

  assert.equal(resolved.selectedTime, '58′')
  assert.equal(resolved.selectedPeriodLabel, 'Match so far through 58′')

  const rechecked = await analyzeOpinion({
    action: 'recheck-resolved-player',
    continuation: resolved.playerResolutionContinuation,
    selectedClock: { period: 2, minute: 90, stoppageMinutes: 4 },
    period: 'last-10-minutes',
  })
  assert.equal(stub.calls(), 1)
  assert.equal(rechecked.selectedTime, '90+4′')
  assert.equal(rechecked.selectedPeriodLabel, 'Last 10 minutes ending 90+4′')
  assert.equal(rechecked.claims[0].claim.playerSubject.id, chosen.id)
  assert.ok(
    rechecked.evidenceFoundation.passRecords.every(
      ({ time }) => !/^90\+5′/.test(time),
    ),
  )
})

test('mixed responses resolve only the ambiguous claim and retain independent answer evidence', async () => {
  const local = await analyzeOpinion({
    ...request(),
    opinion: 'Northbridge had more shots than Eastport',
    inputLanguage: 'en',
  })
  const teamClaim = { ...local.claims[0].claim, id: 'claim-shots' }
  const combinedProvider = providerFor([ambiguousBruno, teamClaim])
  const initial = await analyzeOpinion(
    request('How many passes did Bruno complete, and Northbridge had more shots than Eastport.'),
    combinedProvider.provider,
  )

  assert.ok(initial.claims[0].playerResolution)
  assert.equal(initial.claims[1].assessment, local.claims[0].assessment)
  assert.ok(initial.claims[1].evidence.length > 0)
  assert.ok(initial.claims[1].reply)

  const selected = initial.claims[0].playerResolution.candidates[1]
  const resolved = await analyzeOpinion({
    action: 'resolve-player',
    continuation: initial.playerResolutionContinuation,
    claimId: initial.claims[0].claim.id,
    playerId: selected.id,
  })
  assert.equal(combinedProvider.calls(), 1)
  assert.equal(resolved.claims[0].claim.playerSubject.id, selected.id)
  assert.equal(resolved.claims[1].assessment, local.claims[0].assessment)
  assert.ok(resolved.claims[1].evidence.length > 0)
  assert.equal(resolved.claims[1].statistics[0].value, initial.claims[1].statistics[0].value)
})
