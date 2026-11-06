import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { dayIsComplete, dayMinutes, formatDay, formatHours, formatTime, hourSelection, validIntervals } from '../campaign'
import type { CampaignDay } from '../campaign'

interface Props {
  days: CampaignDay[]
  activeDate: string
  showErrors: boolean
  readOnlyBefore: string
  onDate: (date: string) => void
  onCreate: (date: string, start: number, end: number) => string | null
  onEdit: (date: string, intervalId: string) => void
}

interface Gesture {
  date: string
  pointerId: number
  touch: boolean
  originX: number
  originY: number
  anchor: number
  dragged: boolean
  cancelled: boolean
  element: HTMLDivElement
}

const hours = Array.from({ length: 24 }, (_, hour) => hour)
const hourHeight = 64

function minuteAt(element: HTMLElement, y: number) {
  const bounds = element.getBoundingClientRect()
  return (y - bounds.top) / bounds.height * 1440
}

export default function CampaignHoursCalendar({ days, activeDate, showErrors, readOnlyBefore, onDate, onCreate, onEdit }: Props) {
  const viewport = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const pendingFocus = useRef<{ date: string, hour: number } | null>(null)
  const [columns, setColumns] = useState(1)
  const [focusHour, setFocusHour] = useState(8)
  const [preview, setPreview] = useState<{ date: string, start: number, end: number } | null>(null)
  const [error, setError] = useState<{ days: CampaignDay[], message: string } | null>(null)
  const initialMinute = useRef(validIntervals(days.find((day) => day.date === activeDate) ?? days[0])[0]?.start ?? 480)
  const activeIndex = Math.max(0, days.findIndex((day) => day.date === activeDate))
  const pageStart = Math.floor(activeIndex / columns) * columns
  const visibleDays = days.slice(pageStart, pageStart + columns)

  useLayoutEffect(() => {
    const element = viewport.current!
    const phone = window.matchMedia('(max-width: 767px)')
    const measure = () => setColumns(phone.matches ? 1 : Math.max(1, Math.min(7, Math.floor((element.clientWidth - 64) / 140))))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    phone.addEventListener('change', measure)
    // Leave a quarter-hour above the first interval so its tick clears the sticky header.
    element.scrollTop = Math.max(0, initialMinute.current - 15) / 60 * hourHeight
    return () => { observer.disconnect(); phone.removeEventListener('change', measure) }
  }, [])

  useLayoutEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    viewport.current?.querySelector<HTMLButtonElement>(`[data-hour-date="${target.date}"][data-hour="${target.hour}"]`)?.focus()
    pendingFocus.current = null
  }, [activeDate, focusHour, columns])

  function cancelSelection() {
    const current = gesture.current
    gesture.current = null
    if (current?.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId)
    setPreview(null)
  }

  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) {
        event.preventDefault()
        cancelSelection()
      }
    }
    document.addEventListener('keydown', escape)
    window.addEventListener('blur', cancelSelection)
    return () => {
      document.removeEventListener('keydown', escape)
      window.removeEventListener('blur', cancelSelection)
      const current = gesture.current
      gesture.current = null
      if (current?.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId)
    }
  }, [])

  function create(date: string, start: number, end: number) {
    if (date < readOnlyBefore) return
    const message = onCreate(date, start, end)
    setError(message ? { days, message } : null)
  }

  function startSelection(event: PointerEvent<HTMLDivElement>, date: string) {
    if (date < readOnlyBefore) return
    if (!event.isPrimary || event.button !== 0 || gesture.current) return
    if ((event.target as HTMLElement).closest('.campaign-hour-event')) return
    const touch = event.pointerType === 'touch'
    const anchor = minuteAt(event.currentTarget, event.clientY)
    gesture.current = {
      date, pointerId: event.pointerId, touch, originX: event.clientX, originY: event.clientY,
      anchor, dragged: false, cancelled: false, element: event.currentTarget,
    }
    setError(null)
    if (!touch) {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      setPreview({ date, ...hourSelection(anchor, anchor, false) })
    }
  }

  function moveSelection(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return
    const distance = Math.hypot(event.clientX - current.originX, event.clientY - current.originY)
    if (current.touch) {
      if (distance > 8) current.cancelled = true
      return
    }
    if (Math.abs(event.clientY - current.originY) > 4) current.dragged = true
    setPreview({ date: current.date, ...hourSelection(current.anchor, minuteAt(current.element, event.clientY), current.dragged) })
  }

  function finishSelection(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return
    const range = hourSelection(current.anchor, minuteAt(current.element, event.clientY), current.dragged)
    cancelSelection()
    if (!current.cancelled) create(current.date, range.start, range.end)
  }

  function navigateHour(event: KeyboardEvent<HTMLButtonElement>, date: string, hour: number) {
    let nextHour = hour
    let nextIndex = days.findIndex((day) => day.date === date)
    switch (event.key) {
      case 'ArrowUp': nextHour = Math.max(0, hour - 1); break
      case 'ArrowDown': nextHour = Math.min(23, hour + 1); break
      case 'ArrowLeft': nextIndex = Math.max(0, nextIndex - 1); break
      case 'ArrowRight': nextIndex = Math.min(days.length - 1, nextIndex + 1); break
      case 'Home': nextHour = 0; break
      case 'End': nextHour = 23; break
      default: return
    }
    event.preventDefault()
    const nextDate = days[nextIndex].date
    if (nextDate === date && nextHour === hour) return
    pendingFocus.current = { date: nextDate, hour: nextHour }
    setFocusHour(nextHour)
    onDate(nextDate)
  }

  return <section className="campaign-hours-calendar" aria-labelledby="campaign-hours-title">
    <div className="campaign-calendar-heading">
      <div><h2 id="campaign-hours-title">Selected days</h2>
        <p className="campaign-help" aria-live="polite">{pageStart + 1}–{pageStart + visibleDays.length} of {days.length} {days.length === 1 ? 'day' : 'days'}</p></div>
      <div className="campaign-calendar-navigation">
        <button type="button" className="icon-button" aria-label="Previous selected days" disabled={pageStart === 0}
          onClick={() => { cancelSelection(); onDate(days[Math.max(0, pageStart - columns)].date) }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
        </button>
        <button type="button" className="icon-button" aria-label="Next selected days" disabled={pageStart + columns >= days.length}
          onClick={() => { cancelSelection(); onDate(days[pageStart + columns].date) }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
        </button>
      </div>
    </div>
    <p id="campaign-hours-help" className="campaign-help campaign-hours-help">Click or drag to add hours. Select a block to edit its times. <span>On touch, tap to add and swipe to scroll.</span></p>
    <p className="sr-only" id="campaign-hours-keyboard">Use arrow keys to move between hours and selected days, Home or End for the first or last hour, and Enter or Space to add an hour. Use the time fields to adjust or remove intervals. Escape cancels a drag.</p>
    <div ref={viewport} className="campaign-hours-viewport" style={{ gridTemplateColumns: `64px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
      role="region" aria-label="Hourly campaign calendar" aria-describedby="campaign-hours-help campaign-hours-keyboard">
      <div className="campaign-hours-corner" aria-hidden="true">Hours</div>
      {visibleDays.map((day) => <button key={`header-${day.date}`} type="button"
        className={`campaign-hour-day${day.date === activeDate ? ' active' : ''}${showErrors && !dayIsComplete(day) ? ' needs-hours' : ''}`}
        aria-pressed={day.date === activeDate} aria-label={`${day.date < readOnlyBefore ? 'View read-only' : 'Edit'} ${formatDay(day.date)}, ${dayIsComplete(day) ? formatHours(dayMinutes(day)) : 'hours needed'}`}
        onClick={() => { setError(null); onDate(day.date) }}>
        <span>{formatDay(day.date)}</span>
        <span className="campaign-hour-day-total num">{dayIsComplete(day) ? formatHours(dayMinutes(day)) : 'Hours needed'}</span>
      </button>)}
      <div className="campaign-hours-axis" aria-hidden="true">
        {[...hours, 24].map((hour) => <span key={hour} style={{ top: `${hour * hourHeight}px` }}>{formatTime(hour * 60)}</span>)}
      </div>
      {visibleDays.map((day) => <div key={day.date} className={`campaign-hour-column${day.date === activeDate ? ' active' : ''}${day.date < readOnlyBefore ? ' read-only' : ''}`}
        onPointerDown={(event) => startSelection(event, day.date)} onPointerMove={moveSelection}
        onPointerUp={finishSelection} onPointerCancel={cancelSelection} onLostPointerCapture={cancelSelection}>
        {hours.map((hour) => <button key={hour} type="button" className="campaign-hour-cell" aria-disabled={day.date < readOnlyBefore}
          data-hour-date={day.date} data-hour={hour} tabIndex={day.date === activeDate && hour === focusHour ? 0 : -1}
          aria-label={`${day.date < readOnlyBefore ? 'Read-only hours' : 'Add hours'} on ${formatDay(day.date)} at ${formatTime(hour * 60)}`}
          onFocus={() => setFocusHour(hour)} onKeyDown={(event) => navigateHour(event, day.date, hour)}
          onClick={(event) => { if (event.detail === 0) create(day.date, hour * 60, (hour + 1) * 60) }} />)}
        {validIntervals(day).map((interval) => <button key={interval.id} type="button" className="campaign-hour-event num"
          style={{ top: `${interval.start! / 60 * hourHeight}px`, height: `${(interval.end! - interval.start!) / 60 * hourHeight}px` }}
          aria-label={`${day.date < readOnlyBefore ? 'View read-only' : 'Edit'} ${formatDay(day.date)}, ${formatTime(interval.start!)} to ${formatTime(interval.end!)}`}
          title={`${formatDay(day.date)}, ${formatTime(interval.start!)}–${formatTime(interval.end!)}`}
          onClick={() => { setError(null); onEdit(day.date, interval.id) }}>
          {formatTime(interval.start!)}–{formatTime(interval.end!)}
        </button>)}
        {preview?.date === day.date && <div className="campaign-hour-preview num" aria-hidden="true"
          style={{ top: `${preview.start / 60 * hourHeight}px`, height: `${(preview.end - preview.start) / 60 * hourHeight}px` }}>
          {formatTime(preview.start)}–{formatTime(preview.end)}
        </div>}
      </div>)}
    </div>
    {error?.days === days && <p className="field-error campaign-hours-error" role="alert">{error.message}</p>}
    <div className="campaign-calendar-caption"><span><span className="campaign-selection-key" aria-hidden="true" />Working hours · 15-minute steps</span><span>Europe/Bucharest</span></div>
  </section>
}
