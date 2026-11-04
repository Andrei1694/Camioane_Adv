import type { ListView } from '../creditsData'

/** The one row a table shows while it can't show data: the error with its retry, or the empty state. */
export default function TableState<T>({ view, colSpan, what, empty, errorId, onRetry }: {
  view: ListView<T>
  colSpan: number
  /** What failed to load, for "Couldn't load …". */
  what: string
  empty: string
  errorId?: string
  onRetry: () => void
}) {
  if (view.status === 'error') return (
    <tr>
      <td className="state-cell" colSpan={colSpan}>
        <div className="request-error" role="alert">
          <p id={errorId}>Couldn't load {what}. {view.error}</p>
          <button type="button" disabled={view.retrying} onClick={onRetry}>{view.retrying ? 'Retrying…' : 'Retry'}</button>
        </div>
      </td>
    </tr>
  )
  if (view.status === 'ready' && view.rows.length === 0) return (
    <tr>
      <td className="state-cell" colSpan={colSpan}><p className="empty-state">{empty}</p></td>
    </tr>
  )
  return null
}
