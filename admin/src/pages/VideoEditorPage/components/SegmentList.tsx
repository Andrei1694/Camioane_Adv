import { useId, useState } from 'react'
import { plural } from '../../../lib/format'
import { formatTimecode, layout, minSegmentLength, segmentLength, totalLength } from '../edit'
import type { Segment } from '../edit'

const shownSeconds = (seconds: number) => seconds.toFixed(1)

/** A seconds field that commits on blur or Enter; the edit clamps what it receives. */
function SecondsInput({ label, value, min, max, disabled, onCommit }: {
  label: string
  value: number
  min: number
  max: number
  disabled: boolean
  onCommit: (seconds: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = shownSeconds(value)

  function commit() {
    if (draft === null) return
    const seconds = Number(draft)
    setDraft(null)
    if (draft.trim() !== '' && Number.isFinite(seconds) && draft !== shown) onCommit(seconds)
  }

  return (
    <input className="seconds-input num" type="number" inputMode="decimal" step={0.1} min={shownSeconds(min)} max={shownSeconds(max)}
      aria-label={label} disabled={disabled} value={draft ?? shown}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') setDraft(null)
      }} />
  )
}

/** The segments as a table: the keyboard's way to trim and reorder, and the exact figures. */
export default function SegmentList({ segments, duration, selected, locked, onSelect, onTrim, onMove, onRemove }: {
  segments: Segment[]
  duration: number
  selected?: string
  locked: boolean
  onSelect: (id: string) => void
  onTrim: (id: string, edge: 'start' | 'end', seconds: number) => void
  onMove: (id: string, step: -1 | 1) => void
  onRemove: (id: string) => void
}) {
  const lastOneId = useId()
  const placed = layout(segments)
  const only = segments.length === 1

  return (
    <div className="segments-frame">
      <table className="segments-table">
        <caption>
          {plural(segments.length, 'segment', 'segmente')}<span className="unit"> · </span>
          <span className="num">{formatTimecode(totalLength(segments))}</span><span className="unit"> din {formatTimecode(duration)} păstrat</span>
        </caption>
        <thead>
          <tr>
            <th scope="col">Segment</th>
            <th className="col-seconds" scope="col">Început în sursă (s)</th>
            <th className="col-seconds" scope="col">Sfârșit în sursă (s)</th>
            <th className="col-length num" scope="col">Durată</th>
            <th className="col-place" scope="col">Pe cronologie</th>
            <th className="col-segment-actions" scope="col"><span className="sr-only">Acțiuni</span></th>
          </tr>
        </thead>
        <tbody>
          {placed.map(({ segment, index, start, end }) => {
            const name = `segment ${index + 1}`
            return (
              <tr key={segment.id} className={segment.id === selected ? 'is-selected' : undefined}>
                <th scope="row">
                  <button type="button" className="text-button segment-select" aria-pressed={segment.id === selected} onClick={() => onSelect(segment.id)}>
                    Segment {index + 1}
                  </button>
                </th>
                <td data-label="Început">
                  <SecondsInput label={`Începutul în sursă al ${name}, în secunde`} value={segment.sourceStart} disabled={locked}
                    min={0} max={segment.sourceEnd - minSegmentLength} onCommit={(seconds) => onTrim(segment.id, 'start', seconds)} />
                </td>
                <td data-label="Sfârșit">
                  <SecondsInput label={`Sfârșitul în sursă al ${name}, în secunde`} value={segment.sourceEnd} disabled={locked}
                    min={segment.sourceStart + minSegmentLength} max={duration} onCommit={(seconds) => onTrim(segment.id, 'end', seconds)} />
                </td>
                <td className="num" data-label="Durată">{formatTimecode(segmentLength(segment))}</td>
                <td className="num" data-label="Redare">{formatTimecode(start)}–{formatTimecode(end)}</td>
                <td>
                  <div className="segment-actions">
                    <button type="button" className="ghost-button" disabled={locked || index === 0} onClick={() => onMove(segment.id, -1)}>
                      Mai devreme<span className="sr-only"> {name}</span>
                    </button>
                    <button type="button" className="ghost-button" disabled={locked || index === segments.length - 1} onClick={() => onMove(segment.id, 1)}>
                      Mai târziu<span className="sr-only"> {name}</span>
                    </button>
                    <button type="button" className="text-button danger" disabled={locked || only}
                      aria-describedby={only ? lastOneId : undefined} onClick={() => onRemove(segment.id)}>
                      Șterge<span className="sr-only"> {name}</span>
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {only && <p className="segments-note" id={lastOneId}>Editarea păstrează cel puțin un segment, deci ultimul nu poate fi șters. Îl poți scurta.</p>}
    </div>
  )
}
