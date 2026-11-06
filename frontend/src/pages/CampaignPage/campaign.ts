import { formatCount } from '../../lib/format'

export interface CampaignInterval {
  id: string
  start: number | null
  end: number | null
}

export interface CampaignDay {
  date: string
  intervals: CampaignInterval[]
}

export interface IntervalError {
  field: 'start' | 'end'
  message: string
}

const dayFormat = new Intl.DateTimeFormat('ro-RO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const monthFormat = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' })
const bucharestDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' })

export function todayInBucharest() {
  const parts = bucharestDate.formatToParts(new Date())
  const part = (type: string) => parts.find((value) => value.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

// Calendar-only arithmetic. Never parse YYYY-MM-DD as a timestamp: that can shift its day.
function calendarDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function addDays(date: string, amount: number) {
  const next = calendarDate(date)
  next.setDate(next.getDate() + amount)
  return dateKey(next)
}

export function monthOf(date: string) {
  return `${date.slice(0, 7)}-01`
}

export function addMonths(date: string, amount: number) {
  const next = calendarDate(monthOf(date))
  next.setMonth(next.getMonth() + amount)
  return dateKey(next)
}

export function weekDay(date: string) {
  return (calendarDate(date).getDay() + 6) % 7
}

export function calendarDays(month: string) {
  const first = addDays(monthOf(month), -weekDay(monthOf(month)))
  return Array.from({ length: 42 }, (_, index) => addDays(first, index))
}

export const formatDay = (date: string) => dayFormat.format(calendarDate(date))
export const formatMonth = (date: string) => monthFormat.format(calendarDate(date))
export const formatTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
export const formatHours = (minutes: number) => `${formatCount(Math.floor(minutes / 60))} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`

export function emptyInterval(): CampaignInterval {
  return { id: crypto.randomUUID(), start: null, end: null }
}

// Pointer positions are wall-clock minutes; the end may reach midnight, the start may not.
export function hourSelection(anchor: number, endpoint: number, dragged: boolean) {
  const snap = (value: number) => Math.max(0, Math.min(1440, Math.round(value / 15) * 15))
  const origin = Math.min(1425, snap(anchor))
  if (!dragged) return { start: origin, end: Math.min(1440, origin + 60) }
  const edge = snap(endpoint)
  const start = Math.min(origin, edge)
  return { start, end: Math.max(start + 15, origin, edge) }
}

export function intervalErrors(intervals: readonly CampaignInterval[]) {
  const errors = new Map<string, IntervalError>()
  const usable: CampaignInterval[] = []
  for (const interval of intervals) {
    const { id, start, end } = interval
    if (start === null) errors.set(id, { field: 'start', message: 'Alege ora de început.' })
    else if (end === null) errors.set(id, { field: 'end', message: 'Alege ora de sfârșit.' })
    else if (!Number.isInteger(start) || start < 0 || start >= 1440 || start % 15 !== 0) {
      errors.set(id, { field: 'start', message: 'Alege ora de început în pași de 15 minute.' })
    } else if (!Number.isInteger(end) || end <= 0 || end > 1440 || end % 15 !== 0) {
      errors.set(id, { field: 'end', message: 'Alege ora de sfârșit în pași de 15 minute.' })
    } else if (end <= start) {
      errors.set(id, { field: 'end', message: 'Ora de sfârșit trebuie să fie după ora de început, în aceeași zi.' })
    } else usable.push(interval)
  }
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const a = usable[i], b = usable[j]
      if (a.start! < b.end! && b.start! < a.end!) {
        const message = a.start === b.start && a.end === b.end
          ? 'Acest interval este deja programat.' : 'Aceste ore se suprapun cu un alt interval.'
        errors.set(a.id, { field: 'end', message })
        errors.set(b.id, { field: 'start', message })
      }
    }
  }
  return errors
}

export function validIntervals(day: CampaignDay) {
  const errors = intervalErrors(day.intervals)
  return day.intervals.filter((interval) => !errors.has(interval.id))
    .sort((a, b) => a.start! - b.start!)
}

export function dayMinutes(day: CampaignDay) {
  return validIntervals(day).reduce((sum, interval) => sum + interval.end! - interval.start!, 0)
}

export function dayIsComplete(day: CampaignDay) {
  return day.intervals.length > 0 && intervalErrors(day.intervals).size === 0
}

export function scheduleMinutes(days: readonly CampaignDay[]) {
  return days.reduce((sum, day) => sum + dayMinutes(day), 0)
}

export function changedPastDays(days: readonly CampaignDay[], saved: readonly CampaignDay[], today: string) {
  const past = (schedule: readonly CampaignDay[]) => schedule.filter((day) => day.date < today)
    .map((day) => ({ date: day.date, intervals: [...day.intervals].sort((a, b) => a.id.localeCompare(b.id)) }))
    .sort((a, b) => a.date.localeCompare(b.date))
  return JSON.stringify(past(days)) !== JSON.stringify(past(saved))
}
