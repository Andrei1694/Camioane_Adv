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
  loading: 'Se încarcă harta…',
  'map-error': 'Harta nu este disponibilă',
  calculating: 'Se calculează traseul…',
  ready: 'Traseu calculat',
  failed: 'Traseul nu este disponibil',
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
    : builder.waypoints.length === 1 ? 'Adaugă o destinație pentru a calcula traseul.' : 'Adaugă cel puțin două opriri pentru a calcula un traseu.'

  useEffect(() => {
    // A rendered <title> would adopt index.html's title element and delete it on unmount.
    const previous = document.title
    document.title = 'Planificator de trasee · Camioane App'
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
          <h1 id="route-builder-heading">Planificator de trasee</h1>
          <p className="page-description">Planifică un traseu rutier și salvează opririle pentru echipa ta.</p>
        </div>
        <div className="route-heading-actions">
          <button type="button" disabled={disabled} onClick={() => { if (editor.newRoute()) nameRef.current?.focus() }}>Traseu nou</button>
          <button type="button" aria-expanded={editor.libraryOpen} aria-controls="saved-routes" disabled={disabled}
            onClick={() => editor.setLibraryOpen(!editor.libraryOpen)}>Trasee salvate</button>
          <button type="button" disabled={!builder.route || disabled}
            onClick={() => { if (builder.route) exportRoute(builder.route, builder.waypoints) }}>Exportă GeoJSON</button>
          <button type="submit" form="route-save-form" className="primary-button" aria-describedby="route-save-help"
            disabled={disabled || Boolean(editor.validation) || editor.missing || !editor.dirty}>Salvează traseul</button>
        </div>
      </div>

      {editor.libraryOpen && <SavedRoutes data={editor.list.data} loading={editor.list.isFetching} busy={disabled}
        error={editor.list.isError ? errorMessage(editor.list.error) : ''} selectedId={editor.saved?.id}
        offset={editor.offset} onPage={editor.setOffset} onRetry={() => void editor.list.refetch()}
        onOpen={(route) => void openRoute(route.id)} onDelete={(route) => void editor.deleteRoute(route)} />}

      <div className="route-save-panel">
        <form id="route-save-form" className="route-name-form" onSubmit={(event) => { event.preventDefault(); void saveRoute() }}>
          <div className="form-field">
            <label htmlFor="route-name">Numele traseului</label>
            <input id="route-name" ref={nameRef} value={editor.name} required maxLength={maxRouteNameLength} disabled={disabled}
              aria-describedby="route-save-help" onChange={(event) => editor.setName(event.target.value)} placeholder="Centrul Bucureștiului" />
          </div>
          <p className="route-save-state" role="status">{editor.pending || (editor.missing ? 'Traseul salvat a fost șters' : editor.dirty ? 'Modificări nesalvate' : editor.saved ? 'Salvat' : 'Traseu nou')}</p>
        </form>
        <p id="route-save-help" className="route-help">{editor.validation || 'Gata de salvare. Numele și opririle sunt disponibile tuturor administratorilor.'} Salvarea nu necesită calcularea cu succes a drumului.</p>
        {editor.failure && <div className="route-error" role="alert">
          <p>{editor.failure}</p>
          {editor.conflict && !editor.missing && editor.saved && <button type="button" disabled={disabled} onClick={() => { if (editor.saved) void openRoute(editor.saved.id) }}>Reîncarcă traseul</button>}
          {editor.missing && <button type="button" disabled={disabled || Boolean(editor.validation)} onClick={() => void saveRoute(true)}>Salvează ca traseu nou</button>}
        </div>}
      </div>

      <div className="route-workspace">
        <div className="route-planner">
          <StopsPanel points={builder.waypoints} disabled={disabled} onChange={builder.setStops} onFocus={builder.focusStop} />
          <section className="route-summary" aria-labelledby="summary-heading" aria-busy={builder.phase === 'calculating'}>
            <h2 id="summary-heading">Rezumatul traseului</h2>
            <p className="route-status" role="status" ref={statusRef} tabIndex={-1}>{status}</p>
            {builder.route && <dl className="route-totals">
              <div><dt>Distanță</dt><dd>{formatDistance(builder.route.distance)}</dd></div>
              <div><dt>Durată de condus</dt><dd>{formatDuration(builder.route.duration)}</dd></div>
            </dl>}
            {builder.routeError && <div className="route-error" role="alert">
              <p>{builder.routeError}</p>
              <button type="button" disabled={disabled} onClick={() => act(() => builder.setStops(builder.waypoints), statusRef)}>Recalculează traseul</button>
            </div>}
            <p className="route-help">Se calculează doar traseul rutier. Nu sunt luate în calcul înălțimea, greutatea sau restricțiile de acces ale camioanelor. Durata de condus nu include traficul și pauzele.</p>
          </section>
        </div>

        <div className="route-map-panel">
          <div className="route-map-toolbar">
            <span>Harta traseului</span>
            <div>
              <button type="button" onClick={builder.fitRoute} disabled={disabled || mapUnavailable || !builder.waypoints.length}>Încadrează traseul</button>
              <button type="button" onClick={() => builder.setStops(builder.waypoints.toReversed())}
                disabled={disabled || builder.waypoints.length < 2}>Inversează</button>
              <button type="button" ref={undoButton} onClick={() => act(builder.undo, clearButton)} disabled={disabled || !builder.canUndo}>Anulează ultima acțiune</button>
              <button type="button" ref={clearButton} onClick={() => act(() => builder.setStops([], true), undoButton)}
                disabled={disabled || !builder.waypoints.length}>Golește</button>
            </div>
          </div>
          <div className="route-map-area">
            <div className="route-map" ref={containerRef} inert={disabled} />
            {builder.phase === 'loading' && <p className="map-notice">Se încarcă harta…</p>}
            {builder.mapError && <div className="map-notice" role="alert">
              <p>{builder.mapError}</p>
              <button type="button" disabled={disabled} onClick={() => act(builder.retryMap, statusRef)}>Reîncarcă harta</button>
            </div>}
          </div>
          <p className="route-map-hint">Fă clic pentru a adăuga o oprire. Trage un punct pentru a-l muta sau trage traseul pentru a adăuga o oprire pe drum. Fă clic pe un punct pentru a-l elimina; poți anula apoi ultima acțiune.</p>
        </div>
      </div>
      <p className="route-draft-note">Modificările nefinalizate rămân în această filă pentru contul tău. Salvarea traseului face numele și opririle disponibile administratorilor; deschiderea lui recalculează drumul. Exportul GeoJSON descarcă drumul calculat în prezent.</p>
    </section>
  )
}
