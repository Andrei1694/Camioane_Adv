import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import CreditsPage from '../src/pages/CreditsPage/CreditsPage'
import { api, ApiError } from '../src/lib/api'
import { authenticate, renderPage } from './helpers/render'
import { deferred, purchase, stamp, transaction, user } from './helpers/fixtures'

beforeEach(() => {
  authenticate()
  vi.spyOn(api, 'creditBalance').mockResolvedValue({ balance: 100, currency: 'RON', unitPriceMinor: 100 })
})

it('shows loading and independent queue errors, then retries to an empty queue', async () => {
  const loading = deferred<Awaited<ReturnType<typeof api.creditPurchases>>>()
  const purchases = vi.spyOn(api, 'creditPurchases').mockReturnValueOnce(loading.promise)
    .mockResolvedValue({ purchases: [], total: 0 })
  vi.spyOn(api, 'creditTransactions').mockResolvedValue({ transactions: [], total: 0 })
  await renderPage(<CreditsPage />)
  expect(screen.getByRole('button', { name: 'Verifică cea mai veche plată' })).toBeDisabled()
  expect(screen.getByText('Se încarcă achizițiile…')).toBeInTheDocument()
  await act(async () => loading.reject(new ApiError(500, 'Queue unavailable')))
  const error = await screen.findByRole('alert')
  expect(error).toHaveTextContent('Queue unavailable')
  expect(screen.getByText('Nu există încă tranzacții cu credite.')).toBeInTheDocument()
  await userEvent.click(within(error).getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByRole('button', { name: 'Nicio plată în așteptare' })).toBeDisabled()
  expect(purchases).toHaveBeenCalledTimes(2)
})

it('confirms a queued purchase and refreshes the selected balance and transaction history', async () => {
  let paid = false
  vi.spyOn(api, 'creditPurchases').mockImplementation(async () => ({ purchases: paid ? [] : [purchase()], total: paid ? 0 : 1 }))
  const ledger = vi.spyOn(api, 'creditTransactions').mockImplementation(async () => ({
    transactions: paid ? [transaction({ note: 'Verified funding', type: 'PURCHASE', purchaseId: purchase().id })] : [],
    total: paid ? 1 : 0,
  }))
  vi.mocked(api.creditBalance).mockImplementation(async () => ({ balance: paid ? 110 : 100, currency: 'RON', unitPriceMinor: 100 }))
  const confirm = vi.spyOn(api, 'confirmPurchase').mockImplementation(async () => {
    paid = true
    return { purchase: purchase({ status: 'PAID', settledAt: stamp }), transaction: transaction() }
  })
  const actor = userEvent.setup()
  await renderPage(<CreditsPage />)
  await actor.selectOptions(screen.getByLabelText('Cont'), user().id)
  await actor.click(await screen.findByRole('button', { name: 'Verifică cea mai veche plată' }))
  const dialog = await screen.findByRole('dialog')
  await actor.type(within(dialog).getByLabelText(/Referința plății/), 'bank-receipt')
  vi.mocked(api.creditBalance).mockClear()
  await actor.click(within(dialog).getByRole('button', { name: 'Confirmă și adaugă 10 cr' }))
  expect(await screen.findByText('Verified funding')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Nicio plată în așteptare' })).toBeDisabled()
  expect(screen.getByRole('region', { name: 'Istoric' })).toHaveTextContent('Sold 110 cr')
  expect(confirm).toHaveBeenCalledWith(purchase().id, 'bank-receipt')
  expect(ledger).toHaveBeenLastCalledWith({ limit: 50, offset: 0, userId: user().id }, expect.any(AbortSignal))
  expect(api.creditBalance).toHaveBeenCalledOnce()
})

it('paginates, clears previous-account rows while filtering, and switches history tabs by keyboard', async () => {
  const filtered = deferred<Awaited<ReturnType<typeof api.creditTransactions>>>()
  const ledger = vi.spyOn(api, 'creditTransactions').mockImplementation(async ({ userId, offset }) => userId
    ? filtered.promise
    : { transactions: [transaction({ note: offset ? 'Second page' : 'First page' })], total: 51 })
  const purchases = vi.spyOn(api, 'creditPurchases').mockImplementation(async ({ status }) => status
    ? { purchases: [], total: 0 }
    : { purchases: [purchase({ status: 'PAID', reference: 'receipt', settledAt: stamp })], total: 1 })
  const actor = userEvent.setup()
  await renderPage(<CreditsPage />)
  expect(await screen.findByText('First page')).toBeInTheDocument()
  await actor.click(screen.getByRole('button', { name: /^Înainte\s*la pagina următoare$/ }))
  expect(await screen.findByText('Second page')).toBeInTheDocument()
  await actor.selectOptions(screen.getByLabelText('Cont'), user().id)
  expect(screen.queryByText('Second page')).not.toBeInTheDocument()
  expect(screen.getByText('Se încarcă tranzacțiile…')).toBeInTheDocument()
  await act(async () => filtered.resolve({ transactions: [transaction({ note: 'Account-specific row' })], total: 1 }))
  expect(await screen.findByText('Account-specific row')).toBeInTheDocument()
  expect(ledger).toHaveBeenLastCalledWith({ limit: 50, offset: 0, userId: user().id }, expect.any(AbortSignal))
  screen.getByRole('tab', { name: 'Tranzacții' }).focus()
  await actor.keyboard('{ArrowRight}')
  expect(screen.getByRole('tab', { name: 'Achiziții' })).toHaveFocus()
  expect(await screen.findByText('receipt')).toBeInTheDocument()
  expect(purchases).toHaveBeenLastCalledWith({ limit: 50, offset: 0, userId: user().id }, expect.any(AbortSignal))
  await actor.keyboard('{Home}')
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Tranzacții' })).toHaveAttribute('aria-selected', 'true'))
})
