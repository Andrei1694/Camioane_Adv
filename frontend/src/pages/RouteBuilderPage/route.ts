import type { Route } from '@maplibre/maplibre-gl-directions'

export type Coordinate = [longitude: number, latitude: number]

export interface RouteResult {
  coordinates: Coordinate[]
  distance: number
  duration: number
}

export const mapStyle = import.meta.env.VITE_MAP_STYLE_URL?.trim() || 'https://tiles.openfreemap.org/styles/positron'
export const routingApi = (import.meta.env.VITE_ROUTING_API_URL?.trim() || 'https://router.project-osrm.org/route/v1').replace(/\/$/, '')

export function isCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length === 2
    && typeof value[0] === 'number' && Number.isFinite(value[0]) && Math.abs(value[0]) <= 180
    && typeof value[1] === 'number' && Number.isFinite(value[1]) && Math.abs(value[1]) <= 85.051129
}

// One draft per tab, kept until the tab closes. Tagged with the user so another account never sees it.
const draftKey = 'camioane.route-draft.v1'

export function loadDraft(userId: string): Coordinate[] {
  try {
    const draft: unknown = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null')
    if (typeof draft === 'object' && draft !== null && 'userId' in draft && draft.userId === userId
      && 'waypoints' in draft && Array.isArray(draft.waypoints) && draft.waypoints.every(isCoordinate)) return draft.waypoints
  } catch {
    // Unreadable or blocked storage starts an empty route.
  }
  return []
}

export function saveDraft(userId: string, waypoints: Coordinate[]) {
  try {
    if (waypoints.length) sessionStorage.setItem(draftKey, JSON.stringify({ userId, waypoints }))
    else sessionStorage.removeItem(draftKey)
  } catch {
    // Full or blocked storage only loses the draft; the page keeps working.
  }
}

export function readRoute(route: Route | undefined): RouteResult | null {
  if (!route || typeof route.geometry !== 'object' || route.geometry === null
    || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2
    || !route.geometry.coordinates.every(isCoordinate)
    || typeof route.distance !== 'number' || !Number.isFinite(route.distance) || route.distance < 0
    || typeof route.duration !== 'number' || !Number.isFinite(route.duration) || route.duration < 0) return null

  return { coordinates: route.geometry.coordinates, distance: route.distance, duration: route.duration }
}

export function formatDistance(metres: number) {
  return `${(metres / 1000).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
}

export function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60)
  if (minutes === 0) return seconds === 0 ? '0 min' : '< 1 min'
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

export function stopLabel(index: number, count: number) {
  return index === 0 ? 'Start' : index === count - 1 ? 'Destination' : `Stop ${index + 1}`
}

export function exportRoute(route: RouteResult, waypoints: Coordinate[]) {
  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Planned route', profile: 'driving', distance_metres: route.distance, duration_seconds: route.duration },
        geometry: { type: 'LineString', coordinates: route.coordinates },
      },
      ...waypoints.map((coordinates, index) => ({
        type: 'Feature',
        properties: { name: stopLabel(index, waypoints.length), order: index + 1 },
        geometry: { type: 'Point', coordinates },
      })),
    ],
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'camioane-route.geojson'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
