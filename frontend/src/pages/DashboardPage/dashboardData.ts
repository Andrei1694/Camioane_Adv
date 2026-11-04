import { formatCount, plural } from '../../lib/format'
import { asOf, campaigns, cars, clients, operatingDay, peakWindow, routes } from './sampleData'
import type {
  Booking, BookingRequest, CancellationRequest, Car, Client, Commitment, Confirmation, Creative, CreativeStatus, FleetRoute, RouteId,
} from './sampleData'

// Every figure on the dashboard is computed here from the sample rows, so the screen can be
// pointed at real API data later without retyping a total.

export interface DashboardState {
  requests: BookingRequest[]
  creatives: Creative[]
  cancellations: CancellationRequest[]
  balances: Record<string, number>
  confirmations: Confirmation[]
  commitments: Commitment[]
  retries: Record<string, number>
}

const routeById = new Map(routes.map((route) => [route.id, route]))
const clientById = new Map(clients.map((client) => [client.id, client]))
const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]))

export function routeOf(id: RouteId): FleetRoute {
  const route = routeById.get(id)
  if (!route) throw new Error(`Unknown route ${id}`)
  return route
}

export function clientOf(id: string): Client {
  const client = clientById.get(id)
  if (!client) throw new Error(`Unknown client ${id}`)
  return client
}

export function campaignOf(booking: Booking) {
  const campaign = campaignById.get(booking.campaignId)
  if (!campaign) throw new Error(`Unknown campaign ${booking.campaignId}`)
  return { ...campaign, client: clientOf(campaign.clientId) }
}

// Formatting ---------------------------------------------------------------------------------

// Counts and plurals are shared with other pages; re-exported so dashboard imports stay in one place.
export { formatCount, plural }

const oneDecimal = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const longDayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Car-hours from minutes, to one decimal, the way the screen shows them. */
export const formatHours = (mins: number) => oneDecimal.format(mins / 60)
export const formatHourValue = (hours: number) => oneDecimal.format(hours)
export const formatTime = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
export const formatWindow = (start: number, end: number) => `${formatTime(start)}–${formatTime(end)}`

function utcDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`)
}

export const formatDay = (iso: string) => dayFormat.format(utcDate(iso))
export const formatLongDay = (iso: string) => longDayFormat.format(utcDate(iso))
export const formatStamp = (iso: string) => `${formatDay(iso)}, ${iso.slice(11, 16)}`

/** How long something sent at this ISO local time has waited at the sample's moment. */
export function waitingFor(iso: string) {
  const sent = Date.parse(`${iso}:00Z`)
  const now = Date.parse(`${asOf.date}T${formatTime(asOf.time)}:00Z`)
  const mins = Math.max(0, Math.round((now - sent) / 60000))
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  if (days > 0) return `${days} d ${hours} h`
  return hours > 0 ? `${hours} h ${mins % 60} min` : `${mins} min`
}

/** Rounds to one decimal the way formatHours does, for sums that must match what is shown. */
const shownHours = (mins: number) => Math.round(mins / 6) / 10

// Today's timeline ---------------------------------------------------------------------------

export type SegmentKind = 'played' | 'no-logs' | 'scheduled' | 'undelivered'

export interface Segment {
  kind: SegmentKind
  start: number
  end: number
}

/** Splits a booking at now: played or missing logs before it, scheduled or undelivered after it. */
export function bookingSegments(booking: Booking, now = asOf.time): Segment[] {
  const segments: Segment[] = []
  const pastEnd = Math.min(booking.end, now)
  if (booking.start < pastEnd) {
    const logsUntil = Math.max(booking.start, Math.min(booking.logsUntil ?? pastEnd, pastEnd))
    if (logsUntil > booking.start) segments.push({ kind: 'played', start: booking.start, end: logsUntil })
    if (pastEnd > logsUntil) segments.push({ kind: 'no-logs', start: logsUntil, end: pastEnd })
  }
  const futureStart = Math.max(booking.start, now)
  if (futureStart < booking.end) {
    segments.push({ kind: booking.delivery === 'received' ? 'scheduled' : 'undelivered', start: futureStart, end: booking.end })
  }
  return segments
}

const overlap = (start: number, end: number, from: number, to: number) => Math.max(0, Math.min(end, to) - Math.max(start, from))

function carInService(car: Car) {
  const blocked = car.maintenance ? overlap(car.maintenance.start, car.maintenance.end, operatingDay.start, operatingDay.end) : 0
  return operatingDay.end - operatingDay.start - blocked
}

export interface RouteDay {
  route: FleetRoute
  cars: Car[]
  carsInService: number
  offeredMinutes: number
  bookedMinutes: number
  scheduledSoFar: number
  playedSoFar: number
  nextFree: { time: number, plate: string } | null
}

/** The first moment from now that one of the route's cars has an hour free before closing. */
function nextFreeCar(routeCars: Car[], bookings: Booking[], now: number) {
  let best: { time: number, plate: string } | null = null
  for (const car of routeCars) {
    const busy = bookings.filter((item) => item.plate === car.plate).map((item) => [item.start, item.end] as const)
    if (car.maintenance) busy.push([car.maintenance.start, car.maintenance.end])
    busy.sort((a, b) => a[0] - b[0])
    let cursor = now
    for (const [start, end] of busy) {
      if (end <= cursor) continue
      if (start - cursor >= 60) break
      cursor = Math.max(cursor, end)
    }
    if (operatingDay.end - cursor >= 60 && (!best || cursor < best.time)) best = { time: cursor, plate: car.plate }
  }
  return best
}

export function routeDays(bookings: Booking[], now = asOf.time): RouteDay[] {
  return routes.map((route) => {
    const routeCars = cars.filter((car) => car.routeId === route.id)
    const routeBookings = bookings.filter((item) => routeCars.some((car) => car.plate === item.plate))
    let scheduledSoFar = 0
    let playedSoFar = 0
    for (const item of routeBookings) {
      for (const segment of bookingSegments(item, now)) {
        if (segment.kind === 'played' || segment.kind === 'no-logs') scheduledSoFar += segment.end - segment.start
        if (segment.kind === 'played') playedSoFar += segment.end - segment.start
      }
    }
    return {
      route,
      cars: routeCars,
      carsInService: routeCars.filter((car) => carInService(car) > 0).length,
      offeredMinutes: routeCars.reduce((sum, car) => sum + carInService(car), 0),
      bookedMinutes: routeBookings.reduce((sum, item) => sum + item.end - item.start, 0),
      scheduledSoFar,
      playedSoFar,
      nextFree: nextFreeCar(routeCars, routeBookings, now),
    }
  })
}

export interface Attention {
  car: Car
  booking: Booking
  reason: string
}

/** Cars whose screen does not have the content for a booking still to come today. */
export function attentionItems(bookings: Booking[], now = asOf.time): Attention[] {
  return bookings
    .filter((item) => item.end > now && item.delivery !== 'received')
    .sort((a, b) => a.start - b.start)
    .map((item) => {
      const car = cars.find((candidate) => candidate.plate === item.plate)
      if (!car) throw new Error(`Unknown car ${item.plate}`)
      const reason = item.delivery === 'offline' && car.offlineSince !== undefined
        ? `Controller offline since ${formatTime(car.offlineSince)}`
        : `Transfer failed at ${item.failedAt === undefined ? '—' : formatTime(item.failedAt)}`
      return { car, booking: item, reason }
    })
}

export function finding(items: Attention[]) {
  if (items.length === 0) return 'Every screen with a booking later today has its content.'
  const first = items[0]
  const subject = items.length === 1 ? "1 screen hasn't" : `${formatCount(items.length)} screens haven't`
  return `${subject} received tonight's content. First affected slot: ${routeOf(first.car.routeId).name} at ${formatTime(first.booking.start)}.`
}

export interface Kpis {
  bookedNow: number
  carsInService: number
  carsInMaintenance: number
  bookedHours: number
  offeredHours: number
  playedHours: number
  scheduledHours: number
  creditsThisWeek: number
  campaignsThisWeek: number
}

export function kpis(state: DashboardState, days: RouteDay[], bookings: Booking[], now = asOf.time): Kpis {
  const inService = cars.filter((car) => carInService(car) > 0)
  const thisWeek = state.confirmations.filter((item) => item.confirmedAt.slice(0, 10) >= asOf.weekStart)
  return {
    bookedNow: new Set(bookings.filter((item) => item.start <= now && item.end > now).map((item) => item.plate)).size,
    carsInService: inService.length,
    carsInMaintenance: cars.length - inService.length,
    // Sums of the per-route figures as the routes table shows them, so the two always agree.
    bookedHours: days.reduce((sum, day) => sum + shownHours(day.bookedMinutes), 0),
    offeredHours: days.reduce((sum, day) => sum + shownHours(day.offeredMinutes), 0),
    playedHours: days.reduce((sum, day) => sum + shownHours(day.playedSoFar), 0),
    scheduledHours: days.reduce((sum, day) => sum + shownHours(day.scheduledSoFar), 0),
    creditsThisWeek: thisWeek.reduce((sum, item) => sum + item.credits, 0),
    campaignsThisWeek: thisWeek.length,
  }
}

