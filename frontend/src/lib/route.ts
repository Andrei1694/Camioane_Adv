export type Coordinate = [longitude: number, latitude: number]

export interface RouteInput {
  name: string
  waypoints: Coordinate[]
}

export interface SavedRoute extends RouteInput {
  id: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface RoutePageData {
  routes: SavedRoute[]
  total: number
}

export const routesKey = (revision: number) => ['routes', revision] as const
export const maxRouteNameLength = 200
export const maxRouteStops = 100

export function isCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length === 2
    && typeof value[0] === 'number' && Number.isFinite(value[0]) && Math.abs(value[0]) <= 180
    && typeof value[1] === 'number' && Number.isFinite(value[1]) && Math.abs(value[1]) <= 85.051129
}

export function routeInputError(input: RouteInput) {
  if (!input.name.trim() || input.name.trim().length > maxRouteNameLength || input.name.includes('\0')) {
    return 'Enter a route name with 1–200 characters and no null characters.'
  }
  if (input.waypoints.length < 2 || input.waypoints.length > maxRouteStops || !input.waypoints.every(isCoordinate)) {
    return 'A saved route needs 2–100 valid stops.'
  }
  return ''
}

export function isSavedRoute(value: unknown): value is SavedRoute {
  if (typeof value !== 'object' || value === null) return false
  return 'id' in value && typeof value.id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.id)
    && 'name' in value && typeof value.name === 'string' && value.name === value.name.trim()
    && 'waypoints' in value && Array.isArray(value.waypoints) && value.waypoints.every(isCoordinate)
    && !routeInputError({ name: value.name, waypoints: value.waypoints })
    && 'version' in value && typeof value.version === 'number' && Number.isInteger(value.version)
    && value.version > 0 && value.version <= 2147483647
    && 'createdAt' in value && typeof value.createdAt === 'string' && !Number.isNaN(Date.parse(value.createdAt))
    && 'updatedAt' in value && typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt))
}
