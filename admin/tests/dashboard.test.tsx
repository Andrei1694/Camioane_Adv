import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import DashboardPage from '../src/pages/DashboardPage/DashboardPage'
import { bookingSegments, dashboardReducer, initialState, instanceDates, kpis, percent, priceLines, reviewRequest, routeDays, shortfalls } from '../src/pages/DashboardPage/dashboardData'
import { bookingRequests, bookings, cancellationRequests, commitments, confirmations, creatives } from '../src/pages/DashboardPage/sampleData'
import type { BookingRequest } from '../src/pages/DashboardPage/sampleData'
import { useNotifications } from '../src/lib/notifications'
import { authenticate, renderPage } from './helpers/render'

const state = () => initialState({ requests: bookingRequests, creatives, cancellations: cancellationRequests, confirmations, commitments })
const request: BookingRequest = {
  id: 'test', clientId: 'forta', campaign: 'Test booking', creativeId: 'c-forta-3', submittedAt: '2026-11-04T10:00',
  entries: [{ routeId: 'centru', start: 960, end: 1260, cars: 2, dates: ['2026-11-05', '2026-11-06'] }],
}

it('prices each date and car across peak and off-peak boundaries', () => {
  expect(priceLines(request).map(({ band, credits }) => ({ band, credits }))).toEqual([
    { band: 'Off-peak', credits: 120 }, { band: 'Peak', credits: 540 }, { band: 'Off-peak', credits: 120 },
  ])
  const review = reviewRequest(request, { ...state(), commitments: [] })
  expect(review).toMatchObject({ total: 780, instances: 2, balance: 1400, status: 'ready', blockers: [] })
})

it('expands weekly repeats, sorts dates and removes duplicates', () => {
  expect(instanceDates({ routeId: 'centru', start: 0, end: 60, cars: 1, dates: ['2026-11-09'],
    repeat: { weekdays: [1, 7], from: '2026-11-08', until: '2026-11-15' },
  })).toEqual(['2026-11-08', '2026-11-09', '2026-11-15'])
})

it('identifies insufficient balances, missing creative approval and fleet conflicts', () => {
  expect(reviewRequest(request, { ...state(), commitments: [], balances: { forta: 0 } }).status).toBe('balance')
  expect(reviewRequest(request, { ...state(), commitments: [], creatives: [] }).status).toBe('creative')
  const overbooked = { ...request, entries: [{ ...request.entries[0], cars: 100 }] }
  expect(shortfalls(overbooked, [])).toHaveLength(2)
  expect(reviewRequest(overbooked, state()).status).toBe('conflict')
})

it('keeps played, missing and future playback minutes separate', () => {
  expect(bookingSegments({ ...bookings[0], start: 600, end: 720, logsUntil: 630, delivery: 'failed' }, 660)).toEqual([
    { kind: 'played', start: 600, end: 630 }, { kind: 'no-logs', start: 630, end: 660 }, { kind: 'undelivered', start: 660, end: 720 },
  ])
  expect(bookingSegments({ ...bookings[0], start: 700, end: 720, delivery: 'received' }, 660)).toEqual([{ kind: 'scheduled', start: 700, end: 720 }])
})

it('keeps dashboard totals consistent with route figures and handles an empty schedule', () => {
  const days = routeDays(bookings)
  const totals = kpis(state(), days, bookings)
  expect(totals.playedHours).toBeLessThanOrEqual(totals.scheduledHours)
  expect(totals.bookedHours).toBeCloseTo(days.reduce((sum, day) => sum + day.bookedMinutes / 60, 0), 1)
  expect(kpis(state(), routeDays([]), []).bookedNow).toBe(0)
  expect(percent(1, 0)).toBe(0)
  expect(percent(1, 3)).toBe(33)
})

it('confirms a local request by updating balance, commitments and confirmations immutably', () => {
  const before = { ...state(), requests: [request], commitments: [] }
  const review = reviewRequest(request, before)
  const after = dashboardReducer(before, { type: 'confirm', review })
  expect(after.requests).toEqual([])
  expect(after.balances.forta).toBe(620)
  expect(after.commitments).toHaveLength(2)
  expect(after.confirmations.at(-1)).toMatchObject({ campaign: request.campaign, credits: 780 })
  expect(before.balances.forta).toBe(1400)
})

it('updates creative review and cancellation capacity without inventing a credit refund', () => {
  const before = state()
  const judged = dashboardReducer(before, { type: 'creative', id: 'c-vitan-1', status: 'approved' })
  expect(judged.creatives.find((creative) => creative.id === 'c-vitan-1')?.status).toBe('approved')
  expect(before.creatives.find((creative) => creative.id === 'c-vitan-1')?.status).toBe('pending')
  const canceled = dashboardReducer(before, { type: 'cancellation', request: cancellationRequests[0], approve: true })
  expect(canceled.cancellations).toEqual([])
  expect(canceled.balances).toEqual(before.balances)
  expect(canceled.commitments).not.toEqual(before.commitments)
  expect(dashboardReducer(before, { type: 'close-request', id: bookingRequests[0].id }).requests).toHaveLength(before.requests.length - 1)
})

it('reviews and confirms a demonstration booking through the page without API calls', async () => {
  authenticate()
  await renderPage(<DashboardPage />)
  const ready = bookingRequests.map((item) => reviewRequest(item, state())).find((item) => item.status === 'ready')!
  await userEvent.click(screen.getByRole('button', { name: `Verifică ${ready.request.campaign} pentru ${ready.client.name}` }))
  const dialog = screen.getByRole('dialog')
  await userEvent.click(within(dialog).getByRole('button', { name: /Confirmă și debitează/ }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.queryByRole('button', { name: `Verifică ${ready.request.campaign} pentru ${ready.client.name}` })).not.toBeInTheDocument()
  expect(useNotifications.getState().notifications[0]?.message).toContain('Acțiune demonstrativă:')
})