export const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100))

// Booking requests ---------------------------------------------------------------------------

/** Expands an entry's specific dates and weekly repeat into dated instances, in order. */
export function instanceDates(entry: BookingRequest['entries'][number]) {
  const dates = new Set(entry.dates ?? [])
  if (entry.repeat) {
    for (let day = utcDate(entry.repeat.from); day <= utcDate(entry.repeat.until); day.setUTCDate(day.getUTCDate() + 1)) {
      const weekday = day.getUTCDay() === 0 ? 7 : day.getUTCDay()
      if (entry.repeat.weekdays.includes(weekday)) dates.add(day.toISOString().slice(0, 10))
    }
  }
  return [...dates].sort()
}

export interface PriceLine {
  routeId: RouteId
  start: number
  end: number
  band: 'Off-peak' | 'Peak'
  rate: number
  cars: number
  dates: number
  credits: number
}

/** Cars × Σ(hours in each tariff band × that band's rate), for every dated instance. */
export function priceLines(request: BookingRequest): PriceLine[] {
  return request.entries.flatMap((entry) => {
    const route = routeOf(entry.routeId)
    const dates = instanceDates(entry).length
    const cuts = [entry.start, entry.end, peakWindow.start, peakWindow.end]
      .filter((cut) => cut >= entry.start && cut <= entry.end)
    const bounds = [...new Set(cuts)].sort((a, b) => a - b)
    const lines: PriceLine[] = []
    for (let index = 0; index < bounds.length - 1; index += 1) {
      const start = bounds[index]
      const end = bounds[index + 1]
      const peak = start >= peakWindow.start && end <= peakWindow.end
      const rate = peak ? route.peakRate : route.offPeakRate
      lines.push({
        routeId: entry.routeId, start, end, band: peak ? 'Peak' : 'Off-peak', rate, cars: entry.cars, dates,
        credits: (rate * (end - start) * entry.cars * dates) / 60,
      })
    }
    return lines
  })
}

export interface Shortfall {
  routeId: RouteId
  date: string
  start: number
  end: number
  free: number
  needed: number
}

export function shortfalls(request: BookingRequest, commitments: Commitment[]): Shortfall[] {
  const result: Shortfall[] = []
  request.entries.forEach((entry, index) => {
    const fleet = cars.filter((car) => car.routeId === entry.routeId).length
    for (const date of instanceDates(entry)) {
      const committed = commitments
        .filter((item) => item.routeId === entry.routeId && item.date === date && overlap(item.start, item.end, entry.start, entry.end) > 0)
        .reduce((sum, item) => sum + item.cars, 0)
      // Entries of the same request on the same route and time add to each other's demand.
      const sameRequest = request.entries
        .filter((other, otherIndex) => otherIndex !== index && other.routeId === entry.routeId
          && overlap(other.start, other.end, entry.start, entry.end) > 0 && instanceDates(other).includes(date))
        .reduce((sum, other) => sum + other.cars, 0)
      const free = Math.max(0, fleet - committed)
      const needed = entry.cars + sameRequest
      if (needed > free) result.push({ routeId: entry.routeId, date, start: entry.start, end: entry.end, free, needed })
    }
  })
  return result
}

export type RequestStatus = 'ready' | 'balance' | 'conflict' | 'creative'

export interface RequestReview {
  request: BookingRequest
  client: Client
  creative: Creative | undefined
  lines: PriceLine[]
  total: number
  balance: number
  instances: number
  shortfalls: Shortfall[]
  blockers: string[]
  status: RequestStatus
}

export function reviewRequest(request: BookingRequest, state: DashboardState): RequestReview {
  const client = clientOf(request.clientId)
  const creative = state.creatives.find((item) => item.id === request.creativeId)
  const lines = priceLines(request)
  const total = lines.reduce((sum, line) => sum + line.credits, 0)
  const balance = state.balances[request.clientId] ?? 0
  const gaps = shortfalls(request, state.commitments)
  const blockers: string[] = []
  let status: RequestStatus = 'ready'
  if (creative?.status !== 'approved') {
    blockers.push(creative?.status === 'rejected' ? 'The creative was rejected.' : 'The creative is waiting for review.')
    status = 'creative'
  }
  if (balance < total) {
    blockers.push(`The balance is short by ${formatCount(total - balance)} cr.`)
    status = 'balance'
  }
  if (gaps.length > 0) {
    blockers.push(`${plural(gaps.length, 'slot')} without enough free cars.`)
    status = 'conflict'
  }
  return {
    request, client, creative, lines, total, balance, shortfalls: gaps, blockers, status,
    instances: request.entries.reduce((sum, entry) => sum + instanceDates(entry).length, 0),
  }
}

