import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  cancellationCredits, clientOf, formatCount, formatDay, formatStamp, formatWindow, plural, requestSummary, routeOf, waitingFor,
} from '../dashboardData'
import type { RequestReview, RequestStatus } from '../dashboardData'
import type { CancellationRequest, Creative, CreativeStatus } from '../sampleData'

type Tab = 'bookings' | 'creatives' | 'cancellations'

const statusPill: Record<RequestStatus, { label: string, tone: string }> = {
  ready: { label: 'Ready to confirm', tone: 'positive' },
  balance: { label: 'Balance short', tone: 'negative' },
  conflict: { label: 'Not enough cars', tone: 'negative' },
  creative: { label: 'Creative pending', tone: 'warning' },
}

export default function DecisionQueue({ reviews, creatives, cancellations, onReview, onCreative, onCancellation }: {
  reviews: RequestReview[]
  creatives: Creative[]
  cancellations: CancellationRequest[]
  onReview: (id: string) => void
  onCreative: (creative: Creative, status: CreativeStatus) => void
  onCancellation: (request: CancellationRequest, approve: boolean) => void
}) {
  const [tab, setTab] = useState<Tab>('bookings')
  const tabs = useRef<Record<Tab, HTMLButtonElement | null>>({ bookings: null, creatives: null, cancellations: null })
  const pending = creatives.filter((item) => item.status === 'pending')
  const list: { id: Tab, label: string, count: number }[] = [
    { id: 'bookings', label: 'Bookings', count: reviews.length },
    { id: 'creatives', label: 'Creatives', count: pending.length },
    { id: 'cancellations', label: 'Cancellations', count: cancellations.length },
  ]
  const sent = (tab === 'bookings' ? reviews.map((review) => review.request.submittedAt)
    : tab === 'creatives' ? pending.map((item) => item.submittedAt)
    : cancellations.map((item) => item.submittedAt)).sort()
  const oldest = sent[0]

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const index = list.findIndex((item) => item.id === tab)
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    const target = event.key === 'Home' ? list[0] : event.key === 'End' ? list[list.length - 1]
      : step ? list[(index + step + list.length) % list.length] : null
    if (!target) return
    event.preventDefault()
    setTab(target.id)
    tabs.current[target.id]?.focus()
  }

  return (
    <section className="rail-section" aria-labelledby="decisions-title">
      <h2 id="decisions-title" className="rail-heading">Waiting for your decision</h2>
      <div className="panel queue-panel">
        <div className="tabs" role="tablist" aria-label="Decision queues" onKeyDown={moveFocus}>
          {list.map((item) => (
            <button key={item.id} ref={(element) => { tabs.current[item.id] = element }} type="button" role="tab"
              id={`queue-tab-${item.id}`} aria-controls={`queue-panel-${item.id}`} aria-selected={tab === item.id}
              tabIndex={tab === item.id ? 0 : -1} className="tab" onClick={() => setTab(item.id)}>
              {item.label} <span className="tab-count num">{item.count}</span>
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`queue-panel-${tab}`} aria-labelledby={`queue-tab-${tab}`} className="queue-body">
          {tab === 'bookings' && (reviews.length === 0
            ? <p className="empty-state">No bookings waiting for confirmation.</p>
            : (
              <ul className="row-list">
                {reviews.map((review) => (
                  <li key={review.request.id} className="list-row">
                    <div className="list-row-main">
                      <p className="row-title">{review.client.name} <span className={`pill pill-${statusPill[review.status].tone}`}>{statusPill[review.status].label}</span></p>
                      <p className="row-meta">{review.request.campaign} · {requestSummary(review.request)}</p>
                    </div>
                    <div className="list-row-action">
                      <p className="row-figure num">{formatCount(review.total)}<span className="unit"> cr</span></p>
                      <button type="button" className="ghost-button" onClick={() => onReview(review.request.id)}
                        aria-label={`Review ${review.request.campaign} for ${review.client.name}`}>Review</button>
                    </div>
                  </li>
                ))}
              </ul>
            ))}

          {tab === 'creatives' && (pending.length === 0
            ? <p className="empty-state">No creatives waiting for review.</p>
            : (
              <ul className="row-list">
                {pending.map((creative) => (
                  <li key={creative.id} className="list-row list-row-stacked">
                    <div className="list-row-main">
                      <p className="row-title">{clientOf(creative.clientId).name} <span className="row-version">v{creative.version}</span></p>
                      <p className="row-meta">{creative.file}</p>
                      <p className="row-meta">{creative.kind}{creative.seconds === undefined ? '' : ` · ${creative.seconds} s`} · {creative.sizeMb.toFixed(1)} MB · for {creative.campaign}</p>
                    </div>
                    <div className="row-actions-inline">
                      <button type="button" className="ghost-button" onClick={() => onCreative(creative, 'approved')}
                        aria-label={`Approve ${creative.file}`}>Approve</button>
                      <button type="button" className="text-button danger" onClick={() => onCreative(creative, 'rejected')}
                        aria-label={`Reject ${creative.file}`}>Reject</button>
                      <span className="row-stamp">Sent {formatStamp(creative.submittedAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ))}

          {tab === 'cancellations' && (cancellations.length === 0
            ? <p className="empty-state">No cancellation requests.</p>
            : (
              <ul className="row-list">
                {cancellations.map((request) => (
                  <li key={request.id} className="list-row list-row-stacked">
                    <div className="list-row-main">
                      <p className="row-title">{clientOf(request.clientId).name}</p>
                      <p className="row-meta">{request.campaign} · {routeOf(request.routeId).name} · {formatWindow(request.start, request.end)}</p>
                      <p className="row-meta">{plural(request.dates.length, 'future slot')}: {request.dates.map(formatDay).join(', ')}</p>
                      <p className="row-meta">{formatCount(cancellationCredits(request))} cr were debited for these slots. The refund policy isn't set yet.</p>
                    </div>
                    <div className="row-actions-inline">
                      <button type="button" className="ghost-button" onClick={() => onCancellation(request, true)}
                        aria-label={`Approve cancellation for ${request.campaign}`}>Approve</button>
                      <button type="button" className="text-button danger" onClick={() => onCancellation(request, false)}
                        aria-label={`Decline cancellation for ${request.campaign}`}>Decline</button>
                      <span className="row-stamp">Sent {formatStamp(request.submittedAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
        </div>
        {oldest && <p className="queue-footer">Oldest has waited {waitingFor(oldest)}, since {formatStamp(oldest)}.</p>}
      </div>
    </section>
  )
}
