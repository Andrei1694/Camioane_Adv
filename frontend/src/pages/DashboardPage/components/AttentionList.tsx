import { campaignOf, formatTime, routeOf } from '../dashboardData'
import type { Attention } from '../dashboardData'

export default function AttentionList({ items, retries, onRetry }: {
  items: Attention[]
  retries: Record<string, number>
  onRetry: (item: Attention) => void
}) {
  return (
    <section className="rail-section" aria-labelledby="attention-title">
      <h2 id="attention-title" className="rail-heading">Ecrane care necesită atenție</h2>
      <div className="panel">
        {items.length === 0 ? (
          <p className="empty-state">Fiecare ecran cu o rezervare pentru mai târziu astăzi are conținutul necesar.</p>
        ) : (
          <ul className="row-list">
            {items.map((item) => {
              const queued = retries[item.booking.id]
              const { client } = campaignOf(item.booking)
              return (
                <li key={item.booking.id} className="list-row">
                  <div className="list-row-main">
                    <p className="row-title"><span className="plate">{item.car.plate}</span> {routeOf(item.car.routeId).name} · {item.car.driver}</p>
                    <p className="row-meta">{item.reason}. Conținutul pentru {client.short} de la {formatTime(item.booking.start)} nu a fost livrat.</p>
                    {queued !== undefined && <p className="row-meta">Retrimitere programată la {formatTime(queued)}, se așteaptă controlerul.</p>}
                  </div>
                  <div className="list-row-action">
                    {queued === undefined
                      ? <button type="button" className="ghost-button" onClick={() => onRetry(item)}>Retrimite conținutul</button>
                      : <span className="pill pill-neutral">Retrimitere programată</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
