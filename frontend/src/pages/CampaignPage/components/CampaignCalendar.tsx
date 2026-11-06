import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { addDays, addMonths, calendarDays, dayIsComplete, dayMinutes, formatDay, formatHours, formatMonth, monthOf, weekDay } from '../campaign'
import type { CampaignDay } from '../campaign'

interface Props {
  days: CampaignDay[]
  today: string
  month: string
  activeDate: string
  selecting: boolean
  showErrors: boolean
  lockedBefore?: string
  onMonth: (month: string) => void
  onDate: (date: string) => void
}

export default function CampaignCalendar({ days, today, month, activeDate, selecting, showErrors, lockedBefore, onMonth, onDate }: Props) {
  const [focusedDate, setFocusedDate] = useState(today)
  const pendingFocus = useRef<string | null>(null)
  const grid = useRef<HTMLTableElement>(null)
  const dates = calendarDays(month)
  const selected = new Map(days.map((day) => [day.date, day]))
  const tabDate = dates.includes(focusedDate) ? focusedDate : dates.includes(today) ? today : month

  useLayoutEffect(() => {
    if (!pendingFocus.current) return
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${pendingFocus.current}"]`)?.focus()
    pendingFocus.current = null
  }, [month, focusedDate])

  function moveFocus(date: string) {
    pendingFocus.current = date
    setFocusedDate(date)
    if (monthOf(date) !== month) onMonth(monthOf(date))
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    let target: string
    switch (event.key) {
      case 'ArrowLeft': target = addDays(date, -1); break
      case 'ArrowRight': target = addDays(date, 1); break
      case 'ArrowUp': target = addDays(date, -7); break
      case 'ArrowDown': target = addDays(date, 7); break
      case 'Home': target = addDays(date, -weekDay(date)); break
      case 'End': target = addDays(date, 6 - weekDay(date)); break
      case 'PageUp': target = addMonths(date, -1); break
      case 'PageDown': target = addMonths(date, 1); break
      default: return
    }
    event.preventDefault()
    moveFocus(target)
  }

  return <>
    <div className="campaign-calendar-heading">
      <h2 id="campaign-month" aria-live="polite">{formatMonth(month)}</h2>
      <div className="campaign-calendar-navigation">
        <button type="button" className="text-button" onClick={() => { onMonth(monthOf(today)); setFocusedDate(today) }}>Today</button>
        <button type="button" className="icon-button" aria-label="Previous month" onClick={() => onMonth(addMonths(month, -1))}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
        </button>
        <button type="button" className="icon-button" aria-label="Next month" onClick={() => onMonth(addMonths(month, 1))}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
        </button>
      </div>
    </div>
    <p id="campaign-calendar-help" className="sr-only">{selecting ? 'Select campaign dates.' : 'Choose a selected date to view its hours.'} Use arrow keys to move by day or week, Home and End within a week, and Page Up and Page Down to change month. Press Enter or Space to choose a date.</p>
    <table ref={grid} className="campaign-month-grid" role="grid" aria-labelledby="campaign-month" aria-describedby="campaign-calendar-help" aria-multiselectable="true">
      <thead><tr>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <th key={day} scope="col">{day}</th>)}</tr></thead>
      <tbody>{Array.from({ length: 6 }, (_, week) => <tr key={week}>
        {dates.slice(week * 7, week * 7 + 7).map((date) => {
          const day = selected.get(date)
          const locked = !!lockedBefore && date < lockedBefore
          const unavailable = selecting ? locked || date < today && !day : !day
          const complete = day && dayIsComplete(day)
          const hours = day ? complete ? formatHours(dayMinutes(day)) : 'Hours needed' : ''
          const current = !selecting && activeDate === date
          return <td key={date} aria-selected={!!day}>
            <button type="button" data-date={date} tabIndex={tabDate === date ? 0 : -1}
              className={['campaign-date', monthOf(date) !== month ? 'outside-month' : '', day ? 'selected' : '', current ? 'active' : '', showErrors && day && !complete ? 'needs-hours' : ''].filter(Boolean).join(' ')}
              aria-label={`${formatDay(date)}${day ? `, selected, ${hours}` : ''}${date < today ? ', past date' : ''}${locked && day ? ', read-only' : ''}`}
              aria-current={date === today ? 'date' : undefined} aria-disabled={unavailable}
              onFocus={() => setFocusedDate(date)} onKeyDown={(event) => handleKey(event, date)}
              onClick={() => { if (!unavailable) { onDate(date); if (monthOf(date) !== month) onMonth(monthOf(date)) } }}>
              <span className="campaign-date-number num">{Number(date.slice(-2))}</span>
              {day && <><span className="campaign-date-check" aria-hidden="true">{complete
                ? <svg className="campaign-check" viewBox="0 0 16 16"><path d="m3 8 3 3 7-7" /></svg> : '•'}</span>
                <span className="campaign-date-hours num" aria-hidden="true">{hours}</span></>}
            </button>
          </td>
        })}
      </tr>)}</tbody>
    </table>
    <div className="campaign-calendar-caption">
      <span><span className="campaign-selection-key" aria-hidden="true" />Selected campaign day</span>
      <span>Europe/Bucharest</span>
    </div>
  </>
}
