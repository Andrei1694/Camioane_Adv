import { useEffect, useMemo, useReducer, useState } from 'react'
import { useNotify } from '../../lib/useNotify'
import AttentionList from './components/AttentionList'
import BookingReviewDialog from './components/BookingReviewDialog'
import type { Decision } from './components/BookingReviewDialog'
import DecisionQueue from './components/DecisionQueue'
import FleetTimeline from './components/FleetTimeline'
import KpiStrip from './components/KpiStrip'
import RoutesTable from './components/RoutesTable'
import {
  attentionItems, checkDashboard, clientOf, dashboardReducer, finding, formatCount, formatLongDay, formatTime, initialState,
  kpis, reviewRequest, routeDays, routeOf,
} from './dashboardData'
import type { Attention, RequestReview } from './dashboardData'
import { asOf, bookingRequests, bookings, cancellationRequests, commitments, confirmations, creatives } from './sampleData'
import type { CancellationRequest, Creative, CreativeStatus } from './sampleData'
import './DashboardPage.css'

export default function DashboardPage() {
  const [state, dispatch] = useReducer(dashboardReducer, {
    requests: bookingRequests, creatives, cancellations: cancellationRequests, confirmations, commitments,
  }, initialState)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const notify = useNotify()

  function sampleOutcome(message: string) {
    notify({ variant: 'success', message: `Sample action: ${message}` })
  }

  const days = useMemo(() => routeDays(bookings), [])
  const attention = useMemo(() => attentionItems(bookings), [])
  const figures = useMemo(() => kpis(state, days, bookings), [state, days])
  // Oldest request first: that is the order the admin works through them.
  const reviews = [...state.requests]
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    .map((request) => reviewRequest(request, state))
  const review = reviews.find((item) => item.request.id === reviewId)

  useEffect(() => checkDashboard(state, days, figures, bookings), [state, days, figures])

  function confirm(item: RequestReview) {
    dispatch({ type: 'confirm', review: item })
    sampleOutcome(`Confirmed ${item.request.campaign} for ${item.client.name}. ${formatCount(item.total)} cr debited, ${formatCount(item.balance - item.total)} cr left.`)
  }

  function decide(item: RequestReview, decision: Decision) {
    dispatch({ type: 'close-request', id: item.request.id })
    sampleOutcome(decision === 'changes'
      ? `Asked ${item.client.name} to change ${item.request.campaign}. No credits were debited.`
      : `Rejected ${item.request.campaign} for ${item.client.name}. No credits were debited.`)
  }

  function judgeCreative(creative: Creative, status: CreativeStatus) {
    dispatch({ type: 'creative', id: creative.id, status })
    const unblocked = state.requests.find((request) => request.creativeId === creative.id)
    sampleOutcome(`${status === 'approved' ? 'Approved' : 'Rejected'} ${creative.file} for ${clientOf(creative.clientId).name}.${
      unblocked && status === 'approved' ? ` ${unblocked.campaign} no longer waits on its creative.` : ''}`)
  }

  function judgeCancellation(request: CancellationRequest, approve: boolean) {
    dispatch({ type: 'cancellation', request, approve })
    sampleOutcome(approve
      ? `Cancelled ${request.dates.length} ${routeOf(request.routeId).name} slots of ${request.campaign}. The refund waits for the refund policy.`
      : `Declined the cancellation for ${request.campaign}. Its slots stay booked.`)
  }

  function retry(item: Attention) {
    dispatch({ type: 'retry', bookingId: item.booking.id })
    sampleOutcome(`Delivery to ${item.car.plate} queued at ${formatTime(asOf.time)}.`)
  }

  const next = reviews[0]

  return (
    <div className="dashboard">
      <header className="dashboard-title">
        <div className="dashboard-title-text">
          <h1>Dashboard</h1>
          <p className="dashboard-finding">{finding(attention)}</p>
        </div>
        <div className="dashboard-title-actions">
          <p className="sample-notice">Sample data as of {formatLongDay(asOf.date)}, {formatTime(asOf.time)}</p>
          <button type="button" className="primary-button" disabled={!next} onClick={() => next && setReviewId(next.request.id)}>
            {next ? 'Review next request' : 'No requests waiting'}
          </button>
        </div>
      </header>

      {/* At 1440: a 1200px sheet minus 2px of edges and 2 x 24px padding leaves 1150px.
          The grid is minmax(0, 1fr) + 384px with a 20px gutter: 746 + 20 + 384 = 1150. */}
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <div className="area-kpis"><KpiStrip figures={figures} /></div>
          <div className="area-timeline"><FleetTimeline bookings={bookings} /></div>
        </div>
        <div className="dashboard-rail">
          <div className="area-attention"><AttentionList items={attention} retries={state.retries} onRetry={retry} /></div>
          <div className="area-decisions">
            <DecisionQueue reviews={reviews} creatives={state.creatives} cancellations={state.cancellations}
              onReview={setReviewId} onCreative={judgeCreative} onCancellation={judgeCancellation} />
          </div>
        </div>
      </div>

      <RoutesTable days={days} />

      {review && (
        <BookingReviewDialog key={review.request.id} review={review} onClose={() => setReviewId(null)}
          onConfirm={confirm} onDecide={decide} />
      )}
    </div>
  )
}
