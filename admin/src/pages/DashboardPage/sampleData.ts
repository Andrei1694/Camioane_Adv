// Sample data for the dashboard. The backend has no fleet, booking, creative or playback API yet,
// so every name, plate, tariff and balance below is invented and must be replaced by API data.
// Totals are never typed here: dashboardData.ts computes them from these rows.

export type RouteId = 'centru' | 'nord' | 'vest' | 'est' | 'sud'

export interface FleetRoute {
  id: RouteId
  name: string
  corridor: string
  /** Credits per car-hour outside the peak window. */
  offPeakRate: number
  /** Credits per car-hour inside the peak window. */
  peakRate: number
}

export interface Client {
  id: string
  name: string
  /** Fits inside a two-hour bar on the timeline. */
  short: string
  /** Available credits. */
  balance: number
}

export interface Campaign {
  id: string
  clientId: string
  name: string
}

export interface Car {
  plate: string
  driver: string
  routeId: RouteId
  maintenance?: { start: number, end: number }
  /** Minute of the day the controller last reported in, when it is offline now. */
  offlineSince?: number
}

export type Delivery = 'received' | 'failed' | 'offline'

export interface Booking {
  id: string
  plate: string
  campaignId: string
  start: number
  end: number
  delivery: Delivery
  /** Playback logs have arrived up to this minute. Omitted: logs are complete up to now. */
  logsUntil?: number
  /** The file the controller failed to receive. */
  file?: string
  failedAt?: number
}

export interface ScheduleEntry {
  routeId: RouteId
  start: number
  end: number
  cars: number
  dates?: string[]
  repeat?: { weekdays: number[], from: string, until: string }
}

export interface BookingRequest {
  id: string
  clientId: string
  campaign: string
  submittedAt: string
  creativeId: string
  entries: ScheduleEntry[]
}

export type CreativeStatus = 'pending' | 'approved' | 'rejected'

export interface Creative {
  id: string
  clientId: string
  campaign: string
  file: string
  kind: 'Video' | 'Image'
  version: number
  seconds?: number
  sizeMb: number
  submittedAt: string
  status: CreativeStatus
}

export interface CancellationRequest {
  id: string
  clientId: string
  campaign: string
  routeId: RouteId
  start: number
  end: number
  cars: number
  dates: string[]
  submittedAt: string
}

/** Cars already committed on a future date by confirmed campaigns. */
export interface Commitment {
  routeId: RouteId
  date: string
  start: number
  end: number
  cars: number
}

export interface Confirmation {
  clientId: string
  campaign: string
  credits: number
  confirmedAt: string
}

export function minutes(time: string) {
  const [hours, mins] = time.split(':').map(Number)
  return hours * 60 + mins
}

/** The moment the sample describes. Every relative figure on the screen is measured from it. */
export const asOf = { date: '2026-11-04', time: minutes('14:30'), weekStart: '2026-11-02' }

export const operatingDay = { start: minutes('08:00'), end: minutes('22:00') }
export const peakWindow = { start: minutes('17:00'), end: minutes('20:00') }

export const routes: FleetRoute[] = [
  { id: 'centru', name: 'Centru', corridor: 'Universitate, Unirii, Romană', offPeakRate: 30, peakRate: 45 },
  { id: 'nord', name: 'Nord', corridor: 'Aviatorilor, Herăstrău, Pipera', offPeakRate: 28, peakRate: 40 },
  { id: 'vest', name: 'Vest', corridor: 'Militari, Drumul Taberei', offPeakRate: 20, peakRate: 30 },
  { id: 'est', name: 'Est', corridor: 'Titan, Pantelimon', offPeakRate: 20, peakRate: 30 },
  { id: 'sud', name: 'Sud', corridor: 'Berceni, Tineretului', offPeakRate: 18, peakRate: 26 },
]

export const clients: Client[] = [
  { id: 'paine', name: 'Pâine de Cartier', short: 'Pâine', balance: 300 },
  { id: 'lumen', name: 'Optica Lumen', short: 'Lumen', balance: 2150 },
  { id: 'forta', name: 'Sala Forța Nord', short: 'Forța', balance: 1400 },
  { id: 'arcada', name: 'Teatrul Arcada', short: 'Arcada', balance: 2000 },
  { id: 'vitan', name: 'Auto Vitan Service', short: 'Vitan', balance: 900 },
  { id: 'pagina', name: 'Librăria Pagina 9', short: 'Pagina 9', balance: 640 },
]

export const campaigns: Campaign[] = [
  { id: 'paine-dimineata', clientId: 'paine', name: 'Pâine caldă dimineața' },
  { id: 'lumen-rame', clientId: 'lumen', name: 'Rame noi' },
  { id: 'forta-oferta', clientId: 'forta', name: 'Oferta de toamnă' },
  { id: 'arcada-premiera', clientId: 'arcada', name: 'Premiera din noiembrie' },
  { id: 'vitan-anvelope', clientId: 'vitan', name: 'Anvelope de iarnă' },
  { id: 'pagina-targ', clientId: 'pagina', name: 'Târg de carte' },
]

