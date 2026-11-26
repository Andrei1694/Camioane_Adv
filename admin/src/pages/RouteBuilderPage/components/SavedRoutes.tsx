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
      <h2 id="saved-routes-heading">Trasee salvate</h2>
      <button type="button" disabled={busy || loading} onClick={onRetry}>Actualizează</button>
    </div>
    <p className="route-help">Disponibile tuturor administratorilor. Deschiderea unui traseu recalculează drumul.</p>
    {error && <p className="request-error" role="alert">{error} <button type="button" disabled={busy || loading} onClick={onRetry}>Reîncearcă</button></p>}
    <div className="saved-routes-table-frame">
      <table className="saved-routes-table">
        <caption>{data ? plural(data.total, 'traseu salvat', 'trasee salvate') : 'Trasee salvate'}</caption>
        <thead><tr><th scope="col">Numele traseului</th><th scope="col" className="num">Opriri</th><th scope="col">Actualizat</th><th scope="col">Acțiuni</th></tr></thead>
        <tbody>
          {data?.routes.map((route) => <tr key={route.id} aria-current={route.id === selectedId ? 'true' : undefined}>
            <th scope="row">{route.name}{route.id === selectedId && <span className="cell-sub">Deschis în editor</span>}</th>
            <td className="num">{formatCount(route.waypoints.length)}</td>
            <td><time dateTime={route.updatedAt}>{formatLocalDay(route.updatedAt)}<span className="cell-sub">{formatLocalTime(route.updatedAt)}</span></time></td>
            <td><div className="saved-route-actions">
              <button type="button" disabled={busy} onClick={() => onOpen(route)} aria-label={`Deschide ${route.name}`}>Deschide</button>
              <button type="button" className="route-delete" disabled={busy} onClick={() => onDelete(route)} aria-label={`Șterge ${route.name}`}>Șterge</button>
            </div></td>
          </tr>)}
          {!data?.routes.length && <tr><td colSpan={4} className="route-library-empty">
            {loading ? 'Se încarcă traseele salvate…' : error ? 'Traseele salvate nu au putut fi încărcate.' : 'Nu există încă trasee salvate. Dă un nume traseului și adaugă cel puțin două opriri pentru a-l salva.'}
          </td></tr>}
        </tbody>
      </table>
    </div>
    {data && <Pagination offset={offset} pageSize={routePageSize} total={data.total} label="Pagini cu trasee salvate" onPage={(next) => { if (!busy) onPage(next) }} />}
  </section>
}
