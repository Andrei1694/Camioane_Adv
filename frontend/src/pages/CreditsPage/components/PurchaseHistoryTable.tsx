import OwnerLabel from '../../../components/OwnerLabel'
import Pagination from '../../../components/Pagination'
import { purchaseStatusPills } from '../../../lib/credit'
import type { CreditPurchase } from '../../../lib/credit'
import { formatCount, formatLocalDay, formatLocalTime, money, plural } from '../../../lib/format'
import { pageSize } from '../creditsData'
import type { ListView } from '../creditsData'
import TableState from './TableState'

function Stamp({ iso }: { iso: string | null }) {
  if (iso === null) return <span className="missing">—<span className="sr-only">Not yet</span></span>
  return <time dateTime={iso}>{formatLocalDay(iso)}<span className="cell-sub">{formatLocalTime(iso)}</span></time>
}

/** Every purchase in any state, newest first, with how and when it was settled. */
export default function PurchaseHistoryTable({ view, offset, filtered, onRetry, onPage }: {
  view: ListView<CreditPurchase>
  offset: number
  filtered: boolean
  onRetry: () => void
  onPage: (offset: number) => void
}) {
  const caption = view.status === 'ready'
    ? `${plural(view.total, 'purchase')}${view.refreshing ? ' · Refreshing…' : ''}`
    : view.status === 'loading' ? 'Loading purchases…' : 'Purchases'

  return (
    <div className="credits-frame">
      <table className="credits-table purchases-table">
        <caption className={view.status === 'error' ? 'sr-only' : undefined}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Account</th>
            <th className="col-when" scope="col">Requested</th>
            <th className="col-when" scope="col">Settled</th>
            <th className="col-credits num" scope="col">Credits</th>
            <th className="col-money num" scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          <TableState view={view} colSpan={5} what="purchases" onRetry={onRetry}
            empty={view.status === 'ready' && view.total > 0 ? 'No purchases on this page.'
              : filtered ? 'No purchases for this account yet.' : 'No purchases yet.'} />
          {view.status === 'ready' && view.rows.map((purchase) => {
            const pill = purchaseStatusPills[purchase.status]
            const amount = money(purchase.amountMinor, purchase.currency)
            return (
              <tr key={purchase.id}>
                <th className="account-cell" scope="row">
                  <span className="account-line"><OwnerLabel ownerId={purchase.userId} /> <span className={`pill pill-${pill.tone}`}>{pill.label}</span></span>
                  {purchase.reference !== null && <span className="cell-sub">Ref <span className="reference">{purchase.reference}</span></span>}
                </th>
                <td className="when-cell stack-line"><span className="stack-label">Requested </span><Stamp iso={purchase.createdAt} /></td>
                <td className="when-cell settled-cell stack-line"><span className="stack-label">Settled </span><Stamp iso={purchase.settledAt} /></td>
                <td className="num stack-lead">{formatCount(purchase.credits)}<span className="unit"> cr</span></td>
                <td className="num stack-pair">{amount.value}<span className="unit"> {amount.unit}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {view.status === 'ready' && <Pagination offset={offset} pageSize={pageSize} total={view.total} label="Purchase pages" onPage={onPage} />}
    </div>
  )
}
