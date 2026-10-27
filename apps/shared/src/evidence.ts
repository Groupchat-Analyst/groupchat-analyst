import {
  elapsedMatchMinute,
  formatMatchClock,
  type MatchClock,
  type MatchTeam,
} from './matchClock.ts'

export type PitchPoint = { x: number; y: number }
export type PitchArea = 'defensive-third' | 'middle-third' | 'final-third'
export type PossessionStatus = 'controlled' | 'contested' | 'out-of-play'
export type PassOutcome = 'complete' | 'incomplete'
export type EvidenceProvenance =
  | 'synthetic'
  | 'observed'
  | 'inferred'
  | 'modelled'
type ProvenanceRecord = { provenance: EvidenceProvenance }

export type PossessionInterval = ProvenanceRecord & {
  id: string
  team: MatchTeam | null
  status: PossessionStatus
  start: MatchClock
  end: MatchClock
  relatedEventIds: string[]
  endReason: 'turnover' | 'shot' | 'goal' | 'out-of-play' | 'period-end' | 'contested'
}

export type PassEvent = ProvenanceRecord & {
  id: string
  possessionId: string
  team: MatchTeam
  playerId: string
  receiverId: string
  clock: MatchClock
  start: PitchPoint
  end: PitchPoint
  outcome: PassOutcome
  qualifiers: string[]
}

export type TurnoverEvent = ProvenanceRecord & {
  id: string
  possessionId: string
  team: MatchTeam
  playerId: string
  clock: MatchClock
  location: PitchPoint
  lostPassId: string
  recoveredBy: MatchTeam | null
}

export type RecoveryEvent = ProvenanceRecord & {
  id: string
  team: MatchTeam
  playerId: string
  clock: MatchClock
  location: PitchPoint
  turnoverId: string
}

export type PressureEvent = ProvenanceRecord & {
  id: string
  possessionId: string
  team: MatchTeam
  playerId: string
  clock: MatchClock
  location: PitchPoint
  type: 'challenge' | 'pressured-pass'
}

export type SyntheticMatchEvidence = {
  dataset: {
    id: string
    version: string
    label: string
    source: string
    provenance: EvidenceProvenance
    clockConvention: string
    coordinateConvention: string
  }
  coverage: {
    start: MatchClock
    end: MatchClock
    completeForPossessionIntervals: boolean
    completeForPassEvents: boolean
    completeForTurnovers: boolean
    missingPeriods: string[]
  }
  players: Array<{
    id: string
    team: MatchTeam
    name: string
    status: 'starter' | 'substitute'
    provenance: EvidenceProvenance
  }>
  substitutions: Array<{
    id: string
    team: MatchTeam
    clock: MatchClock
    playerOnId: string
    playerOffId: string
    provenance: EvidenceProvenance
  }>
  possessions: PossessionInterval[]
  passes: PassEvent[]
  turnovers: TurnoverEvent[]
  recoveries: RecoveryEvent[]
  pressures: PressureEvent[]
  buildUpAnnotations: Array<{
    id: string
    version: string
    phase: 'build-up'
    team: MatchTeam
    possessionId: string
    passIds: string[]
    turnoverIds: string[]
    pressureIds: string[]
    coverage: 'selected-sample'
  }>
}

export type EvidenceCapability = {
  id: string
  label: string
  status: 'available' | 'partial' | 'not-recorded'
  detail: string
}

