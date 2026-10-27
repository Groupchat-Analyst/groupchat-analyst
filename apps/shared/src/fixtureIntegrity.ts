import { elapsedMatchMinute, getMatchTimeOptions, type MatchClock } from './matchClock.ts'
import type { MatchEvent } from './match.ts'
import type { SyntheticMatchEvidence } from './evidence.ts'

const VALID_CLOCKS = new Set(
  getMatchTimeOptions().map((clock) => `${clock.period}:${clock.minute}:${clock.stoppageMinutes ?? 0}`),
)

function validClock(clock: MatchClock): boolean {
  return VALID_CLOCKS.has(`${clock.period}:${clock.minute}:${clock.stoppageMinutes ?? 0}`)
}

/**
 * Structural validation of a synthetic dataset. Returns human-readable problems; an empty list
 * means the references, chronology, participation and possession accounting are coherent.
 * It does not (and cannot) make the data observed truth.
 */
export function validateFixtureIntegrity(
  events: MatchEvent[],
  fixture: SyntheticMatchEvidence,
): string[] {
  const problems: string[] = []
  const report = (message: string) => problems.push(message)

  const ids = new Map<string, string>()
  const register = (kind: string, id: string) => {
    if (ids.has(id)) report(`Duplicate record ID ${id} (${ids.get(id)} and ${kind}).`)
    else ids.set(id, kind)
  }
  events.forEach(({ id }) => register('event', id))
  fixture.possessions.forEach(({ id }) => register('possession', id))
  fixture.passes.forEach(({ id }) => register('pass', id))
  fixture.turnovers.forEach(({ id }) => register('turnover', id))
  fixture.recoveries.forEach(({ id }) => register('recovery', id))
  fixture.pressures.forEach(({ id }) => register('pressure', id))

  const players = new Map(fixture.players.map((player) => [player.id, player]))
  const onPitchAt = (team: string, playerId: string, elapsed: number): boolean => {
    const player = players.get(playerId)
    if (!player || player.team !== team) return false
    const subs = fixture.substitutions.filter((sub) => sub.team === team)
    if (player.status === 'starter') {
      return !subs.some((sub) => sub.playerOffId === playerId && elapsed >= elapsedMatchMinute(sub.clock))
    }
    return subs.some((sub) => sub.playerOnId === playerId && elapsed >= elapsedMatchMinute(sub.clock))
  }

  for (const team of ['Northbridge', 'Eastport'] as const) {
    const starters = fixture.players.filter((player) => player.team === team && player.status === 'starter')
    if (starters.length !== 11) report(`${team} must have exactly 11 starters.`)
    const lastElapsed = elapsedMatchMinute(fixture.coverage.end)
    const active = fixture.players.filter((player) => onPitchAt(team, player.id, lastElapsed))
    if (active.length !== 11) report(`${team} has ${active.length} active players at the end; expected 11.`)
  }
  for (const sub of fixture.substitutions) {
    if (!validClock(sub.clock)) report(`Substitution ${sub.id} has an invalid clock.`)
    const before = elapsedMatchMinute(sub.clock) - 0.0001
    if (!onPitchAt(sub.team, sub.playerOffId, before)) report(`Substitution ${sub.id}: outgoing player is not on the pitch.`)
    if (onPitchAt(sub.team, sub.playerOnId, before)) report(`Substitution ${sub.id}: incoming player is already on the pitch.`)
  }

  const coverageStart = elapsedMatchMinute(fixture.coverage.start)
  const coverageEnd = elapsedMatchMinute(fixture.coverage.end)
  const possessions = [...fixture.possessions].sort(
    (a, b) => elapsedMatchMinute(a.start) - elapsedMatchMinute(b.start),
  )
  possessions.forEach((possession, index) => {
    const start = elapsedMatchMinute(possession.start)
    const end = elapsedMatchMinute(possession.end)
    if (!validClock(possession.start) || !validClock(possession.end)) report(`Possession ${possession.id} has an invalid clock.`)
    if (end <= start) report(`Possession ${possession.id} must end after it starts.`)
    if (start < coverageStart || end > coverageEnd) report(`Possession ${possession.id} is outside declared coverage.`)
    if ((possession.status === 'controlled') !== (possession.team !== null)) {
      report(`Possession ${possession.id}: only controlled intervals have a team.`)
    }
    const next = possessions[index + 1]
    if (next && elapsedMatchMinute(next.start) < end) report(`Possessions ${possession.id} and ${next.id} overlap.`)
    for (const eventId of possession.relatedEventIds) {
      const event = events.find(({ id }) => id === eventId)
      if (!event) {
        report(`Possession ${possession.id} links unknown event ${eventId}.`)
        continue
      }
      const at = elapsedMatchMinute(event.clock)
      if (event.team !== possession.team) report(`Event ${eventId} team differs from possession ${possession.id}.`)
      if (at < start || at > end) report(`Event ${eventId} falls outside possession ${possession.id}.`)
    }
  })

  let previousEvent = -Infinity
  for (const event of events) {
    const at = elapsedMatchMinute(event.clock)
    if (!validClock(event.clock)) report(`Event ${event.id} has an invalid clock.`)
    if (at < previousEvent) report(`Event ${event.id} is out of chronological order.`)
    previousEvent = at
    if (at < coverageStart || at > coverageEnd) report(`Event ${event.id} is outside declared coverage.`)
    if (event.type === 'shot') {
      if (!event.playerId) report(`Shot ${event.id} has no shooter.`)
      else if (!onPitchAt(event.team, event.playerId, at)) report(`Shot ${event.id}: shooter is not an active ${event.team} player.`)
      if (!possessions.some((p) => p.relatedEventIds.includes(event.id))) report(`Shot ${event.id} is not linked to any possession.`)
    }
  }

  const possessionById = new Map(fixture.possessions.map((p) => [p.id, p]))
  const point = (value: number) => value >= 0 && value <= 100
  for (const pass of fixture.passes) {
    const possession = possessionById.get(pass.possessionId)
    const at = elapsedMatchMinute(pass.clock)
    if (!possession) { report(`Pass ${pass.id} links unknown possession.`); continue }
    if (possession.team !== pass.team) report(`Pass ${pass.id} team differs from its possession.`)
    if (at < elapsedMatchMinute(possession.start) || at > elapsedMatchMinute(possession.end)) report(`Pass ${pass.id} falls outside its possession.`)
    if (pass.playerId === pass.receiverId) report(`Pass ${pass.id} has the same passer and receiver.`)
    if (!onPitchAt(pass.team, pass.playerId, at)) report(`Pass ${pass.id}: passer is not on the pitch.`)
    if (!onPitchAt(pass.team, pass.receiverId, at)) report(`Pass ${pass.id}: receiver is not on the pitch.`)
    if (![pass.start.x, pass.start.y, pass.end.x, pass.end.y].every(point)) report(`Pass ${pass.id} has coordinates outside the pitch.`)
  }

  for (const turnover of fixture.turnovers) {
    const pass = fixture.passes.find(({ id }) => id === turnover.lostPassId)
    if (!pass) report(`Turnover ${turnover.id} links an unknown pass.`)
    else if (pass.outcome !== 'incomplete' || pass.possessionId !== turnover.possessionId || pass.playerId !== turnover.playerId) {
      report(`Turnover ${turnover.id} does not match its incomplete pass.`)
    }
  }
  for (const recovery of fixture.recoveries) {
    const turnover = fixture.turnovers.find(({ id }) => id === recovery.turnoverId)
    if (!turnover) report(`Recovery ${recovery.id} links an unknown turnover.`)
    else if (turnover.team === recovery.team) report(`Recovery ${recovery.id} must be by the opposing team.`)
    if (!onPitchAt(recovery.team, recovery.playerId, elapsedMatchMinute(recovery.clock))) report(`Recovery ${recovery.id}: actor is not on the pitch.`)
  }
  for (const pressure of fixture.pressures) {
    const possession = possessionById.get(pressure.possessionId)
    if (!possession) report(`Pressure ${pressure.id} links unknown possession.`)
    else if (possession.team === pressure.team) report(`Pressure ${pressure.id} must be by the defending team.`)
    if (!onPitchAt(pressure.team, pressure.playerId, elapsedMatchMinute(pressure.clock))) report(`Pressure ${pressure.id}: actor is not on the pitch.`)
  }
  for (const annotation of fixture.buildUpAnnotations) {
    const owned = (list: string[], pool: Array<{ id: string; possessionId: string }>) =>
      list.every((id) => pool.some((record) => record.id === id && record.possessionId === annotation.possessionId))
    if (!owned(annotation.passIds, fixture.passes)) report(`Annotation ${annotation.id} has a pass outside its possession.`)
    if (!owned(annotation.turnoverIds, fixture.turnovers)) report(`Annotation ${annotation.id} has a turnover outside its possession.`)
    if (!owned(annotation.pressureIds, fixture.pressures)) report(`Annotation ${annotation.id} has a pressure outside its possession.`)
  }

  return problems
}
