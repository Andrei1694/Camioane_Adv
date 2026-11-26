import { useEffect, useRef, useState } from 'react'
import type { ExpressionSpecification } from 'maplibre-gl'
import { LngLatBounds, Map, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import MapLibreGlDirections, { layersFactory, utils } from '@maplibre/maplibre-gl-directions'
import type { AnyMapLibreGlDirectionsEvent, Directions, MapLibreGlDirectionsConfiguration } from '@maplibre/maplibre-gl-directions'
import type { Coordinate, RouteResult } from './route'
import { isCoordinate, mapStyle, readRoute, routingApi } from './route'

setWorkerUrl(workerUrl)

const sourceName = 'route-builder'
const routeLayers = ['snapline', 'routeline', 'routeline-casing', 'alt-routeline', 'alt-routeline-casing', 'snappoint', 'snappoint-casing']

export type RoutePhase = 'loading' | 'map-error' | 'idle' | 'calculating' | 'ready' | 'failed'

const placementError = 'Traseul nu a putut fi calculat. Mută opririle mai aproape de un drum sau reîncearcă.'
const unavailableError = 'Serviciul de calcul al traseelor nu este disponibil momentan. Reîncearcă în câteva clipe.'

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

function fitPoints(map: Map | null, points: Coordinate[]) {
  if (!map || !points.length) return
  const bounds = points.reduce((box, point) => box.extend(point), new LngLatBounds(points[0], points[0]))
  map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 })
}

class RoadDirections extends MapLibreGlDirections {
  private readonly listener: RoutingListener
  private latestRequest = 0
  private response: Directions | undefined

  constructor(map: Map, configuration: Partial<MapLibreGlDirectionsConfiguration>, listener: RoutingListener) {
    super(map, configuration)
    this.listener = listener
  }

  private readResponse() {
    return readRoute(this.response?.routes[0])
  }

  // A provider with regional coverage must not silently snap a stop to a distant road.
  protected override buildRequest: typeof utils.buildRequest = (configuration, points, bearings) => utils.buildRequest({
    ...configuration,
    requestOptions: { ...configuration.requestOptions, radiuses: points.map(() => '1000').join(';') },
  }, points, bearings)

  // The plugin reports every failure the same way, so read the HTTP status and OSRM code here.
  protected override async fetch({ url, payload }: utils.RequestData): Promise<Directions> {
    const request = this.latestRequest
    const signal = this.abortController?.signal
    const response = await fetch(`${url}?${payload}`, { signal })
    const body: unknown = await response.json().catch((error: unknown) => {
      if (isAbort(error)) throw error
      return undefined
    })
    if (signal?.aborted || request !== this.latestRequest) throw new DOMException('Route replaced', 'AbortError')
    if (response.ok && isDirections(body)) {
      this.response = body
      return body
    }
    const code = typeof body === 'object' && body !== null && 'code' in body ? body.code : undefined
    throw new RoutingError(response.status === 429 ? 'Serviciul de calcul al traseelor este ocupat. Așteaptă puțin, apoi reîncearcă.'
      : code === 'NoSegment' || code === 'NoRoute' ? placementError : unavailableError)
  }

  // Settles once the plugin has drawn the result. A request replaced by a newer one never settles.
  protected override async fetchDirections(originalEvent: AnyMapLibreGlDirectionsEvent) {
    const request = ++this.latestRequest
    this.response = undefined
    const routing = this.waypoints.length >= 2
    if (routing) this.listener.start()
    let error = ''
    try {
      await super.fetchDirections(originalEvent)
    } catch (cause) {
      error = cause instanceof RoutingError ? cause.message
        : isAbort(cause) ? 'Serviciul de calcul al traseelor nu a răspuns la timp. Reîncearcă în câteva clipe.'
          : cause instanceof TypeError ? 'Serviciul de calcul al traseelor nu a putut fi contactat. Verifică conexiunea și reîncearcă.'
            : unavailableError
    }
    if (request !== this.latestRequest) return
    if (error || !routing) return this.listener.end(null, error)
    const route = this.readResponse()
    this.listener.end(route, route ? '' : placementError)
  }
}