export const cars: Car[] = [
  { plate: 'B 101 CMN', driver: 'Andrei Ionescu', routeId: 'centru' },
  { plate: 'B 102 CMN', driver: 'Elena Dumitru', routeId: 'centru' },
  { plate: 'B 103 CMN', driver: 'Radu Stoica', routeId: 'centru' },
  { plate: 'B 214 CMN', driver: 'Ioana Marin', routeId: 'nord', offlineSince: minutes('13:05') },
  { plate: 'B 215 CMN', driver: 'Mihai Constantin', routeId: 'nord' },
  { plate: 'B 216 CMN', driver: 'Cristina Pavel', routeId: 'nord' },
  { plate: 'B 327 CMN', driver: 'Vlad Georgescu', routeId: 'vest' },
  { plate: 'B 328 CMN', driver: 'Ana Munteanu', routeId: 'vest', maintenance: { start: minutes('08:00'), end: minutes('22:00') } },
  { plate: 'B 377 CMN', driver: 'Bogdan Lazăr', routeId: 'est' },
  { plate: 'B 378 CMN', driver: 'Diana Ene', routeId: 'est' },
  { plate: 'B 431 CMN', driver: 'Sorin Matei', routeId: 'sud' },
  { plate: 'B 432 CMN', driver: 'Laura Neagu', routeId: 'sud' },
]

function booking(id: string, plate: string, campaignId: string, start: string, end: string, extra: Partial<Booking> = {}): Booking {
  return { id, plate, campaignId, start: minutes(start), end: minutes(end), delivery: 'received', ...extra }
}

export const bookings: Booking[] = [
  booking('b01', 'B 101 CMN', 'lumen-rame', '08:00', '11:00'),
  booking('b02', 'B 101 CMN', 'paine-dimineata', '12:00', '15:00'),
  booking('b03', 'B 101 CMN', 'arcada-premiera', '17:00', '20:00'),
  booking('b04', 'B 102 CMN', 'pagina-targ', '09:00', '12:00'),
  booking('b05', 'B 102 CMN', 'lumen-rame', '13:00', '16:00'),
  booking('b06', 'B 102 CMN', 'arcada-premiera', '17:00', '20:00'),
  booking('b07', 'B 103 CMN', 'forta-oferta', '10:00', '13:00'),
  booking('b08', 'B 103 CMN', 'vitan-anvelope', '17:00', '21:00'),
  booking('b09', 'B 214 CMN', 'forta-oferta', '09:00', '11:00'),
  booking('b10', 'B 214 CMN', 'lumen-rame', '12:00', '15:00', { logsUntil: minutes('13:05') }),
  booking('b11', 'B 214 CMN', 'arcada-premiera', '16:00', '19:00', { delivery: 'offline', file: 'arcada-premiera-v1.mp4' }),
  booking('b12', 'B 215 CMN', 'paine-dimineata', '08:00', '10:00'),
  booking('b13', 'B 215 CMN', 'forta-oferta', '14:00', '17:00'),
  booking('b14', 'B 215 CMN', 'pagina-targ', '18:00', '21:00'),
  booking('b15', 'B 216 CMN', 'vitan-anvelope', '11:00', '14:00'),
  booking('b16', 'B 216 CMN', 'lumen-rame', '17:00', '20:00'),
  booking('b17', 'B 327 CMN', 'paine-dimineata', '08:00', '10:00'),
  booking('b18', 'B 327 CMN', 'vitan-anvelope', '13:00', '16:00'),
  booking('b19', 'B 327 CMN', 'forta-oferta', '18:00', '20:00'),
  booking('b20', 'B 377 CMN', 'pagina-targ', '10:00', '13:00'),
  booking('b21', 'B 377 CMN', 'paine-dimineata', '14:00', '16:00'),
  booking('b22', 'B 377 CMN', 'arcada-premiera', '17:00', '20:00', { delivery: 'failed', file: 'arcada-premiera-v1.mp4', failedAt: minutes('12:48') }),
  booking('b23', 'B 378 CMN', 'forta-oferta', '12:00', '15:00'),
  booking('b24', 'B 378 CMN', 'vitan-anvelope', '18:00', '21:00'),
  booking('b25', 'B 431 CMN', 'paine-dimineata', '08:00', '10:00'),
  booking('b26', 'B 431 CMN', 'pagina-targ', '14:00', '17:00'),
  booking('b27', 'B 432 CMN', 'lumen-rame', '11:00', '13:00'),
  booking('b28', 'B 432 CMN', 'vitan-anvelope', '16:00', '19:00'),
]

