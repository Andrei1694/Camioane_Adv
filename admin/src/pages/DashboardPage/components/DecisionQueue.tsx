import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  cancellationCredits, clientOf, formatCount, formatDay, formatStamp, formatWindow, plural, requestSummary, routeOf, waitingFor,
} from '../dashboardData'
import type { RequestReview, RequestStatus } from '../dashboardData'
import type { CancellationRequest, Creative, CreativeStatus } from '../sampleData'
import { formatDecimal } from '../../../lib/format'

type Tab = 'bookings' | 'creatives' | 'cancellations'

const statusPill: Record<RequestStatus, { label: string, tone: string }> = {
  ready: { label: 'Pregătită pentru confirmare', tone: 'positive' },
  balance: { label: 'Sold insuficient', tone: 'negative' },
  conflict: { label: 'Mașini insuficiente', tone: 'negative' },
  creative: { label: 'Material publicitar în așteptare', tone: 'warning' },
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
    { id: 'bookings', label: 'Rezervări', count: reviews.length },
    { id: 'creatives', label: 'Materiale publicitare', count: pending.length },
    { id: 'cancellations', label: 'Anulări', count: cancellations.length },
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
      <h2 id="decisions-title" className="rail-heading">În așteptarea deciziei tale</h2>
      <div className="panel queue-panel">
        <div className="tabs" role="tablist" aria-label="Cereri în așteptare" onKeyDown={moveFocus}>
          {list.map((item) => (
            <button key={item.id} ref={(element) => { tabs.current[item.id] = element }} type="button" role="tab"
              id={`queue-tab-${item.id}`} aria-controls={`queue-panel-${item.id}`} aria-selected={tab === item.id}
              tabIndex={tab === item.id ? 0 : -1} className="tab" onClick={() => setTab(item.id)}>
              {item.label} <span className="tab-count num">{formatCount(item.count)}</span>
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`queue-panel-${tab}`} aria-labelledby={`queue-tab-${tab}`} className="queue-body">
          {tab === 'bookings' && (reviews.length === 0
            ? <p className="empty-state">Nicio rezervare în așteptarea confirmării.</p>
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
                        aria-label={`Verifică ${review.request.campaign} pentru ${review.client.name}`}>Verifică</button>
                    </div>
                  </li>
                ))}
              </ul>
            ))}

          {tab === 'creatives' && (pending.length === 0
            ? <p className="empty-state">Niciun material publicitar în așteptarea verificării.</p>
            : (
              <ul className="row-list">
                {pending.map((creative) => (
                  <li key={creative.id} className="list-row list-row-stacked">
                    <div className="list-row-main">
                      <p className="row-title">{clientOf(creative.clientId).name} <span className="row-version">v{creative.version}</span></p>
                      <p className="row-meta">{creative.file}</p>
                      <p className="row-meta">{creative.kind === 'Image' ? 'Imagine' : 'Video'}{creative.seconds === undefined ? '' : ` · ${formatCount(creative.seconds)} s`} · {formatDecimal(creative.sizeMb)} MB · pentru {creative.campaign}</p>
                    </div>
                    <div className="row-actions-inline">
                      <button type="button" className="ghost-button" onClick={() => onCreative(creative, 'approved')}
                        aria-label={`Aprobă ${creative.file}`}>Aprobă</button>
                      <button type="button" className="text-button danger" onClick={() => onCreative(creative, 'rejected')}
                        aria-label={`Respinge ${creative.file}`}>Respinge</button>
                      <span className="row-stamp">Trimisă {formatStamp(creative.submittedAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ))}

          {tab === 'cancellations' && (cancellations.length === 0
            ? <p className="empty-state">Nicio cerere de anulare.</p>
            : (
              <ul className="row-list">
                {cancellations.map((request) => (
                  <li key={request.id} className="list-row list-row-stacked">
                    <div className="list-row-main">
                      <p className="row-title">{clientOf(request.clientId).name}</p>
                      <p className="row-meta">{request.campaign} · {routeOf(request.routeId).name} · {formatWindow(request.start, request.end)}</p>
                      <p className="row-meta">{plural(request.dates.length, 'interval viitor', 'intervale viitoare')}: {request.dates.map(formatDay).join(', ')}</p>
                      <p className="row-meta">{formatCount(cancellationCredits(request))} cr au fost debitate pentru aceste intervale. Politica de rambursare nu este încă stabilită.</p>
                    </div>
                    <div className="row-actions-inline">
                      <button type="button" className="ghost-button" onClick={() => onCancellation(request, true)}
                        aria-label={`Aprobă anularea pentru ${request.campaign}`}>Aprobă</button>
                      <button type="button" className="text-button danger" onClick={() => onCancellation(request, false)}
                        aria-label={`Respinge anularea pentru ${request.campaign}`}>Respinge</button>
                      <span className="row-stamp">Trimisă {formatStamp(request.submittedAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
        </div>
        {oldest && <p className="queue-footer">Cea mai veche așteaptă de {waitingFor(oldest)}, din {formatStamp(oldest)}.</p>}
      </div>
    </section>
  )
}
