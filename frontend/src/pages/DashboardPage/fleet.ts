export type ScreenStatus = 'broadcasting' | 'syncing' | 'offline' | 'idle'
export type Coordinate = [longitude: number, latitude: number]

export interface Driver {
  id: string
  name: string
  initials: string
  onShift: boolean
  shift: string
}

export interface LedScreen {
  id: string
  status: ScreenStatus
  lastContact: string
  resolution: string
  observedCampaignId: string | null
}

export interface FleetIssue {
  severity: 'warning' | 'critical'
  title: string
  description: string
  since: string
}

export interface Vehicle {
  id: string
  registration: string
  model: string
  driverId: string
  screen: LedScreen
  coordinates: Coordinate | null
  area: string
  issue: FleetIssue | null
}

export interface Campaign {
  id: string
  name: string
  advertiser: string
  status: 'active' | 'scheduled'
  dates: string
  timeWindow: string
  duration: number
  creative: string
  creativeAlt: string
}

export interface Assignment {
  vehicleId: string
  campaignId: string
}

// A fixed, clearly labeled snapshot. Times never pretend to be live telemetry.
export const snapshot = { date: '4 Nov 2026', time: '14:30', zone: 'Europe/Bucharest', city: 'Bucharest' }

export const campaigns: Campaign[] = [
  { id: 'c1', name: 'Fresh around the corner', advertiser: 'Verde Market', status: 'active', dates: '1–15 Nov 2026', timeWindow: '08:00–21:00', duration: 15, creative: '/campaigns/verde.svg', creativeAlt: 'Verde Market: Fresh around the corner. Good food, every day.' },
  { id: 'c2', name: 'Your next coffee stop', advertiser: 'Ritual Coffee', status: 'active', dates: '2–20 Nov 2026', timeWindow: '07:00–19:00', duration: 10, creative: '/campaigns/ritual.svg', creativeAlt: 'Ritual Coffee: A little pause. A better day. Specialty coffee, made nearby.' },
  { id: 'c3', name: 'The city after hours', advertiser: 'Noaptea Studio', status: 'active', dates: '3–12 Nov 2026', timeWindow: '12:00–23:00', duration: 15, creative: '/campaigns/noaptea.svg', creativeAlt: 'Noaptea Studio: The city after hours. Music, art and everything between. 6–8 November.' },
  { id: 'c4', name: 'Make room for the weekend', advertiser: 'Atelier Home', status: 'scheduled', dates: '7–21 Nov 2026', timeWindow: '09:00–20:00', duration: 15, creative: '/campaigns/atelier.svg', creativeAlt: 'Atelier Home: Make room for the weekend. Thoughtful things for everyday living.' },
]

export const drivers: Driver[] = [
  ['d1', 'Andrei Popescu', 'AP'], ['d2', 'Ioana Marin', 'IM'], ['d3', 'Mihai Dumitru', 'MD'],
  ['d4', 'Elena Radu', 'ER'], ['d5', 'Vlad Ionescu', 'VI'], ['d6', 'Cristina Stan', 'CS'],
  ['d7', 'Radu Georgescu', 'RG'], ['d8', 'Alexandra Dobre', 'AD'], ['d9', 'Sorin Pavel', 'SP'],
  ['d10', 'Diana Ilie', 'DI'], ['d11', 'Gabriel Tudor', 'GT'], ['d12', 'Ana Petrescu', 'AP'],
].map(([id, name, initials], index) => ({ id, name, initials, onShift: index !== 11, shift: index === 11 ? 'Next shift · 16:00–22:00' : 'On shift · 08:00–16:00' }))

