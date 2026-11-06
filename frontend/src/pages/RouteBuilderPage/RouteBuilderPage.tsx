import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { flushSync } from 'react-dom'
import { useCurrentUser } from '../../auth/currentUser'
import { errorMessage } from '../../lib/api'
import { maxRouteNameLength } from '../../lib/route'
import SavedRoutes from './components/SavedRoutes'
import StopsPanel from './components/StopsPanel'
import { exportRoute, formatDistance, formatDuration } from './route'
import type { RoutePhase } from './useRouteMap'
import useRouteEditor from './useRouteEditor'
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
  const userId = useCurrentUser().id
  return <RouteBuilder key={userId} userId={userId} />
}

function RouteBuilder({ userId }: { userId: string }) {
  const editor = useRouteEditor(userId)
  const { containerRef, ...builder } = editor.builder
  const nameRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const undoButton = useRef<HTMLButtonElement>(null)
  const clearButton = useRef<HTMLButtonElement>(null)
  const disabled = Boolean(editor.pending)
  const mapUnavailable = builder.phase === 'loading' || builder.phase === 'map-error'
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

  async function openRoute(id: string) {
    if (await editor.openRoute(id)) requestAnimationFrame(() => nameRef.current?.focus())
  }

  async function saveRoute(asNew = false) {
    if (await editor.saveRoute(asNew)) requestAnimationFrame(() => nameRef.current?.focus())
  }

  return (
    <section className="route-builder" aria-labelledby="route-builder-heading">
      <div className="page-heading route-page-heading">
        <div>
          <h1 id="route-builder-heading">Route builder</h1>
          <p className="page-description">Plan a road route and save its stops for your team.</p>
        </div>
        <div className="route-heading-actions">
          <button type="button" disabled={disabled} onClick={() => { if (editor.newRoute()) nameRef.current?.focus() }}>New route</button>
          <button type="button" aria-expanded={editor.libraryOpen} aria-controls="saved-routes" disabled={disabled}
            onClick={() => editor.setLibraryOpen(!editor.libraryOpen)}>Saved routes</button>
          <button type="button" disabled={!builder.route || disabled}
            onClick={() => { if (builder.route) exportRoute(builder.route, builder.waypoints) }}>Export GeoJSON</button>
          <button type="submit" form="route-save-form" className="primary-button" aria-describedby="route-save-help"
            disabled={disabled || Boolean(editor.validation) || editor.missing || !editor.dirty}>Save route</button>
        </div>
      </div>

      {editor.libraryOpen && <SavedRoutes data={editor.list.data} loading={editor.list.isFetching} busy={disabled}
        error={editor.list.isError ? errorMessage(editor.list.error) : ''} selectedId={editor.saved?.id}
        offset={editor.offset} onPage={editor.setOffset} onRetry={() => void editor.list.refetch()}
        onOpen={(route) => void openRoute(route.id)} onDelete={(route) => void editor.deleteRoute(route)} />}

      <div className="route-save-panel">
        <form id="route-save-form" className="route-name-form" onSubmit={(event) => { event.preventDefault(); void saveRoute() }}>
          <div className="form-field">
            <label htmlFor="route-name">Route name</label>
            <input id="route-name" ref={nameRef} value={editor.name} required maxLength={maxRouteNameLength} disabled={disabled}
              aria-describedby="route-save-help" onChange={(event) => editor.setName(event.target.value)} placeholder="Bucharest centre" />
          </div>
          <p className="route-save-state" role="status">{editor.pending || (editor.missing ? 'Saved route deleted' : editor.dirty ? 'Unsaved changes' : editor.saved ? 'Saved' : 'New route')}</p>
        </form>
        <p id="route-save-help" className="route-help">{editor.validation || 'Ready to save. The name and stops are shared with all administrators.'} Saving does not require a successful road calculation.</p>
        {editor.failure && <div className="route-error" role="alert">
          <p>{editor.failure}</p>
          {editor.conflict && !editor.missing && editor.saved && <button type="button" disabled={disabled} onClick={() => { if (editor.saved) void openRoute(editor.saved.id) }}>Reload route</button>}
          {editor.missing && <button type="button" disabled={disabled || Boolean(editor.validation)} onClick={() => void saveRoute(true)}>Save as new</button>}
        </div>}
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
              <button type="button" onClick={builder.fitRoute} disabled={disabled || mapUnavailable || !builder.waypoints.length}>Fit route</button>
              <button type="button" onClick={() => builder.setStops(builder.waypoints.toReversed())}
                disabled={disabled || builder.waypoints.length < 2}>Reverse</button>
              <button type="button" ref={undoButton} onClick={() => act(builder.undo, clearButton)} disabled={disabled || !builder.canUndo}>Undo</button>
              <button type="button" ref={clearButton} onClick={() => act(() => builder.setStops([], true), undoButton)}
                disabled={disabled || !builder.waypoints.length}>Clear</button>
            </div>
          </div>
          <div className="route-map-area">
            <div className="route-map" ref={containerRef} inert={disabled} />
            {builder.phase === 'loading' && <p className="map-notice">Loading map…</p>}
            {builder.mapError && <div className="map-notice" role="alert">
              <p>{builder.mapError}</p>
              <button type="button" disabled={disabled} onClick={() => act(builder.retryMap, statusRef)}>Retry map</button>
            </div>}
          </div>
          <p className="route-map-hint">Click to add a stop. Drag a point to move it, or drag the route to add a stop along the way. Click a point to remove it, then use Undo if needed.</p>
        </div>
      </div>
      <p className="route-draft-note">Unfinished edits stay in this browser tab for your account. Save route shares the name and stops with administrators; opening it recalculates the road path. Export GeoJSON downloads the current calculated path.</p>
    </section>
  )
}
