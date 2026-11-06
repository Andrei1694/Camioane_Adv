import Pagination from '../../../components/Pagination'
import { formatCount, formatLocalDay, formatLocalTime, plural } from '../../../lib/format'
import type { RoutePageData, SavedRoute } from '../../../lib/route'
import { routePageSize } from '../useRouteEditor'

export default function SavedRoutes({ data, loading, error, busy, selectedId, offset, onPage, onRetry, onOpen, onDelete }: {
  data: RoutePageData | undefined
  loading: boolean
  error: string
  busy: boolean
  selectedId: string | undefined
  offset: number
  onPage: (offset: number) => void
  onRetry: () => void
  onOpen: (route: SavedRoute) => void
  onDelete: (route: SavedRoute) => void
}) {
  return <section id="saved-routes" className="saved-routes" aria-labelledby="saved-routes-heading" aria-busy={loading || busy}>
    <div className="route-section-heading">
      <h2 id="saved-routes-heading">Saved routes</h2>
      <button type="button" disabled={busy || loading} onClick={onRetry}>Refresh</button>
    </div>
    <p className="route-help">Shared with all administrators. Opening a route recalculates its road path.</p>
    {error && <p className="request-error" role="alert">{error} <button type="button" disabled={busy || loading} onClick={onRetry}>Retry</button></p>}
    <div className="saved-routes-table-frame">
      <table className="saved-routes-table">
        <caption>{data ? plural(data.total, 'saved route') : 'Saved routes'}</caption>
        <thead><tr><th scope="col">Route name</th><th scope="col" className="num">Stops</th><th scope="col">Updated</th><th scope="col">Actions</th></tr></thead>
        <tbody>
          {data?.routes.map((route) => <tr key={route.id} aria-current={route.id === selectedId ? 'true' : undefined}>
            <th scope="row">{route.name}{route.id === selectedId && <span className="cell-sub">Open in editor</span>}</th>
            <td className="num">{formatCount(route.waypoints.length)}</td>
            <td><time dateTime={route.updatedAt}>{formatLocalDay(route.updatedAt)}<span className="cell-sub">{formatLocalTime(route.updatedAt)}</span></time></td>
            <td><div className="saved-route-actions">
              <button type="button" disabled={busy} onClick={() => onOpen(route)} aria-label={`Open ${route.name}`}>Open</button>
              <button type="button" className="route-delete" disabled={busy} onClick={() => onDelete(route)} aria-label={`Delete ${route.name}`}>Delete</button>
            </div></td>
          </tr>)}
          {!data?.routes.length && <tr><td colSpan={4} className="route-library-empty">
            {loading ? 'Loading saved routes…' : error ? 'Saved routes could not be loaded.' : 'No saved routes yet. Name your route and add at least two stops to save it.'}
          </td></tr>}
        </tbody>
      </table>
    </div>
    {data && <Pagination offset={offset} pageSize={routePageSize} total={data.total} label="Saved route pages" onPage={(next) => { if (!busy) onPage(next) }} />}
  </section>
}
