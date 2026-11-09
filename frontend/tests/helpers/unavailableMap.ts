import { useRef, useState } from 'react'
import { vi } from 'vitest'
import type { Coordinate } from '../../src/lib/route'
import type useRouteMap from '../../src/pages/RouteBuilderPage/useRouteMap'

export const mapControls = {
  lockEditing: vi.fn<(locked: boolean) => void>(),
  focusStop: vi.fn<(point: Coordinate) => void>(),
  fitRoute: vi.fn(),
  retryMap: vi.fn(),
  undo: vi.fn(),
}

// Keep coordinate editing available while the external map/routing boundary is offline.
export function useUnavailableMap(initial: Coordinate[]): ReturnType<typeof useRouteMap> {
  const [waypoints, setStops] = useState(initial)
  const containerRef = useRef<HTMLDivElement>(null)
  return {
    ...mapControls, containerRef, waypoints, setStops, replaceStops: setStops,
    phase: 'map-error', mapError: 'Map service unavailable', routeError: '',
    route: null, canUndo: false,
  }
}