export const EVIDENCE_CAPABILITIES: EvidenceCapability[] = [
  {
    id: 'match-events',
    label: 'Timestamped match events',
    status: 'available',
    detail: 'The original synthetic fixture records shots and goals with stable event IDs.',
  },
  {
    id: 'possession-intervals',
    label: 'Possession duration',
    status: 'available',
    detail: 'Synthetic controlled intervals are separate from contested and out-of-play time.',
  },
  {
    id: 'passes-and-locations',
    label: 'Pass outcomes and locations',
    status: 'available',
    detail: 'Synthetic pass attempts include start/end coordinates and completion outcomes.',
  },
  {
    id: 'turnovers-and-recoveries',
    label: 'Possession losses and recoveries',
    status: 'available',
    detail: 'Recorded synthetic incomplete-pass turnovers include area and recovery links.',
  },
  {
    id: 'pressure-events',
    label: 'Pressure events',
    status: 'partial',
    detail: 'Only selected synthetic pressure events are recorded; this is not continuous pressure tracking.',
  },
  {
    id: 'lineups',
    label: 'Lineups and substitutions',
    status: 'available',
    detail: 'Fictional player IDs and synthetic lineup/substitution records are included.',
  },
  {
    id: 'player-attributed-actions',
    label: 'Player-attributed synthetic actions',
    status: 'partial',
    detail: 'Selected passes, receptions, shots, turnovers, recoveries, and pressure observations have deterministic player IDs; the sparse authored events are not a complete player-performance dataset.',
  },
  {
    id: 'continuous-tracking',
    label: 'Continuous player/ball tracking',
    status: 'not-recorded',
    detail: 'No continuous tracking or defensive-shape measurements are available.',
  },
  {
    id: 'video',
    label: 'Synchronized video',
    status: 'not-recorded',
    detail: 'No video is included or linked.',
  },
  {
    id: 'physical-measurements',
    label: 'Physical measurements',
    status: 'not-recorded',
    detail: 'No distance, speed, acceleration, or workload measurements are included.',
  },
  {
    id: 'build-up-phase',
    label: 'Defined build-up phase',
    status: 'partial',
    detail: 'A small, versioned synthetic sample labels build-up sequences and links passes, losses, and selected pressure observations. It is not complete match-wide phase coverage.',
  },
  {
    id: 'advanced-models',
    label: 'Expected-goal or other advanced models',
    status: 'not-recorded',
    detail: 'No calibrated xG or model-derived metrics are supplied.',
  },
]

export type SequenceSeed = {
  id: string
  team: MatchTeam | null
  status: PossessionStatus
  start: MatchClock
  end: MatchClock
  endReason: PossessionInterval['endReason']
  passCount: number
  completedPasses: number
  lossArea?: PitchArea
  eventIds?: string[]
  /** Optional roster-slot (0-10) of each passer; defaults to the baseline rotation. */
  passers?: number[]
}

const HALF_ONE: SequenceSeed[] = [
  { id: 'sequence-01', team: 'Northbridge', status: 'controlled', start: { period: 1, minute: 1 }, end: { period: 1, minute: 8 }, endReason: 'turnover', passCount: 5, completedPasses: 4, lossArea: 'defensive-third' },
  { id: 'sequence-02', team: 'Eastport', status: 'controlled', start: { period: 1, minute: 8 }, end: { period: 1, minute: 12 }, endReason: 'turnover', passCount: 3, completedPasses: 2, lossArea: 'middle-third' },
  { id: 'sequence-03', team: 'Northbridge', status: 'controlled', start: { period: 1, minute: 12 }, end: { period: 1, minute: 18 }, endReason: 'turnover', passCount: 4, completedPasses: 3, lossArea: 'middle-third', eventIds: ['event-01'] },
  { id: 'sequence-04', team: 'Eastport', status: 'controlled', start: { period: 1, minute: 18 }, end: { period: 1, minute: 23 }, endReason: 'turnover', passCount: 4, completedPasses: 3, lossArea: 'middle-third', eventIds: ['event-02'] },
  { id: 'sequence-05', team: 'Northbridge', status: 'controlled', start: { period: 1, minute: 23 }, end: { period: 1, minute: 31 }, endReason: 'turnover', passCount: 5, completedPasses: 4, lossArea: 'final-third', eventIds: ['event-03'] },
  { id: 'sequence-06', team: 'Eastport', status: 'controlled', start: { period: 1, minute: 31 }, end: { period: 1, minute: 36 }, endReason: 'turnover', passCount: 4, completedPasses: 3, lossArea: 'final-third', eventIds: ['event-04'] },
  { id: 'sequence-07', team: null, status: 'out-of-play', start: { period: 1, minute: 36 }, end: { period: 1, minute: 37 }, endReason: 'out-of-play', passCount: 0, completedPasses: 0 },
  { id: 'sequence-08', team: 'Northbridge', status: 'controlled', start: { period: 1, minute: 37 }, end: { period: 1, minute: 40 }, endReason: 'turnover', passCount: 3, completedPasses: 2, lossArea: 'defensive-third', eventIds: ['event-05'] },
  { id: 'sequence-09', team: 'Eastport', status: 'controlled', start: { period: 1, minute: 40 }, end: { period: 1, minute: 44 }, endReason: 'turnover', passCount: 3, completedPasses: 2, lossArea: 'middle-third' },
  { id: 'sequence-10', team: null, status: 'contested', start: { period: 1, minute: 44 }, end: { period: 1, minute: 45 }, endReason: 'contested', passCount: 0, completedPasses: 0 },
  { id: 'sequence-11', team: 'Eastport', status: 'controlled', start: { period: 1, minute: 45 }, end: { period: 1, minute: 45, stoppageMinutes: 2 }, endReason: 'turnover', passCount: 2, completedPasses: 1, lossArea: 'middle-third', eventIds: ['event-06'] },
  { id: 'sequence-12', team: 'Northbridge', status: 'controlled', start: { period: 1, minute: 45, stoppageMinutes: 2 }, end: { period: 1, minute: 45, stoppageMinutes: 3 }, endReason: 'goal', passCount: 1, completedPasses: 1, eventIds: ['event-07'] },
]