type VehicleSeed = [string, string, string, Coordinate | null, ScreenStatus, string, string | null]
const seeds: VehicleSeed[] = [
  ['B 124 ADV', 'Dacia Jogger', 'Piața Victoriei', [26.0866, 44.4522], 'broadcasting', '14:30', 'c1'],
  ['B 208 LED', 'Toyota Corolla', 'Universitate', [26.1025, 44.4355], 'broadcasting', '14:30', 'c2'],
  ['B 316 ADV', 'Škoda Octavia', 'Piața Unirii', [26.1028, 44.4273], 'broadcasting', '14:29', 'c3'],
  ['B 452 LED', 'Dacia Jogger', 'Dorobanți', [26.0967, 44.4645], 'broadcasting', '14:30', 'c1'],
  ['B 507 ADV', 'Renault Megane', 'Cotroceni', [26.0632, 44.4336], 'broadcasting', '14:29', 'c2'],
  ['B 631 LED', 'Toyota Corolla', 'Tineretului', [26.1081, 44.4128], 'broadcasting', '14:30', 'c1'],
  ['B 742 ADV', 'Dacia Jogger', 'Obor', [26.1259, 44.4501], 'syncing', '14:28', 'c2'],
  ['B 815 LED', 'Škoda Octavia', 'Piața Romană', [26.0978, 44.4467], 'offline', '14:12', 'c3'],
  ['B 903 ADV', 'Renault Megane', 'Location unavailable', null, 'offline', '13:56', 'c1'],
  ['B 168 LED', 'Dacia Jogger', 'Floreasca', [26.1073, 44.4721], 'broadcasting', '14:30', 'c3'],
  ['B 274 ADV', 'Toyota Corolla', 'Eroilor', [26.0765, 44.4353], 'broadcasting', '14:29', 'c2'],
  ['B 389 LED', 'Škoda Octavia', 'Fleet depot · Vitan', [26.1324, 44.4133], 'idle', '14:26', null],
]

export const vehicles: Vehicle[] = seeds.map(([registration, model, area, coordinates, status, lastContact, observedCampaignId], index) => ({
  id: `v${index + 1}`, registration, model, area, coordinates, driverId: `d${index + 1}`,
  screen: { id: `LED-${String(index + 1).padStart(3, '0')}`, status, lastContact, resolution: '1920 × 640 px', observedCampaignId },
  issue: status === 'offline'
    ? { severity: 'critical', title: 'Screen disconnected', description: 'The screen has stopped reporting. Playback cannot be confirmed until the device reconnects.', since: lastContact }
    : status === 'syncing'
      ? { severity: 'warning', title: 'Creative sync delayed', description: 'The latest creative has been waiting to sync since 14:22. The previous creative remains the last confirmed content.', since: '14:22' }
      : null,
}))

export const initialAssignments: Assignment[] = vehicles.flatMap(vehicle => vehicle.screen.observedCampaignId
  ? [{ vehicleId: vehicle.id, campaignId: vehicle.screen.observedCampaignId }] : [])

export const statusLabels: Record<ScreenStatus, string> = {
  broadcasting: 'Broadcasting', syncing: 'Sync delayed', offline: 'Offline', idle: 'Standby',
}

export function driverFor(vehicle: Vehicle) {
  return drivers.find(driver => driver.id === vehicle.driverId)!
}

export function campaignFor(id: string | null | undefined) {
  return campaigns.find(campaign => campaign.id === id)
}

export function assignedCampaign(vehicleId: string, assignments: Assignment[]) {
  return campaignFor(assignments.find(assignment => assignment.vehicleId === vehicleId)?.campaignId)
}

export function matchesVehicle(vehicle: Vehicle, query: string, status: string, campaignId: string, assignments: Assignment[]) {
  const search = query.trim().toLocaleLowerCase()
  const haystack = `${vehicle.registration} ${driverFor(vehicle).name}`.toLocaleLowerCase()
  return (!search || haystack.includes(search))
    && (status === 'all' || (status === 'attention' ? !!vehicle.issue : vehicle.screen.status === status))
    && (campaignId === 'all' || assignedCampaign(vehicle.id, assignments)?.id === campaignId)
}