/** One line on what a request asks for: its routes and how many dates. */
export function requestSummary(request: BookingRequest) {
  const names = [...new Set(request.entries.map((entry) => routeOf(entry.routeId).name))].join(' and ')
  const dates = new Set(request.entries.flatMap(instanceDates))
  return `${names} · ${plural(dates.size, 'date')}`
}

/** The credits a cancellation request puts back on the table, priced like the original booking. */
export function cancellationCredits(request: CancellationRequest) {
  return priceLines({
    id: request.id, clientId: request.clientId, campaign: request.campaign, submittedAt: request.submittedAt, creativeId: '',
    entries: [{ routeId: request.routeId, start: request.start, end: request.end, cars: request.cars, dates: request.dates }],
  }).reduce((sum, line) => sum + line.credits, 0)
}

export function confirmRequest(state: DashboardState, review: RequestReview): DashboardState {
  const added: Commitment[] = review.request.entries.flatMap((entry) => instanceDates(entry).map((date) => ({
    routeId: entry.routeId, date, start: entry.start, end: entry.end, cars: entry.cars,
  })))
  return {
    ...state,
    requests: state.requests.filter((item) => item.id !== review.request.id),
    balances: { ...state.balances, [review.client.id]: review.balance - review.total },
    commitments: [...state.commitments, ...added],
    confirmations: [...state.confirmations, {
      clientId: review.client.id, campaign: review.request.campaign, credits: review.total,
      confirmedAt: `${asOf.date}T${formatTime(asOf.time)}`,
    }],
  }
}

export type DashboardAction =
  | { type: 'confirm', review: RequestReview }
  | { type: 'close-request', id: string }
  | { type: 'creative', id: string, status: CreativeStatus }
  | { type: 'cancellation', request: CancellationRequest, approve: boolean }
  | { type: 'retry', bookingId: string }

export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'confirm':
      return confirmRequest(state, action.review)
    case 'close-request':
      return { ...state, requests: state.requests.filter((item) => item.id !== action.id) }
    case 'creative':
      return { ...state, creatives: state.creatives.map((item) => (item.id === action.id ? { ...item, status: action.status } : item)) }
    case 'cancellation': {
      const { request } = action
      // An approved cancellation frees the cars it held on each of its dates.
      const commitments = action.approve
        ? state.commitments
          .map((item) => (item.routeId === request.routeId && request.dates.includes(item.date)
            && item.start === request.start && item.end === request.end ? { ...item, cars: item.cars - request.cars } : item))
          .filter((item) => item.cars > 0)
        : state.commitments
      return { ...state, commitments, cancellations: state.cancellations.filter((item) => item.id !== request.id) }
    }
    case 'retry':
      return { ...state, retries: { ...state.retries, [action.bookingId]: asOf.time } }
  }
}

export function initialState(source: {
  requests: BookingRequest[], creatives: Creative[], cancellations: CancellationRequest[],
  confirmations: Confirmation[], commitments: Commitment[],
}): DashboardState {
  return {
    ...source,
    balances: Object.fromEntries(clients.map((client) => [client.id, client.balance])),
    retries: {},
  }
}

/** Dev-only checks that the figures shown in two places agree. */
export function checkDashboard(state: DashboardState, days: RouteDay[], figures: Kpis, bookings: Booking[]) {
  if (!import.meta.env.DEV) return
  const offered = cars.reduce((sum, car) => sum + carInService(car), 0)
  const booked = bookings.reduce((sum, item) => sum + item.end - item.start, 0)
  console.assert(Math.abs(figures.offeredHours - shownHours(offered)) < 0.05, 'Route offered hours must add up to the fleet total')
  console.assert(Math.abs(figures.bookedHours - shownHours(booked)) < 0.05, 'Route booked hours must add up to the fleet total')
  console.assert(figures.playedHours <= figures.scheduledHours, 'Played hours cannot exceed scheduled hours')
  console.assert(days.every((day) => day.playedSoFar <= day.scheduledSoFar && day.bookedMinutes <= day.offeredMinutes),
    'Each route must play no more than it scheduled and book no more than it offers')
  for (const request of state.requests) {
    const review = reviewRequest(request, state)
    console.assert(Math.abs(review.lines.reduce((sum, line) => sum + line.credits, 0) - review.total) < 0.001, 'Price lines must sum to the total')
  }
}