const HALF_TWO: SequenceSeed[] = [
  { id: 'sequence-13', team: 'Eastport', status: 'controlled', start: { period: 2, minute: 46 }, end: { period: 2, minute: 51 }, endReason: 'turnover', passCount: 4, completedPasses: 3, lossArea: 'middle-third', eventIds: ['event-08'] },
  { id: 'sequence-14', team: 'Northbridge', status: 'controlled', start: { period: 2, minute: 51 }, end: { period: 2, minute: 58 }, endReason: 'turnover', passCount: 5, completedPasses: 4, lossArea: 'middle-third', eventIds: ['event-09'] },
  { id: 'sequence-15', team: 'Eastport', status: 'controlled', start: { period: 2, minute: 58 }, end: { period: 2, minute: 62 }, endReason: 'turnover', passCount: 3, completedPasses: 2, lossArea: 'final-third', eventIds: ['event-10'] },
  { id: 'sequence-16', team: null, status: 'out-of-play', start: { period: 2, minute: 62 }, end: { period: 2, minute: 63 }, endReason: 'out-of-play', passCount: 0, completedPasses: 0 },
  { id: 'sequence-17', team: 'Eastport', status: 'controlled', start: { period: 2, minute: 63 }, end: { period: 2, minute: 64 }, endReason: 'turnover', passCount: 1, completedPasses: 0, lossArea: 'middle-third' },
  { id: 'sequence-18', team: 'Northbridge', status: 'controlled', start: { period: 2, minute: 64 }, end: { period: 2, minute: 68 }, endReason: 'turnover', passCount: 3, completedPasses: 2, lossArea: 'defensive-third', eventIds: ['event-11'] },
  { id: 'sequence-19', team: 'Eastport', status: 'controlled', start: { period: 2, minute: 68 }, end: { period: 2, minute: 70 }, endReason: 'shot', passCount: 2, completedPasses: 2, eventIds: ['event-12'] },
  { id: 'sequence-20', team: 'Northbridge', status: 'controlled', start: { period: 2, minute: 70 }, end: { period: 2, minute: 75 }, endReason: 'turnover', passCount: 4, completedPasses: 3, lossArea: 'middle-third' },
  { id: 'sequence-21', team: null, status: 'contested', start: { period: 2, minute: 75 }, end: { period: 2, minute: 76 }, endReason: 'contested', passCount: 0, completedPasses: 0 },
  { id: 'sequence-22', team: 'Northbridge', status: 'controlled', start: { period: 2, minute: 76 }, end: { period: 2, minute: 77 }, endReason: 'shot', passCount: 2, completedPasses: 2, eventIds: ['event-13'] },
  { id: 'sequence-23', team: 'Eastport', status: 'controlled', start: { period: 2, minute: 77 }, end: { period: 2, minute: 83 }, endReason: 'goal', passCount: 4, completedPasses: 4, eventIds: ['event-14'] },
  { id: 'sequence-24', team: 'Northbridge', status: 'controlled', start: { period: 2, minute: 83 }, end: { period: 2, minute: 90, stoppageMinutes: 1 }, endReason: 'turnover', passCount: 5, completedPasses: 4, lossArea: 'final-third' },
  { id: 'sequence-25', team: 'Eastport', status: 'controlled', start: { period: 2, minute: 90, stoppageMinutes: 1 }, end: { period: 2, minute: 90, stoppageMinutes: 3 }, endReason: 'turnover', passCount: 2, completedPasses: 1, lossArea: 'middle-third', eventIds: ['event-15'] },
  { id: 'sequence-26', team: 'Northbridge', status: 'controlled', start: { period: 2, minute: 90, stoppageMinutes: 3 }, end: { period: 2, minute: 90, stoppageMinutes: 4 }, endReason: 'period-end', passCount: 1, completedPasses: 1, eventIds: ['event-16'] },
]

const SEQUENCE_SEEDS = [...HALF_ONE, ...HALF_TWO]

