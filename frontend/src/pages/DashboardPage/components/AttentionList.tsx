import { campaignOf, formatTime, routeOf } from '../dashboardData'
import type { Attention } from '../dashboardData'

export default function AttentionList({ items, retries, onRetry }: {
  items: Attention[]
  retries: Record<string, number>
  onRetry: (item: Attention) => void
}) {
  return (
    <section className="rail-section" aria-labelledby="attention-title">
      <h2 id="attention-title" className="rail-heading">Screens needing attention</h2>
      <div className="panel">
        {items.length === 0 ? (
          <p className="empty-state">Every screen with a booking later today has its content.</p>
        ) : (
          <ul className="row-list">
            {items.map((item) => {
              const queued = retries[item.booking.id]
              const { client } = campaignOf(item.booking)
              return (
                <li key={item.booking.id} className="list-row">
                  <div className="list-row-main">
                    <p className="row-title"><span className="plate">{item.car.plate}</span> {routeOf(item.car.routeId).name} · {item.car.driver}</p>
                    <p className="row-meta">{item.reason}. {client.short} at {formatTime(item.booking.start)} not delivered.</p>
                    {queued !== undefined && <p className="row-meta">Retry queued at {formatTime(queued)}, waiting for the controller.</p>}
                  </div>
                  <div className="list-row-action">
                    {queued === undefined
                      ? <button type="button" className="ghost-button" onClick={() => onRetry(item)}>Retry delivery</button>
                      : <span className="pill pill-neutral">Retry queued</span>}
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
