import StopsPanel from './components/StopsPanel'
import { exportRoute, formatDistance, formatDuration } from './route'
import useRouteMap from './useRouteMap'
import 'maplibre-gl/dist/maplibre-gl.css'
import './RouteBuilderPage.css'

export default function RouteBuilderPage() {
  const { containerRef, ...builder } = useRouteMap()
  const disabled = !builder.ready || builder.busy
  const status = builder.busy ? 'Calculating route…'
    : builder.route ? 'Route ready'
      : builder.routeError ? 'Route unavailable'
        : builder.waypoints.length === 1 ? 'Add a destination to calculate the route.' : 'Add at least two stops to calculate a route.'

  return (
    <section className="route-builder" aria-labelledby="route-builder-heading">
      <title>Route builder · Camioane App</title>
      <div className="page-heading route-page-heading">
        <div>
          <h1 id="route-builder-heading">Route builder</h1>
          <p className="page-description">Plan a road route, stop by stop.</p>
        </div>
        <button type="button" className="primary-button" disabled={!builder.route || builder.busy}
          onClick={() => { if (builder.route) exportRoute(builder.route, builder.waypoints) }}>
          Export GeoJSON
        </button>
      </div>

      <div className="route-workspace">
        <div className="route-planner">
          <StopsPanel points={builder.waypoints} disabled={disabled} onChange={builder.setStops} onFocus={builder.focusStop} />
          <section className="route-summary" aria-labelledby="summary-heading" aria-busy={builder.busy}>
            <h2 id="summary-heading">Route summary</h2>
            <p className="route-status" role="status">{status}</p>
            {builder.route && <dl className="route-totals">
              <div><dt>Distance</dt><dd>{formatDistance(builder.route.distance)}</dd></div>
              <div><dt>Driving time</dt><dd>{formatDuration(builder.route.duration)}</dd></div>
            </dl>}
            {builder.routeError && <div className="route-error" role="alert">
              <p>{builder.routeError}</p>
              <button type="button" disabled={disabled} onClick={() => builder.setStops(builder.waypoints)}>Retry route</button>
            </div>}
            <p className="route-help">Road routing only. Truck height, weight and access restrictions are not included. Driving time excludes traffic and breaks.</p>
          </section>
        </div>

        <div className="route-map-panel">
          <div className="route-map-toolbar">
            <span>Route map</span>
            <div>
              <button type="button" onClick={builder.fitRoute} disabled={!builder.ready || !builder.waypoints.length}>Fit route</button>
              <button type="button" onClick={() => builder.setStops([...builder.waypoints].reverse())}
                disabled={disabled || builder.waypoints.length < 2}>Reverse</button>
              <button type="button" onClick={() => builder.setStops([])} disabled={disabled || !builder.waypoints.length}>Clear</button>
            </div>
          </div>
          <div className="route-map-area">
            <div className="route-map" ref={containerRef} />
            {!builder.ready && !builder.mapError && <p className="map-notice" role="status">Loading map…</p>}
            {builder.mapError && <div className="map-notice" role="alert">
              <p>{builder.mapError}</p>
              <button type="button" onClick={builder.retryMap}>Retry map</button>
            </div>}
          </div>
          <p className="route-map-hint">Click to add a stop. Drag a point to move it, or drag the route to add a stop along the way. Click a point to remove it.</p>
        </div>
      </div>
      <p className="route-draft-note">This route stays open while you work on this page. Export it before leaving to keep a copy.</p>
    </section>
  )
}
