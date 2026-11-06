import { useState } from 'react'
import { plural } from '../../../lib/format'
import { dayIsComplete, formatDay, formatTime, intervalErrors } from '../campaign'
import type { CampaignDay, CampaignInterval } from '../campaign'

interface Props {
  day: CampaignDay
  copyDayCount: number
  readOnly: boolean
  showErrors: boolean
  onChange: (id: string, field: 'start' | 'end', value: number | null) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onCopy: () => void
}

const starts = Array.from({ length: 96 }, (_, index) => index * 15)
const ends = Array.from({ length: 96 }, (_, index) => (index + 1) * 15)

export default function IntervalEditor({ day, copyDayCount, readOnly, showErrors, onChange, onAdd, onRemove, onCopy }: Props) {
  const [touched, setTouched] = useState<Set<string>>(() => new Set())
  const errors = intervalErrors(day.intervals)

  function timeSelect(interval: CampaignInterval, field: 'start' | 'end') {
    const id = `interval-${interval.id}-${field}`
    const error = errors.get(interval.id)
    const visibleError = (showErrors || touched.has(interval.id)) && error
    return <div className="form-field">
      <label htmlFor={id}>{field === 'start' ? 'Început' : 'Sfârșit'}</label>
      <select id={id} value={interval[field] ?? ''} disabled={readOnly} aria-label={`${field === 'start' ? 'Ora de început' : 'Ora de sfârșit'} pentru intervalul ${day.intervals.indexOf(interval) + 1}`}
        aria-invalid={!!visibleError && error.field === field}
        aria-describedby={visibleError ? `interval-${interval.id}-error` : undefined}
        onChange={(event) => onChange(interval.id, field, event.target.value === '' ? null : Number(event.target.value))}
        onBlur={() => setTouched((previous) => new Set(previous).add(interval.id))}>
        <option value="">Alege ora</option>
        {(field === 'start' ? starts : ends).map((time) => <option key={time} value={time}>{formatTime(time)}</option>)}
      </select>
    </div>
  }

  return <section className="campaign-editor" aria-labelledby="campaign-editor-title">
    <h2 id="campaign-editor-title">Ore de funcționare</h2>
    <p className="campaign-subtitle">{formatDay(day.date)}</p>
    <p className="campaign-help">{readOnly ? 'Această zi trecută poate fi doar consultată.' : 'Intervale de 15 minute. Alege 24:00 ca oră de sfârșit pentru miezul nopții.'}</p>
    <div className="campaign-intervals">
      {day.intervals.map((interval, index) => {
        const error = errors.get(interval.id)
        const visibleError = (showErrors || touched.has(interval.id)) && error
        return <div key={interval.id} className="campaign-interval">
          <div className="campaign-interval-fields">
            {timeSelect(interval, 'start')}{timeSelect(interval, 'end')}
            <button type="button" className="icon-button" disabled={readOnly} aria-label={`Elimină intervalul ${index + 1}`} onClick={() => onRemove(interval.id)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M7 17 17 7" /></svg>
            </button>
          </div>
          {visibleError && <p className="field-error" id={`interval-${interval.id}-error`}>{error.message}</p>}
        </div>
      })}
    </div>
    {!day.intervals.length && <p className={showErrors ? 'field-error' : 'campaign-help'} id="campaign-empty-hours">Adaugă cel puțin un interval de funcționare.</p>}
    <button type="button" id="campaign-add-interval" className="campaign-add-interval" disabled={readOnly} aria-describedby={!day.intervals.length ? 'campaign-empty-hours' : undefined} onClick={onAdd}>
      <span aria-hidden="true">+</span> Adaugă un interval
    </button>
    {copyDayCount > 0 && <div className="campaign-copy-hours">
      <button type="button" disabled={!dayIsComplete(day)} aria-describedby="campaign-copy-help" onClick={onCopy}>Aplică și altor zile</button>
      <p id="campaign-copy-help" className="campaign-help">{dayIsComplete(day)
        ? `Înlocuiește orele pentru ${plural(copyDayCount, 'altă zi editabilă', 'alte zile editabile')}. Zilele trecute sunt păstrate.`
        : 'Completează orele acestei zile pentru a le copia în celelalte zile editabile.'}</p>
    </div>}
  </section>
}