export const bookingRequests: BookingRequest[] = [
  {
    id: 'r1',
    clientId: 'forta',
    campaign: 'Abonament de iarnă',
    submittedAt: '2026-11-03T09:40',
    creativeId: 'c-forta-3',
    entries: [{ routeId: 'nord', start: minutes('17:00'), end: minutes('19:00'), cars: 2, repeat: { weekdays: [1, 3, 5], from: '2026-11-09', until: '2026-11-20' } }],
  },
  {
    id: 'r2',
    clientId: 'paine',
    campaign: 'Cozonac de sezon',
    submittedAt: '2026-11-02T10:12',
    creativeId: 'c-paine-2',
    entries: [
      { routeId: 'centru', start: minutes('16:30'), end: minutes('18:00'), cars: 2, dates: ['2026-11-14', '2026-11-21', '2026-11-28'] },
      { routeId: 'sud', start: minutes('16:30'), end: minutes('18:00'), cars: 1, dates: ['2026-11-14', '2026-11-21', '2026-11-28'] },
    ],
  },
  {
    id: 'r3',
    clientId: 'arcada',
    campaign: 'Seara de gală',
    submittedAt: '2026-11-04T11:20',
    creativeId: 'c-arcada-1',
    entries: [
      { routeId: 'nord', start: minutes('17:00'), end: minutes('19:00'), cars: 3, dates: ['2026-11-12'] },
      { routeId: 'centru', start: minutes('17:00'), end: minutes('19:00'), cars: 2, dates: ['2026-11-12'] },
    ],
  },
  {
    id: 'r4',
    clientId: 'vitan',
    campaign: 'Revizia de iarnă',
    submittedAt: '2026-11-03T16:05',
    creativeId: 'c-vitan-1',
    entries: [{ routeId: 'est', start: minutes('08:00'), end: minutes('11:00'), cars: 1, repeat: { weekdays: [2, 4], from: '2026-11-10', until: '2026-11-26' } }],
  },
]

export const creatives: Creative[] = [
  { id: 'c-forta-3', clientId: 'forta', campaign: 'Abonament de iarnă', file: 'forta-iarna-v3.mp4', kind: 'Video', version: 3, seconds: 15, sizeMb: 16.2, submittedAt: '2026-11-03T09:32', status: 'approved' },
  { id: 'c-paine-2', clientId: 'paine', campaign: 'Cozonac de sezon', file: 'cozonac-v2.png', kind: 'Image', version: 2, sizeMb: 2.4, submittedAt: '2026-11-02T10:05', status: 'approved' },
  { id: 'c-arcada-1', clientId: 'arcada', campaign: 'Seara de gală', file: 'gala-v1.mp4', kind: 'Video', version: 1, seconds: 20, sizeMb: 22.8, submittedAt: '2026-11-04T11:14', status: 'approved' },
  { id: 'c-vitan-1', clientId: 'vitan', campaign: 'Revizia de iarnă', file: 'revizie-iarna-v1.mp4', kind: 'Video', version: 1, seconds: 15, sizeMb: 18.4, submittedAt: '2026-11-03T16:01', status: 'pending' },
  { id: 'c-pagina-2', clientId: 'pagina', campaign: 'Târg de carte', file: 'targ-carte-v2.png', kind: 'Image', version: 2, sizeMb: 2.1, submittedAt: '2026-11-04T08:47', status: 'pending' },
  { id: 'c-lumen-4', clientId: 'lumen', campaign: 'Rame noi', file: 'rame-noi-v4.mp4', kind: 'Video', version: 4, seconds: 20, sizeMb: 24.7, submittedAt: '2026-11-04T12:30', status: 'pending' },
]

export const cancellationRequests: CancellationRequest[] = [
  {
    id: 'k1',
    clientId: 'pagina',
    campaign: 'Târg de carte',
    routeId: 'sud',
    start: minutes('18:00'),
    end: minutes('20:00'),
    cars: 1,
    dates: ['2026-11-13', '2026-11-14', '2026-11-15'],
    submittedAt: '2026-11-04T10:02',
  },
]

export const commitments: Commitment[] = [
  { routeId: 'nord', date: '2026-11-12', start: minutes('16:00'), end: minutes('20:00'), cars: 1 },
  { routeId: 'centru', date: '2026-11-14', start: minutes('12:00'), end: minutes('16:00'), cars: 2 },
  { routeId: 'sud', date: '2026-11-13', start: minutes('18:00'), end: minutes('20:00'), cars: 1 },
  { routeId: 'sud', date: '2026-11-14', start: minutes('18:00'), end: minutes('20:00'), cars: 1 },
  { routeId: 'sud', date: '2026-11-15', start: minutes('18:00'), end: minutes('20:00'), cars: 1 },
]

export const confirmations: Confirmation[] = [
  { clientId: 'arcada', campaign: 'Premiera din noiembrie', credits: 2880, confirmedAt: '2026-11-02T15:20' },
  { clientId: 'vitan', campaign: 'Anvelope de iarnă', credits: 1640, confirmedAt: '2026-11-03T11:05' },
  { clientId: 'lumen', campaign: 'Rame noi', credits: 1260, confirmedAt: '2026-11-04T09:15' },
]
