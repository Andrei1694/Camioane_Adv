import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { flushSync } from 'react-dom'
import { useCurrentUser } from '../../auth/currentUser'
import StopsPanel from './components/StopsPanel'
import { exportRoute, formatDistance, formatDuration } from './route'
import type { RoutePhase } from './useRouteMap'
import useRouteMap from './useRouteMap'
import 'maplibre-gl/dist/maplibre-gl.css'
import './RouteBuilderPage.css'

const statusText: Record<Exclude<RoutePhase, 'idle'>, string> = {
  loading: 'Loading map…',
  'map-error': 'Map unavailable',
  calculating: 'Calculating route…',
  ready: 'Route ready',
  failed: 'Route unavailable',
}

export default function RouteBuilderPage() {
  const { containerRef, ...builder } = useRouteMap(useCurrentUser().id)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const undoButton = useRef<HTMLButtonElement>(null)
  const clearButton = useRef<HTMLButtonElement>(null)
  const disabled = builder.phase === 'loading' || builder.phase === 'map-error'
  const status = builder.phase !== 'idle' ? statusText[builder.phase]
    : builder.waypoints.length === 1 ? 'Add a destination to calculate the route.' : 'Add at least two stops to calculate a route.'

  useEffect(() => {
    // A rendered <title> would adopt index.html's title element and delete it on unmount.
    const previous = document.title
    document.title = 'Route builder · Camioane App'
    return () => { document.title = previous }
  }, [])

  // Move focus before the clicked control disappears or becomes disabled.
  function act(change: () => void, next: RefObject<HTMLElement | null>) {
    flushSync(change)
    next.current?.focus()
  }

  return (
    <section className="route-builder" aria-labelledby="route-builder-heading">
      <div className="page-heading route-page-heading">
        <div>
          <h1 id="route-builder-heading">Route builder</h1>
          <p className="page-description">Plan a road route, stop by stop.</p>
        </div>
        <button type="button" className="primary-button" disabled={!builder.route}
          onClick={() => { if (builder.route) exportRoute(builder.route, builder.waypoints) }}>
          Export GeoJSON
        </button>
      </div>

      <div className="route-workspace">
        <div className="route-planner">
          <StopsPanel points={builder.waypoints} disabled={disabled} onChange={builder.setStops} onFocus={builder.focusStop} />
          <section className="route-summary" aria-labelledby="summary-heading" aria-busy={builder.phase === 'calculating'}>
            <h2 id="summary-heading">Route summary</h2>
            <p className="route-status" role="status" ref={statusRef} tabIndex={-1}>{status}</p>
            {builder.route && <dl className="route-totals">
              <div><dt>Distance</dt><dd>{formatDistance(builder.route.distance)}</dd></div>
              <div><dt>Driving time</dt><dd>{formatDuration(builder.route.duration)}</dd></div>
            </dl>}
            {builder.routeError && <div className="route-error" role="alert">
              <p>{builder.routeError}</p>
              <button type="button" disabled={disabled} onClick={() => act(() => builder.setStops(builder.waypoints), statusRef)}>Retry route</button>
            </div>}
            <p className="route-help">Road routing only. Truck height, weight and access restrictions are not included. Driving time excludes traffic and breaks.</p>
          </section>
        </div>

        <div className="route-map-panel">
          <div className="route-map-toolbar">
            <span>Route map</span>
            <div>
              <button type="button" onClick={builder.fitRoute} disabled={disabled || !builder.waypoints.length}>Fit route</button>
              <button type="button" onClick={() => builder.setStops(builder.waypoints.toReversed())}
                disabled={disabled || builder.waypoints.length < 2}>Reverse</button>
              <button type="button" ref={undoButton} onClick={() => act(builder.undo, clearButton)} disabled={disabled || !builder.canUndo}>Undo</button>
              <button type="button" ref={clearButton} onClick={() => act(() => builder.setStops([], true), undoButton)}
                disabled={disabled || !builder.waypoints.length}>Clear</button>
            </div>
          </div>
          <div className="route-map-area">
            <div className="route-map" ref={containerRef} />
            {builder.phase === 'loading' && <p className="map-notice">Loading map…</p>}
            {builder.mapError && <div className="map-notice" role="alert">
              <p>{builder.mapError}</p>
              <button type="button" onClick={() => act(builder.retryMap, statusRef)}>Retry map</button>
            </div>}
          </div>
          <p className="route-map-hint">Click to add a stop. Drag a point to move it, or drag the route to add a stop along the way. Click a point to remove it, then use Undo if needed.</p>
        </div>
      </div>
      <p className="route-draft-note">This route is kept in this browser tab, even if you leave the page or sign in again. Export it to keep a copy.</p>
    </section>
  )
}
