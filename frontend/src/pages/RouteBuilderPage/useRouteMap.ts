import { useEffect, useRef, useState } from 'react'
import type { ExpressionSpecification } from 'maplibre-gl'
import { LngLatBounds, Map, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import MapLibreGlDirections, { layersFactory, utils } from '@maplibre/maplibre-gl-directions'
import type { AnyMapLibreGlDirectionsEvent, Directions, MapLibreGlDirectionsConfiguration } from '@maplibre/maplibre-gl-directions'
import type { Coordinate, RouteResult } from './route'
import { isCoordinate, loadDraft, mapStyle, readRoute, routingApi, saveDraft } from './route'

setWorkerUrl(workerUrl)

const sourceName = 'route-builder'
const routeLayers = ['snapline', 'routeline', 'routeline-casing', 'alt-routeline', 'alt-routeline-casing', 'snappoint', 'snappoint-casing']

export type RoutePhase = 'loading' | 'map-error' | 'idle' | 'calculating' | 'ready' | 'failed'

const placementError = 'No route could be calculated. Move your stops closer to a road or retry.'
const unavailableError = 'The routing service is unavailable right now. Retry in a moment.'

class RoutingError extends Error {}

interface RoutingListener {
  start: () => void
  end: (route: RouteResult | null, error: string) => void
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isDirections(value: unknown): value is Directions {
  return typeof value === 'object' && value !== null && 'code' in value && value.code === 'Ok'
    && 'routes' in value && Array.isArray(value.routes) && 'waypoints' in value && Array.isArray(value.waypoints)
}

class RoadDirections extends MapLibreGlDirections {
  private readonly listener: RoutingListener
  private latestRequest = 0
  private response: Directions | undefined

  constructor(map: Map, configuration: Partial<MapLibreGlDirectionsConfiguration>, listener: RoutingListener) {
    super(map, configuration)
    this.listener = listener
  }

  // A provider with regional coverage must not silently snap a stop to a distant road.
  protected override buildRequest: typeof utils.buildRequest = (configuration, points, bearings) => utils.buildRequest({
    ...configuration,
    requestOptions: { ...configuration.requestOptions, radiuses: points.map(() => '1000').join(';') },
  }, points, bearings)

  // The plugin reports every failure the same way, so read the HTTP status and OSRM code here.
  protected override async fetch({ url, payload }: utils.RequestData): Promise<Directions> {
    const response = await fetch(`${url}?${payload}`, { signal: this.abortController?.signal })
    const body: unknown = await response.json().catch((error: unknown) => {
      if (isAbort(error)) throw error
      return undefined
    })
    if (isDirections(body)) {
      this.response = body
      return body
    }
    const code = typeof body === 'object' && body !== null && 'code' in body ? body.code : undefined
    throw new RoutingError(response.status === 429 ? 'The routing service is busy. Wait a moment, then retry.'
      : code === 'NoSegment' || code === 'NoRoute' ? placementError : unavailableError)
  }

  // Settles once the plugin has drawn the result. A request replaced by a newer one never settles.
  protected override async fetchDirections(originalEvent: AnyMapLibreGlDirectionsEvent) {
    const request = ++this.latestRequest
    const routing = this.waypoints.length >= 2
    if (routing) this.listener.start()
    let error = ''
    try {
      await super.fetchDirections(originalEvent)
    } catch (cause) {
      error = cause instanceof RoutingError ? cause.message
        : isAbort(cause) ? 'The routing service took too long to respond. Retry in a moment.'
          : cause instanceof TypeError ? 'The routing service could not be reached. Check your connection and retry.'
            : unavailableError
    }
    if (request !== this.latestRequest) return
    if (error || !routing) return this.listener.end(null, error)
    const route = readRoute(this.response?.routes[0])
    this.listener.end(route, route ? '' : placementError)
  }
}

export default function useRouteMap(userId: string) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const directionsRef = useRef<MapLibreGlDirections | null>(null)
  const [draft] = useState(() => loadDraft(userId))
  const savedWaypoints = useRef<Coordinate[]>(draft)
  const [revision, setRevision] = useState(0)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mapError, setMapError] = useState('')
  const [routeError, setRouteError] = useState('')
  const [waypoints, setWaypoints] = useState<Coordinate[]>(draft)
  const [undoPoints, setUndoPoints] = useState<Coordinate[] | null>(null)
  const [route, setRoute] = useState<RouteResult | null>(null)
  const phase: RoutePhase = mapError ? 'map-error' : !ready ? 'loading' : busy ? 'calculating' : route ? 'ready' : routeError ? 'failed' : 'idle'

  // The draft outlives a remount (navigation, sign-out, reload) for this tab and user.
  useEffect(() => saveDraft(userId, waypoints), [userId, waypoints])

  useEffect(() => {
    if (!containerRef.current) return
    const lifetime = new AbortController()
    let map: Map | undefined
    let directions: MapLibreGlDirections | undefined
    let loaded = false
    const loadTimeout = setTimeout(() => {
      if (!lifetime.signal.aborted && !loaded) setMapError('The map is taking too long to load. Check your connection and retry.')
    }, 20_000)

    try {
      map = new Map({
        container: containerRef.current,
        style: mapStyle,
        center: [25, 45.9],
        zoom: 5.8,
        maxZoom: 18,
        renderWorldCopies: false,
        attributionControl: { compact: true },
      })
      const currentMap = map
      mapRef.current = map
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
      map.getCanvas().setAttribute('aria-label', 'Route map. Use the stop form to enter coordinates with a keyboard.')
      map.on('error', () => {
        // After load, a failed tile leaves the map usable, so only a failure before load blocks it.
        if (!lifetime.signal.aborted && !loaded) setMapError('Some map data could not be loaded. Check your connection or retry the map.')
      })
      map.on('load', () => {
        if (lifetime.signal.aborted) return
        loaded = true
        clearTimeout(loadTimeout)
        try {
          // Keep the plugin's hit areas and drag behavior, using the app's colors.
          const style = getComputedStyle(currentMap.getContainer())
          const color = (name: string) => style.getPropertyValue(name).trim()
          const accent = color('--focus')
          const highlighted = (base: string): ExpressionSpecification => ['case', ['boolean', ['get', 'highlight'], false], color('--text'), base]
          const layers = layersFactory(0.8, 1, sourceName).map((layer) => {
            if (layer.type === 'line') return { ...layer, paint: { ...layer.paint, 'line-color': layer.id.includes('alt-') || layer.id.endsWith('snapline') ? '#646464' : accent } }
            // Grey snapped road positions stay distinct from the stops; both darken on hover.
            if (layer.type === 'circle') return { ...layer, paint: { ...layer.paint, 'circle-color': highlighted(layer.id.includes('snappoint') ? color('--muted') : accent) } }
            return layer
          })
          // Number the stops as in the list, with a font the map style already serves.
          const fonts = currentMap.getStyle().layers.flatMap((layer) => layer.type === 'symbol' && Array.isArray(layer.layout?.['text-font']) ? [layer.layout['text-font']] : [])
          const font = fonts.find((stack) => String(stack[0]).includes('Regular')) ?? fonts[0]
          if (font) layers.push({
            id: `${sourceName}-waypoint-label`,
            type: 'symbol',
            source: sourceName,
            filter: ['==', ['get', 'type'], 'WAYPOINT'],
            layout: {
              'text-field': ['to-string', ['+', ['get', 'index'], 1]],
              'text-font': font,
              'text-size': 13,
              'text-anchor': 'left',
              'text-offset': [0.9, 0],
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            },
            paint: { 'text-color': color('--text'), 'text-halo-color': color('--surface'), 'text-halo-width': 2 },
          })

          function showRoute(visible: boolean) {
            for (const name of routeLayers) currentMap.setLayoutProperty(`${sourceName}-${name}`, 'visibility', visible ? 'visible' : 'none')
          }

          directions = new RoadDirections(currentMap, {
            api: routingApi,
            profile: 'driving',
            requestOptions: { geometries: 'geojson', overview: 'full', alternatives: 'false', steps: 'false' },
            requestTimeout: 15_000,
            sourceName,
            layers,
            sensitiveWaypointLayers: [`${sourceName}-waypoint`, `${sourceName}-waypoint-casing`],
            sensitiveSnappointLayers: [`${sourceName}-snappoint`, `${sourceName}-snappoint-casing`],
            sensitiveRoutelineLayers: [`${sourceName}-routeline`, `${sourceName}-routeline-casing`],
            sensitiveAltRoutelineLayers: [`${sourceName}-alt-routeline`, `${sourceName}-alt-routeline-casing`],
          }, {
            start() {
              if (lifetime.signal.aborted) return
              setBusy(true)
              setRoute(null)
              setRouteError('')
            },
            end(result, error) {
              if (lifetime.signal.aborted) return
              setRoute(result)
              setRouteError(error)
              showRoute(result !== null)
              setBusy(false)
            },
          })
          const currentDirections = directions
          directionsRef.current = directions

          function syncWaypoints(undoable = false) {
            if (lifetime.signal.aborted) return
            const points = currentDirections.waypoints
            setUndoPoints(undoable ? savedWaypoints.current : null)
            savedWaypoints.current = points
            setWaypoints(points)
            setRoute(null)
            setRouteError('')
            showRoute(false)
          }
          directions.on('addwaypoint', () => syncWaypoints())
          directions.on('removewaypoint', () => syncWaypoints(true))
          directions.on('movewaypoint', () => syncWaypoints())
          directions.on('setwaypoints', () => syncWaypoints())
          directions.interactive = true
          setMapError('')
          setReady(true)
          if (savedWaypoints.current.length) void directions.setWaypoints(savedWaypoints.current)
        } catch {
          setMapError('The route map could not be initialized. Retry the map.')
        }
      })
    } catch {
      clearTimeout(loadTimeout)
      queueMicrotask(() => {
        if (!lifetime.signal.aborted) setMapError('The map could not start. Check that WebGL is available in your browser, then retry.')
      })
    }

    const resize = new ResizeObserver(() => map?.resize())
    resize.observe(containerRef.current)
    return () => {
      lifetime.abort()
      clearTimeout(loadTimeout)
      resize.disconnect()
      directionsRef.current = null
      mapRef.current = null
      directions?.destroy()
      map?.remove()
    }
  }, [revision])

  // A newer change replaces a calculation in progress, so editing never has to wait.
  function setStops(points: Coordinate[], undoable = false) {
    if (!directionsRef.current || !points.every(isCoordinate)) return
    const previous = savedWaypoints.current
    void directionsRef.current.setWaypoints(points)
    if (undoable) setUndoPoints(previous)
  }

  function fitRoute() {
    const points = route?.coordinates ?? waypoints
    if (!mapRef.current || !points.length) return
    const bounds = points.reduce((box, point) => box.extend(point), new LngLatBounds(points[0], points[0]))
    mapRef.current.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 })
  }

  return {
    containerRef, phase, mapError, routeError, waypoints, route, setStops, fitRoute,
    canUndo: undoPoints !== null,
    undo: () => {
      if (undoPoints) setStops(undoPoints)
    },
    retryMap: () => {
      setReady(false)
      setMapError('')
      setRouteError('')
      setRoute(null)
      setBusy(false)
      setRevision((value) => value + 1)
    },
    focusStop: (point: Coordinate) => {
      const map = mapRef.current
      map?.jumpTo({ center: point, zoom: Math.max(map.getZoom(), 13) })
    },
  }
}