const ROSTERS: Record<MatchTeam, string[]> = {
  Northbridge: [
    'David Raya', 'Jurriën Timber', 'William Saliba', 'Gabriel Magalhães',
    'Riccardo Calafiori', 'Declan Rice', 'Martín Zubimendi', 'Martin Ødegaard',
    'Bukayo Saka', 'Eberechi Eze', 'Viktor Gyökeres', 'Ben White',
    'Kepa Arrizabalaga', 'Cristhian Mosquera', 'Piero Hincapié',
    'Myles Lewis-Skelly', 'Mikel Merino', 'Bruno Guimarães', 'Noni Madueke',
    'Kai Havertz',
  ],
  Eastport: [
    'Senne Lammens', 'Diogo Dalot', 'Matthijs de Ligt', 'Lisandro Martínez',
    'Luke Shaw', 'Carlos Baleba', 'Kobbie Mainoo', 'Bruno Fernandes',
    'Amad', 'Matheus Cunha', 'Benjamin Šeško', 'Leny Yoro', 'Karl Darlow',
    'Harry Maguire', 'Noussair Mazraoui', 'Patrick Dorgu', 'Manuel Ugarte',
    'Mason Mount', 'Bryan Mbeumo', 'Joshua Zirkzee',
  ],
}

function teamPlayerIds(rosters: Record<MatchTeam, string[]>): Record<MatchTeam, string[]> {
  return {
    Northbridge: rosters.Northbridge.map((_, index) =>
      `north-player-${String(index + 1).padStart(2, '0')}`,
    ),
    Eastport: rosters.Eastport.map((_, index) =>
      `east-player-${String(index + 1).padStart(2, '0')}`,
    ),
  }
}

const TEAM_PLAYER_IDS: Record<MatchTeam, string[]> = teamPlayerIds(ROSTERS)

type SubstitutionRecord = SyntheticMatchEvidence['substitutions'][number]

const BASELINE_SUBSTITUTIONS: SubstitutionRecord[] = [
  { id: 'substitution-01', team: 'Northbridge', clock: { period: 2, minute: 65 }, playerOnId: 'north-player-12', playerOffId: 'north-player-02', provenance: 'synthetic' },
  { id: 'substitution-02', team: 'Eastport', clock: { period: 2, minute: 72 }, playerOnId: 'east-player-12', playerOffId: 'east-player-03', provenance: 'synthetic' },
]

// A substitution applies from its exact timestamp onwards; each side always has 11 players on.
function activePlayersAt(
  team: MatchTeam,
  elapsed: number,
  substitutions: SubstitutionRecord[],
  playerIds: Record<MatchTeam, string[]> = TEAM_PLAYER_IDS,
): string[] {
  const active = playerIds[team].slice(0, 11)
  for (const substitution of substitutions) {
    if (substitution.team === team && elapsed >= elapsedMatchMinute(substitution.clock)) {
      active[active.indexOf(substitution.playerOffId)] = substitution.playerOnId
    }
  }
  return active
}

export function matchClockAtElapsed(value: number): MatchClock {
  const minute = Math.floor(value)
  if (minute <= 48) {
    return minute <= 45
      ? { period: 1, minute: Math.max(1, minute) }
      : { period: 1, minute: 45, stoppageMinutes: minute - 45 }
  }
  if (minute <= 93) return { period: 2, minute: minute - 3 }
  return { period: 2, minute: 90, stoppageMinutes: minute - 93 }
}

function passCoordinates(
  area: PitchArea,
  index: number,
  count: number,
  previousEnd?: PitchPoint,
) {
  const base = area === 'defensive-third' ? 12 : area === 'middle-third' ? 38 : 70
  const startX = previousEnd?.x ?? Math.min(90, base + (index % 2) * 3)
  const startY = previousEnd?.y ?? 22 + ((index * 13) % 56)
  const advances = index % 3 === 1 ? 32 : index % 3 === 2 ? 6 : 10
  const maximumX =
    area === 'defensive-third'
      ? 32
      : area === 'middle-third'
        ? 66
        : 98
  return {
    start: { x: startX, y: startY },
    end: {
      x: Math.min(maximumX, startX + (count === 1 ? 2 : advances)),
      y: 22 + (((index + 1) * 13) % 56),
    },
  }
}

export type EvidenceSpec = {
  dataset: SyntheticMatchEvidence['dataset']
  seeds: SequenceSeed[]
  substitutions: SubstitutionRecord[]
  buildUpPossessionIds: string[]
  /** Optional per-fixture roster (11 starters then substitutes); defaults to the baseline rosters. */
  rosters?: Record<MatchTeam, string[]>
  /** Possession whose mid-point carries one extra, explicitly annotated pressure observation. */
  extraPressure?: { id: string; possessionId: string; team: MatchTeam; rosterSlot: number; location: PitchPoint }
  coverage: SyntheticMatchEvidence['coverage']
}

