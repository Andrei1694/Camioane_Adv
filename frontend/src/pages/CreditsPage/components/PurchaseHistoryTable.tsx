import OwnerLabel from '../../../components/OwnerLabel'
import Pagination from '../../../components/Pagination'
import { purchaseStatusPills } from '../../../lib/credit'
import type { CreditPurchase } from '../../../lib/credit'
import { formatCount, formatLocalDay, formatLocalTime, money, plural } from '../../../lib/format'
import { pageSize } from '../creditsData'
import type { ListView } from '../creditsData'
import TableState from './TableState'

function Stamp({ iso }: { iso: string | null }) {
  if (iso === null) return <span className="missing">—<span className="sr-only">Încă nu</span></span>
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
    ? `${plural(view.total, 'achiziție', 'achiziții')}${view.refreshing ? ' · Se actualizează…' : ''}`
    : view.status === 'loading' ? 'Se încarcă achizițiile…' : 'Achiziții'

  return (
    <div className="credits-frame">
      <table className="credits-table purchases-table">
        <caption className={view.status === 'error' ? 'sr-only' : undefined}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Cont</th>
            <th className="col-when" scope="col">Solicitată</th>
            <th className="col-when" scope="col">Finalizată</th>
            <th className="col-credits num" scope="col">Credite</th>
            <th className="col-money num" scope="col">Sumă</th>
          </tr>
        </thead>
        <tbody>
          <TableState view={view} colSpan={5} what="achiziții" onRetry={onRetry}
            empty={view.status === 'ready' && view.total > 0 ? 'Nu există achiziții pe această pagină.'
              : filtered ? 'Nu există încă achiziții pentru acest cont.' : 'Nu există încă achiziții.'} />
          {view.status === 'ready' && view.rows.map((purchase) => {
            const pill = purchaseStatusPills[purchase.status]
            const amount = money(purchase.amountMinor, purchase.currency)
            return (
              <tr key={purchase.id}>
                <th className="account-cell" scope="row">
                  <span className="account-line"><OwnerLabel ownerId={purchase.userId} /> <span className={`pill pill-${pill.tone}`}>{pill.label}</span></span>
                  {purchase.reference !== null && <span className="cell-sub">Ref. <span className="reference">{purchase.reference}</span></span>}
                </th>
                <td className="when-cell stack-line"><span className="stack-label">Solicitată </span><Stamp iso={purchase.createdAt} /></td>
                <td className="when-cell settled-cell stack-line"><span className="stack-label">Finalizată </span><Stamp iso={purchase.settledAt} /></td>
                <td className="num stack-lead">{formatCount(purchase.credits)}<span className="unit"> cr</span></td>
                <td className="num stack-pair">{amount.value}<span className="unit"> {amount.unit}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {view.status === 'ready' && <Pagination offset={offset} pageSize={pageSize} total={view.total} label="Pagini cu achiziții" onPage={onPage} />}
    </div>
  )
}
