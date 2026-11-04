import OwnerLabel from '../../../components/OwnerLabel'
import Pagination from '../../../components/Pagination'
import { transactionTypeLabels } from '../../../lib/credit'
import type { CreditTransaction } from '../../../lib/credit'
import { formatCount, formatLocalDay, formatLocalTime, formatSignedCount, plural } from '../../../lib/format'
import { pageSize } from '../creditsData'
import type { ListView } from '../creditsData'
import TableState from './TableState'

/** Every credit movement, newest first: what changed each balance, by how much and why. */
export default function LedgerTable({ view, offset, filtered, onRetry, onPage }: {
  view: ListView<CreditTransaction>
  offset: number
  filtered: boolean
  onRetry: () => void
  onPage: (offset: number) => void
}) {
  const caption = view.status === 'ready'
    ? `${plural(view.total, 'movement')}${view.refreshing ? ' · Refreshing…' : ''}`
    : view.status === 'loading' ? 'Loading the ledger…' : 'Ledger'

  return (
    <div className="credits-frame">
      <table className="credits-table ledger-table">
        <caption className={view.status === 'error' ? 'sr-only' : undefined}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Account</th>
            <th className="col-note" scope="col">Note</th>
            <th className="col-when" scope="col">Date</th>
            <th className="col-change num" scope="col">Change</th>
            <th className="col-balance num" scope="col">Balance after</th>
          </tr>
        </thead>
        <tbody>
          <TableState view={view} colSpan={5} what="the ledger" onRetry={onRetry}
            empty={view.status === 'ready' && view.total > 0 ? 'No movements on this page.'
              : filtered ? 'No credit movements for this account yet.' : 'No credit movements yet.'} />
          {view.status === 'ready' && view.rows.map((row) => (
            <tr key={row.id}>
              <th className="account-cell" scope="row">
                <OwnerLabel ownerId={row.userId} />
                <span className="cell-sub">{transactionTypeLabels[row.type]}</span>
              </th>
              <td className="note-cell stack-line">{row.note ?? <span className="missing">—<span className="sr-only">No note</span></span>}</td>
              <td className="when-cell stack-line">
                <time dateTime={row.createdAt}>
                  {formatLocalDay(row.createdAt)}<span className="cell-sub">{formatLocalTime(row.createdAt)}</span>
                </time>
              </td>
              <td className="num stack-lead">{formatSignedCount(row.amount)}<span className="unit"> cr</span></td>
              <td className="num stack-pair">
                <span className="stack-label">balance </span>{formatCount(row.balanceAfter)}<span className="unit"> cr</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {view.status === 'ready' && <Pagination offset={offset} pageSize={pageSize} total={view.total} label="Ledger pages" onPage={onPage} />}
    </div>
  )
}