export function buildSyntheticEvidence(spec: EvidenceSpec): SyntheticMatchEvidence {
const { seeds: SEQUENCE_SEEDS, substitutions: subs } = spec
const rosters = spec.rosters ?? ROSTERS
const playerIds = teamPlayerIds(rosters)
const activeAt = (team: MatchTeam, elapsed: number, substitutions: SubstitutionRecord[]) =>
  activePlayersAt(team, elapsed, substitutions, playerIds)
const players = (['Northbridge', 'Eastport'] as const).flatMap((team) =>
  playerIds[team].map((id, index) => ({
    id,
    team,
    name: rosters[team][index],
    status: index < 11 ? 'starter' as const : 'substitute' as const,
    provenance: 'synthetic' as const,
  })),
)

const possessions: PossessionInterval[] = SEQUENCE_SEEDS.map((seed) => ({
  id: seed.id,
  provenance: 'synthetic',
  team: seed.team,
  status: seed.status,
  start: seed.start,
  end: seed.end,
  relatedEventIds: seed.eventIds ?? [],
  endReason: seed.endReason,
}))

const passes: PassEvent[] = []
const turnovers: TurnoverEvent[] = []
const recoveries: RecoveryEvent[] = []
const pressures: PressureEvent[] = []

for (const [sequenceIndex, seed] of SEQUENCE_SEEDS.entries()) {
  if (seed.status !== 'controlled' || !seed.team) continue
  const startElapsed = elapsedMatchMinute(seed.start)
  const endElapsed = elapsedMatchMinute(seed.end)
  let previousPassEnd: PitchPoint | undefined
  for (let index = 0; index < seed.passCount; index += 1) {
    const time = Math.min(
      endElapsed - 0.01,
      startElapsed + ((endElapsed - startElapsed) * (index + 1)) / (seed.passCount + 1),
    )
    const clock = matchClockAtElapsed(Math.floor(time))
    const active = activeAt(seed.team, time, subs)
    const activePlayerIndex = seed.passers
      ? seed.passers[index] % active.length
      : (sequenceIndex + index) % active.length
    const playerId = active[activePlayerIndex]
    const receiverId = active[
      seed.passers?.[index + 1] !== undefined && index + 1 < seed.passCount
        ? seed.passers[index + 1] % active.length
        : (activePlayerIndex + 1) % active.length
    ]
    const area: PitchArea =
      seed.lossArea ?? (index === 0 ? 'middle-third' : 'final-third')
    const coordinates = passCoordinates(
      area,
      index,
      seed.passCount,
      previousPassEnd,
    )
    previousPassEnd = coordinates.end
    const outcome: PassOutcome =
      index < seed.completedPasses ? 'complete' : 'incomplete'
    const id = `pass-${String(passes.length + 1).padStart(3, '0')}`
    passes.push({
      id,
      provenance: 'synthetic',
      possessionId: seed.id,
      team: seed.team,
      playerId,
      receiverId,
      clock,
      ...coordinates,
      outcome,
      qualifiers: outcome === 'incomplete' ? ['turnover'] : [],
    })
    if (outcome === 'incomplete' && seed.lossArea) {
      const turnoverId = `turnover-${String(turnovers.length + 1).padStart(3, '0')}`
      const location = coordinates.end
      turnovers.push({
        id: turnoverId,
        provenance: 'synthetic',
        possessionId: seed.id,
        team: seed.team,
        playerId,
        clock,
        location,
        lostPassId: id,
        recoveredBy: seed.team === 'Northbridge' ? 'Eastport' : 'Northbridge',
      })
      recoveries.push({
        id: `recovery-${String(recoveries.length + 1).padStart(3, '0')}`,
        provenance: 'synthetic',
        team: seed.team === 'Northbridge' ? 'Eastport' : 'Northbridge',
        playerId: activeAt(
          seed.team === 'Northbridge' ? 'Eastport' : 'Northbridge',
          time,
          subs,
        )[sequenceIndex % 11],
        clock,
        location,
        turnoverId,
      })
    }
  }
  if (sequenceIndex % 4 === 1) {
    const pressureTeam = seed.team === 'Northbridge' ? 'Eastport' : 'Northbridge'
    const pressureElapsed = startElapsed + Math.floor((endElapsed - startElapsed) / 2)
    pressures.push({
      id: `pressure-${String(pressures.length + 1).padStart(3, '0')}`,
      provenance: 'synthetic',
      possessionId: seed.id,
      team: pressureTeam,
      playerId: activeAt(pressureTeam, pressureElapsed, subs)[sequenceIndex % 11],
      clock: matchClockAtElapsed(pressureElapsed),
      location: { x: 44 + (sequenceIndex % 3) * 8, y: 25 + (sequenceIndex % 5) * 10 },
      type: sequenceIndex % 2 ? 'pressured-pass' : 'challenge',
    })
  }

}

const buildUpPossessionIds = new Set(spec.buildUpPossessionIds)

  const extra = spec.extraPressure
  if (extra) {
    const extraSequence = SEQUENCE_SEEDS.find(({ id }) => id === extra.possessionId)!
    const extraElapsed =
      elapsedMatchMinute(extraSequence.start) +
      Math.floor(
        (elapsedMatchMinute(extraSequence.end) -
          elapsedMatchMinute(extraSequence.start)) /
          2,
      )
    pressures.push({
      id: extra.id,
      provenance: 'synthetic',
      possessionId: extraSequence.id,
      team: extra.team,
      playerId: activeAt(extra.team, extraElapsed, subs)[extra.rosterSlot],
      clock: matchClockAtElapsed(extraElapsed),
      location: extra.location,
      type: 'pressured-pass',
    })
  }

  const buildUpAnnotations = [...buildUpPossessionIds].map((possessionId, index) => {
    const sequencePasses = passes.filter((pass) => pass.possessionId === possessionId)
    const sequenceTurnovers = turnovers.filter(
      (turnover) => turnover.possessionId === possessionId,
    )
    return {
      id: `buildup-v1-${String(index + 1).padStart(2, '0')}`,
      version: '1.0.0',
      phase: 'build-up' as const,
      team: sequencePasses[0].team,
      possessionId,
      passIds: sequencePasses.map(({ id }) => id),
      turnoverIds: sequenceTurnovers.map(({ id }) => id),
      pressureIds: pressures
        .filter((pressure) => pressure.possessionId === possessionId)
        .map(({ id }) => id),
      coverage: 'selected-sample' as const,
    }
  })

return {
  dataset: spec.dataset,
  coverage: spec.coverage,
  players,
  substitutions: subs,
  possessions,
  passes,
  turnovers,
  recoveries,
  pressures,
  buildUpAnnotations,
}
}

