import { useEffect, useRef, useState } from 'react'
import { LngLatBounds, Map, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import MapLibreGlDirections, { layersFactory, utils } from '@maplibre/maplibre-gl-directions'
import type { Coordinate, RouteResult } from './route'
import { isCoordinate, mapStyle, readRoute, routingApi } from './route'

setWorkerUrl(workerUrl)

const sourceName = 'route-builder'
const routeLayers = ['snapline', 'routeline', 'routeline-casing', 'alt-routeline', 'alt-routeline-casing', 'snappoint', 'snappoint-casing']

class RoadDirections extends MapLibreGlDirections {
  // A provider with regional coverage must not silently snap a stop to a distant road.
  protected override buildRequest: typeof utils.buildRequest = (configuration, points, bearings) => utils.buildRequest({
    ...configuration,
    requestOptions: { ...configuration.requestOptions, radiuses: points.map(() => '1000').join(';') },
  }, points, bearings)
}

export default function useRouteMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const directionsRef = useRef<MapLibreGlDirections | null>(null)
  const savedWaypoints = useRef<Coordinate[]>([])
  const busyRef = useRef(false)
  const [revision, setRevision] = useState(0)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mapError, setMapError] = useState('')
  const [routeError, setRouteError] = useState('')
  const [waypoints, setWaypoints] = useState<Coordinate[]>([])
  const [route, setRoute] = useState<RouteResult | null>(null)

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
        if (!lifetime.signal.aborted) setMapError('Some map data could not be loaded. Check your connection or retry the map.')
      })
      map.on('load', () => {
        if (lifetime.signal.aborted) return
        loaded = true
        clearTimeout(loadTimeout)
        try {
          // Keep the plugin's hit areas and drag behavior, using the app's blue for the route.
          const accent = getComputedStyle(currentMap.getContainer()).getPropertyValue('--focus').trim()
          const layers = layersFactory(0.8, 1, sourceName).map((layer) => {
            if (layer.type === 'line') return { ...layer, paint: { ...layer.paint, 'line-color': layer.id.includes('alt-') || layer.id.endsWith('snapline') ? '#646464' : accent } }
            if (layer.type === 'circle') return { ...layer, paint: { ...layer.paint, 'circle-color': accent } }
            return layer
          })
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
          })
          const currentDirections = directions
          directionsRef.current = directions

          function showRoute(visible: boolean) {
            for (const name of routeLayers) currentMap.setLayoutProperty(`${sourceName}-${name}`, 'visibility', visible ? 'visible' : 'none')
          }
          function syncWaypoints() {
            if (lifetime.signal.aborted) return
            const points = currentDirections.waypoints
            savedWaypoints.current = points
            setWaypoints(points)
            setRoute(null)
            setRouteError('')
            showRoute(false)
          }
          directions.on('addwaypoint', syncWaypoints)
          directions.on('removewaypoint', syncWaypoints)
          directions.on('movewaypoint', syncWaypoints)
          directions.on('setwaypoints', syncWaypoints)
          directions.on('fetchroutesstart', () => {
            if (lifetime.signal.aborted) return
            busyRef.current = true
            setBusy(true)
            setRoute(null)
            setRouteError('')
            currentDirections.interactive = false
          })
          directions.on('fetchroutesend', (event) => {
            // The plugin emits this before finishing its draw. Re-enable editing afterwards.
            queueMicrotask(() => {
              if (lifetime.signal.aborted) return
              const response = event.data.directions
              const result = response?.code === 'Ok' && Array.isArray(response.routes) ? readRoute(response.routes[0]) : null
              setRoute(result)
              setRouteError(result ? '' : 'No route could be calculated. Move your stops closer to a road or retry.')
              showRoute(result !== null)
              busyRef.current = false
              setBusy(false)
              currentDirections.interactive = true
            })
          })
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

  function setStops(points: Coordinate[]) {
    if (!directionsRef.current || busyRef.current || !points.every(isCoordinate)) return
    void directionsRef.current.setWaypoints(points)
  }

  function fitRoute() {
    const points = route?.coordinates ?? waypoints
    if (!mapRef.current || !points.length) return
    const bounds = points.reduce((box, point) => box.extend(point), new LngLatBounds(points[0], points[0]))
    mapRef.current.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 })
  }

  return {
    containerRef, ready, busy, mapError, routeError, waypoints, route, setStops, fitRoute,
    retryMap: () => {
      setReady(false)
      setMapError('')
      setRouteError('')
      setRoute(null)
      setBusy(false)
      busyRef.current = false
      setRevision((value) => value + 1)
    },
    focusStop: (point: Coordinate) => mapRef.current?.jumpTo({ center: point, zoom: 13 }),
  }
}
