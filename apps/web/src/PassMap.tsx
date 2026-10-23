import { useId, useState } from 'react'
import type { AnalysisResponse } from '../../shared/src/apiContracts'
import { TEAMS, type MatchTeam } from '../../shared/src/matchClock'

type Foundation = AnalysisResponse['evidenceFoundation']

export function PassMap({ foundation }: { foundation: Foundation }) {
  const [team, setTeam] = useState<MatchTeam>('Northbridge')
  const [selectedId, setSelectedId] = useState('')
  const titleId = useId()
  const descriptionId = useId()
  const selectId = useId()
  const markerId = useId().replaceAll(':', '')
  const passes = foundation.passRecords.filter((pass) => pass.team === team)
  const selected = passes.find((pass) => pass.id === selectedId)
  const playerName = (id: string) =>
    foundation.players.find((player) => player.id === id)?.name ?? 'Unrecorded player'
  const x = (value: number) => 8 + value * 1.04
  const y = (value: number) => 8 + value * 0.64

  return (
    <details className="pass-map-panel">
      <summary>Explore the pass map</summary>
      <div className="pass-map-content">
        <div className="map-heading">
          <div>
            <p className="card-kicker">Selected match window</p>
            <h3 id={titleId}>Follow the ball.</h3>
          </div>
          <div className="segmented-control" role="group" aria-label="Pass map team">
            {TEAMS.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={team === name}
                onClick={() => { setTeam(name); setSelectedId('') }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <p id={descriptionId} className="map-caption">
          Returned synthetic pass records, attacking left to right. Select a pass for its timestamp and players.
        </p>
        <svg className="pass-map" viewBox="0 0 120 80" role="img" aria-labelledby={titleId} aria-describedby={descriptionId}>
          <defs>
            <marker id={markerId} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 6 3 L 0 6 z" fill="context-stroke" />
            </marker>
          </defs>
          <rect className="pitch-background" x="0" y="0" width="120" height="80" rx="3" />
          <g className="pitch-markings" fill="none" strokeWidth="0.3">
            <rect x="8" y="8" width="104" height="64" />
            <path d="M60 8v64 M8 21h16v38H8 M112 21H96v38h16 M8 31h6v18H8 M112 31h-6v18h6" />
            <circle cx="60" cy="40" r="9" />
            <circle cx="60" cy="40" r="0.5" fill="currentColor" />
          </g>
          {passes.map((pass) => (
            <g key={pass.id} className={`mapped-pass ${pass.outcome} ${selected?.id === pass.id ? 'is-selected' : ''}`} opacity={selected && selected.id !== pass.id ? 0.14 : undefined}>
              <line
                x1={x(pass.start.x)} y1={y(pass.start.y)}
                x2={x(pass.end.x)} y2={y(pass.end.y)}
                markerEnd={`url(#${markerId})`}
              />
              <circle cx={x(pass.start.x)} cy={y(pass.start.y)} r={selected?.id === pass.id ? 0.9 : 0.55} />
            </g>
          ))}
        </svg>
        <div className="map-legend" aria-label="Pass map key">
          <span><i className="legend-line complete" aria-hidden="true" />Completed</span>
          <span><i className="legend-line incomplete" aria-hidden="true" />Incomplete · dashed</span>
          <span>Attack direction →</span>
        </div>
        {passes.length > 0 ? (
          <>
            <label className="map-select-label" htmlFor={selectId}>Inspect a pass</label>
            <select id={selectId} value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.currentTarget.value)}>
              <option value="">All returned passes for {team}</option>
              {passes.map((pass) => (
                <option key={pass.id} value={pass.id}>{pass.time} · {playerName(pass.playerId)} · {pass.outcome}</option>
              ))}
            </select>
            {selected && (
              <p className="selected-pass" role="status">
                <strong>{selected.time} · {playerName(selected.playerId)} → {playerName(selected.receiverId)}</strong>
                <span>{selected.outcome === 'complete' ? 'Completed pass' : 'Incomplete pass'}</span>
              </p>
            )}
          </>
        ) : <p className="empty-evidence">No passes by {team} are recorded in this window.</p>}
        <p className="map-caption">This shows recorded pass locations. It does not show player movement, defensive shape or why a pass succeeded.</p>
      </div>
    </details>
  )
}