export const SYNTHETIC_MATCH_EVIDENCE: SyntheticMatchEvidence = buildSyntheticEvidence({
  dataset: {
    id: 'northbridge-eastport-analysis-demo',
    version: '3.0.0',
    label: 'Simulated match using real-player names. All performances and results are fictional.',
    source: 'Authored deterministic synthetic fixture; roster-name references documented in DATA_DICTIONARY.md',
    provenance: 'synthetic',
    clockConvention: 'Period-aware match clock; first-half 45+N and second-half 90+N stoppage time; halftime excluded from played duration.',
    coordinateConvention: 'Normalized 0–100 pitch coordinates; both teams attack toward increasing x; thirds use x < 33.3, 33.3–<66.7, and >=66.7.',
  },
  seeds: SEQUENCE_SEEDS,
  substitutions: BASELINE_SUBSTITUTIONS,
  buildUpPossessionIds: [
    'sequence-01', 'sequence-02', 'sequence-04', 'sequence-03',
    'sequence-14', 'sequence-15', 'sequence-18', 'sequence-24',
  ],
  extraPressure: { id: 'pressure-build-up-01', possessionId: 'sequence-03', team: 'Eastport', rosterSlot: 2, location: { x: 60, y: 45 } },
  coverage: {
    start: { period: 1, minute: 1 },
    end: { period: 2, minute: 90, stoppageMinutes: 4 },
    completeForPossessionIntervals: true,
    completeForPassEvents: true,
    completeForTurnovers: true,
    missingPeriods: [],
  },
})

export type TeamEvidenceMetrics = {
  possessionMinutes: number
  possessionPercentage: number | null
  passAttempts: number
  completedPasses: number
  passCompletionPercentage: number | null
  possessionLosses: Record<PitchArea, number | null>
  finalThirdEntries: number | null
}

export type ClippedPossession = {
  id: string
  team: MatchTeam | null
  status: PossessionStatus
  start: MatchClock
  end: MatchClock
  durationMinutes: number
  endReason?: PossessionInterval['endReason']
  relatedEventIds: string[]
}

