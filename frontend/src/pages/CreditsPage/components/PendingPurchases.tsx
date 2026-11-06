import OwnerLabel from '../../../components/OwnerLabel'
import type { CreditPurchase } from '../../../lib/credit'
import { formatCount, formatDuration, formatLocalDay, formatLocalTime, money, plural } from '../../../lib/format'
import type { ListView } from '../creditsData'
import TableState from './TableState'

/** The queue the page leads with: purchases waiting for an admin to check their payment, oldest first. */
export default function PendingPurchases({ view, asOf, describeId, nameOf, onRetry, onReview }: {
  view: ListView<CreditPurchase>
  /** When the list was read; waiting times count to this moment. */
  asOf: number
  /** Put on whatever explains a disabled "Review oldest payment": the loading caption or the error. */
  describeId: string
  nameOf: (userId: string | null) => string
  onRetry: () => void
  onReview: (purchase: CreditPurchase) => void
}) {
  const credits = view.status === 'ready' ? view.rows.reduce((sum, purchase) => sum + purchase.credits, 0) : 0
  const caption = view.status === 'ready'
    ? view.rows.length === 0 ? 'Nicio achiziție în așteptare'
      : `${plural(view.rows.length, 'achiziție', 'achiziții')} · ${formatCount(credits)} cr${view.refreshing ? ' · Se actualizează…' : ''}`
    : view.status === 'loading' ? 'Se încarcă achizițiile…' : 'Achiziții în așteptarea verificării plății'
  const hideCaption = view.status === 'error' || (view.status === 'ready' && view.rows.length === 0)

  return (
    <section className="credits-section" aria-labelledby="pending-title">
      <h2 id="pending-title">În așteptarea verificării plății</h2>
      <div className="credits-frame">
        <table className="credits-table pending-table">
          <caption id={view.status === 'loading' ? describeId : undefined} className={hideCaption ? 'sr-only' : undefined}>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Cont</th>
              <th className="col-when" scope="col">Solicitată</th>
              <th className="col-wait num" scope="col">În așteptare</th>
              <th className="col-credits num" scope="col">Credite</th>
              <th className="col-money num" scope="col">Sumă</th>
              <th className="col-review" scope="col"><span className="sr-only">Acțiuni</span></th>
            </tr>
          </thead>
          <tbody>
            <TableState view={view} colSpan={6} what="achiziții" errorId={describeId} onRetry={onRetry}
              empty="Nicio achiziție în așteptarea verificării plății." />
            {view.status === 'ready' && view.rows.map((purchase) => {
              const amount = money(purchase.amountMinor, purchase.currency)
              return (
                <tr key={purchase.id}>
                  <th className="account-cell" scope="row"><OwnerLabel ownerId={purchase.userId} /></th>
                  <td className="when-cell stack-line">
                    <span className="stack-label">Solicitată </span>
                    <time dateTime={purchase.createdAt}>
                      {formatLocalDay(purchase.createdAt)}<span className="cell-sub">{formatLocalTime(purchase.createdAt)}</span>
                    </time>
                  </td>
                  <td className="wait-cell num stack-line">
                    <span className="stack-label">În așteptare </span>{formatDuration((asOf - Date.parse(purchase.createdAt)) / 60_000)}
                  </td>
                  <td className="num stack-lead">{formatCount(purchase.credits)}<span className="unit"> cr</span></td>
                  <td className="num stack-pair">{amount.value}<span className="unit"> {amount.unit}</span></td>
                  <td className="actions-cell">
                    <div className="row-buttons">
                      <button type="button" className="ghost-button" onClick={() => onReview(purchase)}>
                        Verifică<span className="sr-only"> achiziția de {formatCount(purchase.credits)} cr pentru {nameOf(purchase.userId)}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