export default function useRouteMap(initialWaypoints: Coordinate[]) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const directionsRef = useRef<MapLibreGlDirections | null>(null)
  const savedWaypoints = useRef<Coordinate[]>(initialWaypoints)
  const editingLocked = useRef(false)
  const fitOnLoad = useRef(false)
  const hideRoute = useRef<(() => void) | null>(null)
  const [revision, setRevision] = useState(0)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mapError, setMapError] = useState('')
  const [routeError, setRouteError] = useState('')
  const [waypoints, setWaypoints] = useState<Coordinate[]>(initialWaypoints)
  const [undoPoints, setUndoPoints] = useState<Coordinate[] | null>(null)
  const [route, setRoute] = useState<RouteResult | null>(null)
  const phase: RoutePhase = mapError ? 'map-error' : !ready ? 'loading' : busy ? 'calculating' : route ? 'ready' : routeError ? 'failed' : 'idle'

  useEffect(() => {
    if (!containerRef.current) return
    const lifetime = new AbortController()
    let map: Map | undefined
    let directions: MapLibreGlDirections | undefined
    let loaded = false
    const loadTimeout = setTimeout(() => {
      if (!lifetime.signal.aborted && !loaded) setMapError('Încărcarea hărții durează prea mult. Verifică conexiunea și reîncearcă.')
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
        locale: {
          'Map.Title': 'Hartă',
          'Marker.Title': 'Marcaj pe hartă',
          'Popup.Close': 'Închide fereastra',
          'LogoControl.Title': 'Sigla MapLibre',
          'AttributionControl.ToggleAttribution': 'Arată sau ascunde atribuirea',
          'AttributionControl.MapFeedback': 'Feedback despre hartă',
          'NavigationControl.ZoomIn': 'Mărește',
          'NavigationControl.ZoomOut': 'Micșorează',
          'NavigationControl.ResetBearing': 'Trage pentru a roti harta, clic pentru a orienta spre nord',
          'CooperativeGesturesHandler.WindowsHelpText': 'Folosește Ctrl și rotița pentru a mări sau micșora harta',
          'CooperativeGesturesHandler.MacHelpText': 'Folosește ⌘ și derularea pentru a mări sau micșora harta',
          'CooperativeGesturesHandler.MobileHelpText': 'Folosește două degete pentru a deplasa harta',
        },
      })
      const currentMap = map
      mapRef.current = map
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
      map.getCanvas().setAttribute('aria-label', 'Harta traseului. Folosește formularul de oprire pentru a introduce coordonate de la tastatură.')
      map.on('error', () => {
        // After load, a failed tile leaves the map usable, so only a failure before load blocks it.
        if (!lifetime.signal.aborted && !loaded) setMapError('Unele date ale hărții nu au putut fi încărcate. Verifică conexiunea sau reîncarcă harta.')
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
          hideRoute.current = () => showRoute(false)

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
          directions.interactive = !editingLocked.current
          setMapError('')
          setReady(true)
          if (savedWaypoints.current.length) {
            void directions.setWaypoints(savedWaypoints.current)
            if (fitOnLoad.current) fitPoints(currentMap, savedWaypoints.current)
          }
          fitOnLoad.current = false
        } catch {
          setMapError('Harta traseului nu a putut fi inițializată. Reîncarcă harta.')
        }
      })
    } catch {
      clearTimeout(loadTimeout)
      queueMicrotask(() => {
        if (!lifetime.signal.aborted) setMapError('Harta nu a putut porni. Verifică dacă WebGL este disponibil în browser, apoi reîncearcă.')
      })
    }

    const resize = new ResizeObserver(() => map?.resize())
    resize.observe(containerRef.current)
    return () => {
      lifetime.abort()
      clearTimeout(loadTimeout)
      resize.disconnect()
      directionsRef.current = null
      hideRoute.current = null
      mapRef.current = null
      directions?.destroy()
      map?.remove()
    }
  }, [revision])

  // A newer change replaces a calculation in progress, so editing never has to wait.
  function updateStops(points: Coordinate[], undoable = false) {
    if (!points.every(isCoordinate)) return
    const previous = savedWaypoints.current
    // The editor remains usable before the map loads and when WebGL or tiles fail.
    savedWaypoints.current = points.map((point) => [...point])
    setWaypoints(savedWaypoints.current)
    setRoute(null)
    setRouteError('')
    setBusy(false)
    hideRoute.current?.()
    if (directionsRef.current) void directionsRef.current.setWaypoints(savedWaypoints.current)
    setUndoPoints(undoable ? previous : null)
  }

  function setStops(points: Coordinate[], undoable = false) {
    if (!editingLocked.current) updateStops(points, undoable)
  }

  function fitRoute() {
    fitPoints(mapRef.current, route?.coordinates ?? waypoints)
  }

  return {
    containerRef, phase, mapError, routeError, waypoints, route, setStops, fitRoute,
    replaceStops: (points: Coordinate[]) => {
      updateStops(points)
      fitOnLoad.current = !directionsRef.current
      if (directionsRef.current) fitPoints(mapRef.current, points)
    },
    lockEditing: (locked: boolean) => {
      editingLocked.current = locked
      if (directionsRef.current) directionsRef.current.interactive = !locked
    },
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