export type EvidenceCalculation = {
  startElapsed: number
  endElapsed: number
  denominatorMinutes: number
  possessionCoverageComplete: boolean
  passCoverageComplete: boolean
  turnoverCoverageComplete: boolean
  missingCoveragePeriods: string[]
  excludedOutOfPlayMinutes: number
  contestedMinutes: number
  teams: Record<MatchTeam, TeamEvidenceMetrics>
  possessionIntervals: ClippedPossession[]
  passes: PassEvent[]
  turnovers: TurnoverEvent[]
  recoveries: RecoveryEvent[]
  pressures: PressureEvent[]
  buildUpAnnotations: SyntheticMatchEvidence['buildUpAnnotations']
  buildUpTurnovers: TurnoverEvent[]
}

export function classifyPitchArea(location: PitchPoint): PitchArea {
  if (location.x < 33.3) return 'defensive-third'
  if (location.x < 66.7) return 'middle-third'
  return 'final-third'
}

function inWindow(
  clock: MatchClock,
  start: number,
  end: number,
  exclusivePointCutoff?: number,
): boolean {
  const elapsed = elapsedMatchMinute(clock)
  return (
    elapsed >= start &&
    elapsed <= end &&
    (exclusivePointCutoff === undefined || elapsed < exclusivePointCutoff)
  )
}

function countFinalThirdEntries(passesInWindow: PassEvent[]): Record<MatchTeam, number> {
  const byPossession = new Map<string, PassEvent[]>()
  for (const pass of passesInWindow) {
    if (pass.outcome !== 'complete') continue
    const sequence = byPossession.get(pass.possessionId) ?? []
    sequence.push(pass)
    byPossession.set(pass.possessionId, sequence)
  }
  const entries: Record<MatchTeam, number> = { Northbridge: 0, Eastport: 0 }
  for (const sequence of byPossession.values()) {
    const ordered = sequence.sort(
      (first, second) =>
        elapsedMatchMinute(first.clock) - elapsedMatchMinute(second.clock),
    )
    for (const pass of ordered) {
      if (
        classifyPitchArea(pass.start) !== 'final-third' &&
        classifyPitchArea(pass.end) === 'final-third'
      ) {
        entries[pass.team] += 1
      }
    }
  }
  return entries
}

