import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { plural } from '../../../lib/format'
import type { Coordinate } from '../route'
import { stopLabel } from '../route'
import StopForm from './StopForm'

interface StopsPanelProps {
  points: Coordinate[]
  disabled: boolean
  onChange: (points: Coordinate[], undoable?: boolean) => void
  onFocus: (point: Coordinate) => void
}

function StopRow({ point, index, count, disabled, onUpdate, onMove, onRemove, onFocus }: {
  point: Coordinate
  index: number
  count: number
  disabled: boolean
  onUpdate: (point: Coordinate) => void
  onMove: (direction: number) => void
  onRemove: () => void
  onFocus: () => void
}) {
  // Rows are keyed by position, so the editor tracks the coordinates it opened for.
  const [editingPoint, setEditingPoint] = useState<string | null>(null)
  const editButton = useRef<HTMLButtonElement>(null)
  const label = stopLabel(index, count)
  const pointKey = point.join(',')
  const editing = editingPoint === pointKey

  function closeEditor() {
    setEditingPoint(null)
    editButton.current?.focus()
  }

  return (
    <li className="route-stop">
      <div className="route-stop-heading">
        <span className="stop-number" aria-hidden="true">{index + 1}</span>
        <button type="button" className="stop-location" onClick={onFocus} disabled={disabled} aria-label={`Arată ${label.toLowerCase()} pe hartă`}>
          <strong>{label}</strong>
          <span>{point[1].toFixed(5)}, {point[0].toFixed(5)}</span>
        </button>
      </div>
      <div className="stop-row-actions">
        <button type="button" ref={editButton} onClick={() => setEditingPoint(editing ? null : pointKey)} disabled={disabled} aria-expanded={editing} aria-label={`Editează ${label.toLowerCase()}`}>Editează</button>
        <button type="button" className="stop-move" data-control="up" onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label={`Mută ${label.toLowerCase()} în sus`} title="Mută în sus">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>
        </button>
        <button type="button" className="stop-move" data-control="down" onClick={() => onMove(1)} disabled={disabled || index === count - 1} aria-label={`Mută ${label.toLowerCase()} în jos`} title="Mută în jos">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14m-6-6 6 6 6-6" /></svg>
        </button>
        <button type="button" data-control="remove" onClick={onRemove} disabled={disabled} aria-label={`Elimină ${label.toLowerCase()}`}>Elimină</button>
      </div>
      {editing && <StopForm coordinates={point} disabled={disabled} onCancel={closeEditor} onSubmit={(next) => {
        onUpdate(next)
        closeEditor()
      }} />}
    </li>
  )
}

export default function StopsPanel({ points, disabled, onChange, onFocus }: StopsPanelProps) {
  const list = useRef<HTMLOListElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  // Keep keyboard focus with the stop that moved, or on the row that took a removed stop's place.
  function change(next: Coordinate[], index: number, controls: string[], undoable = false) {
    flushSync(() => onChange(next, undoable))
    const row = list.current?.children[index]
    const target = controls.map((control) => row?.querySelector<HTMLButtonElement>(`[data-control="${control}"]:not(:disabled)`)).find(Boolean)
      ?? heading.current
    target?.focus()
  }

  return (
    <section className="stops-panel" aria-labelledby="stops-heading">
      <div className="route-section-heading">
        <h2 id="stops-heading" ref={heading} tabIndex={-1}>Opririle traseului</h2>
        <span>{plural(points.length, 'oprire', 'opriri')}</span>
      </div>
      <p className="route-help">Opririle sunt parcurse în ordinea de mai jos.</p>
      {points.length ? (
        <ol className="route-stops" ref={list}>
          {points.map((point, index) => (
            <StopRow key={index} point={point} index={index} count={points.length} disabled={disabled}
              onFocus={() => onFocus(point)}
              onRemove={() => change(points.filter((_, position) => position !== index), Math.min(index, points.length - 2), ['remove'], true)}
              onUpdate={(next) => onChange(points.map((current, position) => position === index ? next : current))}
              onMove={(direction) => {
                const reordered = [...points]
                const target = index + direction
                if (target < 0 || target >= points.length) return
                const previous = reordered[index]
                reordered[index] = reordered[target]
                reordered[target] = previous
                change(reordered, target, direction < 0 ? ['up', 'down'] : ['down', 'up'])
              }} />
          ))}
        </ol>
      ) : (
        <div className="route-empty">
          <strong>De unde începe traseul?</strong>
          <p>Fă clic pe hartă pentru a adăuga prima oprire sau introdu coordonatele ei mai jos.</p>
        </div>
      )}
      <div className="add-stop-section">
        <h3>Adaugă prin coordonate</h3>
        <StopForm disabled={disabled} onSubmit={(point) => {
          onChange([...points, point])
          onFocus(point)
        }} />
      </div>
    </section>
  )
}