export function calculateEvidence(
  fixture: SyntheticMatchEvidence,
  selectedClock: MatchClock,
  period: 'match-so-far' | 'last-10-minutes',
  explicitStartElapsed?: number,
  exclusivePointCutoff?: number,
): EvidenceCalculation {
  const selectedElapsed = elapsedMatchMinute(selectedClock)
  const coverageStart = elapsedMatchMinute(fixture.coverage.start)
  const startElapsed = Math.max(
    explicitStartElapsed ?? (period === 'last-10-minutes' ? selectedElapsed - 10 : coverageStart),
    coverageStart,
  )
  const endElapsed = selectedElapsed
  const teams: EvidenceCalculation['teams'] = {
    Northbridge: {
      possessionMinutes: 0,
      possessionPercentage: null,
      passAttempts: 0,
      completedPasses: 0,
      passCompletionPercentage: null,
      possessionLosses: { 'defensive-third': 0, 'middle-third': 0, 'final-third': 0 },
      finalThirdEntries: 0,
    },
    Eastport: {
      possessionMinutes: 0,
      possessionPercentage: null,
      passAttempts: 0,
      completedPasses: 0,
      passCompletionPercentage: null,
      possessionLosses: { 'defensive-third': 0, 'middle-third': 0, 'final-third': 0 },
      finalThirdEntries: 0,
    },
  }
  let contestedMinutes = 0
  let excludedOutOfPlayMinutes = 0
  const possessionIntervals: ClippedPossession[] = []

  for (const interval of fixture.possessions) {
    const intervalStart = elapsedMatchMinute(interval.start)
    const intervalEnd = elapsedMatchMinute(interval.end)
    const clippedStart = Math.max(intervalStart, startElapsed)
    const clippedEnd = Math.min(intervalEnd, endElapsed)
    if (clippedEnd <= clippedStart) continue
    const durationMinutes = clippedEnd - clippedStart
    const isClipped = clippedEnd < intervalEnd
    possessionIntervals.push({
      id: interval.id,
      team: interval.team,
      status: interval.status,
      start: clippedStart > intervalStart ? matchClockAtElapsed(clippedStart) : interval.start,
      end: isClipped ? matchClockAtElapsed(clippedEnd) : interval.end,
      durationMinutes,
      ...(isClipped ? {} : { endReason: interval.endReason }),
      relatedEventIds: isClipped ? [] : interval.relatedEventIds,
    })
    if (interval.status === 'contested') contestedMinutes += durationMinutes
    if (interval.status === 'out-of-play') excludedOutOfPlayMinutes += durationMinutes
    if (interval.status === 'controlled' && interval.team) {
      teams[interval.team].possessionMinutes += durationMinutes
    }
  }

  const denominatorMinutes =
    teams.Northbridge.possessionMinutes + teams.Eastport.possessionMinutes
  const possessionCoverageComplete =
    fixture.coverage.completeForPossessionIntervals &&
    fixture.coverage.missingPeriods.length === 0
  const passCoverageComplete =
    fixture.coverage.completeForPassEvents &&
    fixture.coverage.missingPeriods.length === 0
  const turnoverCoverageComplete =
    fixture.coverage.completeForTurnovers &&
    fixture.coverage.missingPeriods.length === 0
  if (denominatorMinutes > 0 && possessionCoverageComplete) {
    for (const team of ['Northbridge', 'Eastport'] as const) {
      teams[team].possessionPercentage = Number(
        ((teams[team].possessionMinutes / denominatorMinutes) * 100).toFixed(1),
      )
    }
  }

  const passes = fixture.passes.filter((pass) =>
    inWindow(pass.clock, startElapsed, endElapsed, exclusivePointCutoff),
  )
  for (const pass of passes) {
    teams[pass.team].passAttempts += 1
    if (pass.outcome === 'complete') teams[pass.team].completedPasses += 1
  }
  for (const team of ['Northbridge', 'Eastport'] as const) {
    const { passAttempts, completedPasses } = teams[team]
    teams[team].passCompletionPercentage =
      passAttempts > 0 &&
      passCoverageComplete
        ? Number(((completedPasses / passAttempts) * 100).toFixed(1))
        : null
  }

  const turnovers = fixture.turnovers.filter((turnover) =>
    inWindow(turnover.clock, startElapsed, endElapsed, exclusivePointCutoff),
  )
  for (const turnover of turnovers) {
    const area = classifyPitchArea(turnover.location)
    teams[turnover.team].possessionLosses[area] =
      (teams[turnover.team].possessionLosses[area] ?? 0) + 1
  }
  const finalThirdEntries = countFinalThirdEntries(passes)
  for (const team of ['Northbridge', 'Eastport'] as const) {
    teams[team].finalThirdEntries = passCoverageComplete
      ? finalThirdEntries[team]
      : null
    if (!turnoverCoverageComplete) {
      teams[team].possessionLosses = {
        'defensive-third': null,
        'middle-third': null,
        'final-third': null,
      }
    }
  }

  return {
    startElapsed,
    endElapsed,
    denominatorMinutes,
    possessionCoverageComplete,
    passCoverageComplete,
    turnoverCoverageComplete,
    missingCoveragePeriods: fixture.coverage.missingPeriods,
    excludedOutOfPlayMinutes,
    contestedMinutes,
    teams,
    possessionIntervals: possessionIntervals.map((interval) => ({
      ...interval,
      end: interval.end,
      start: interval.start,
    })),
    passes,
    turnovers,
    recoveries: fixture.recoveries.filter((recovery) =>
      inWindow(recovery.clock, startElapsed, endElapsed, exclusivePointCutoff),
    ),
    pressures: fixture.pressures.filter((pressure) =>
      inWindow(pressure.clock, startElapsed, endElapsed, exclusivePointCutoff),
    ),
    buildUpAnnotations: fixture.buildUpAnnotations
      .map((annotation) => ({
        ...annotation,
        passIds: annotation.passIds.filter((id) => passes.some((pass) => pass.id === id)),
        turnoverIds: annotation.turnoverIds.filter((id) =>
          turnovers.some((turnover) => turnover.id === id),
        ),
        pressureIds: annotation.pressureIds.filter((id) =>
          fixture.pressures.some(
            (pressure) =>
              pressure.id === id &&
              inWindow(pressure.clock, startElapsed, endElapsed, exclusivePointCutoff),
          ),
        ),
      }))
      .filter((annotation) =>
        annotation.passIds.length > 0 ||
        annotation.turnoverIds.length > 0 ||
        annotation.pressureIds.length > 0,
      ),
    buildUpTurnovers: turnovers.filter((turnover) =>
      fixture.buildUpAnnotations.some(
        (annotation) =>
          annotation.team === turnover.team &&
          annotation.turnoverIds.includes(turnover.id),
      ),
    ),
  }
}

export function formatEvidenceClock(clock: MatchClock): string {
  return formatMatchClock(clock)
}
