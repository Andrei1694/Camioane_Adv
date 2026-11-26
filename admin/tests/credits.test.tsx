import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import AdjustBalanceDialog from '../src/pages/CreditsPage/components/AdjustBalanceDialog'
import PurchaseReviewDialog from '../src/pages/CreditsPage/components/PurchaseReviewDialog'
import { accountName, pendingPurchases } from '../src/pages/CreditsPage/creditsData'
import { api, ApiError } from '../src/lib/api'
import { authenticate, renderPage } from './helpers/render'
import { deferred, id, purchase, stamp, transaction, user } from './helpers/fixtures'

beforeEach(() => {
  authenticate()
  vi.spyOn(api, 'creditBalance').mockResolvedValue({ balance: 100, currency: 'RON', unitPriceMinor: 100 })
})

it('collects pending purchases across pages, deduplicates and sorts oldest first', async () => {
  const older = purchase({ id: id(9), createdAt: '2026-11-09T10:00:00Z' })
  const list = vi.spyOn(api, 'creditPurchases').mockResolvedValueOnce({ purchases: [purchase()], total: 101 })
    .mockResolvedValueOnce({ purchases: [purchase(), older], total: 101 })
  await expect(pendingPurchases(new AbortController().signal)).resolves.toEqual([older, purchase()])
  expect(list.mock.calls.map(([page]) => page.offset)).toEqual([0, 100])
  expect(accountName([user()], null)).toContain('șters')
  expect(accountName([user()], user().id)).toBe(user().email)
})

it.each([
  ['confirmPurchase', 'Confirmă și adaugă 10 cr'],
  ['failPurchase', 'Marchează plata ca eșuată'],
  ['cancelPurchase', 'Anulează achiziția'],
] as const)('settles a purchase using %s and requests refreshed data', async (method, button) => {
  const confirm = vi.spyOn(api, 'confirmPurchase').mockResolvedValue({ purchase: purchase({ status: 'PAID' }), transaction: transaction() })
  const fail = vi.spyOn(api, 'failPurchase').mockResolvedValue(purchase({ status: 'FAILED' }))
  const cancel = vi.spyOn(api, 'cancelPurchase').mockResolvedValue(purchase({ status: 'CANCELED' }))
  const onChanged = vi.fn(), onSettled = vi.fn()
  await renderPage(<PurchaseReviewDialog purchase={purchase()} name={user().email} asOf={Date.parse(stamp)}
    onClose={vi.fn()} onSettled={onSettled} onChanged={onChanged} />)
  if (method === 'confirmPurchase') await userEvent.type(screen.getByLabelText(/Referința plății/), ' bank-123 ')
  await userEvent.click(screen.getByRole('button', { name: button }))
  await waitFor(() => expect(onSettled).toHaveBeenCalledOnce())
  expect(onChanged).toHaveBeenCalled()
  if (method === 'confirmPurchase') expect(confirm).toHaveBeenCalledWith(purchase().id, 'bank-123')
  if (method === 'failPurchase') expect(fail).toHaveBeenCalledWith(purchase().id)
  if (method === 'cancelPurchase') expect(cancel).toHaveBeenCalledWith(purchase().id)
})

it('disables duplicate settlements and keeps payment reference after a failure', async () => {
  const pending = deferred<Awaited<ReturnType<typeof api.confirmPurchase>>>()
  vi.spyOn(api, 'confirmPurchase').mockReturnValue(pending.promise)
  await renderPage(<PurchaseReviewDialog purchase={purchase()} name={user().email} asOf={Date.parse(stamp)}
    onClose={vi.fn()} onSettled={vi.fn()} onChanged={vi.fn()} />)
  await userEvent.type(screen.getByLabelText(/Referința plății/), 'reference')
  await userEvent.click(screen.getByRole('button', { name: 'Confirmă și adaugă 10 cr' }))
  expect(await screen.findByRole('button', { name: 'Se confirmă…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Anulează achiziția' })).toBeDisabled()
  await act(async () => pending.reject(new ApiError(409, 'Already settled')))
  expect(await screen.findByRole('alert')).toHaveTextContent('Already settled')
  expect(screen.getByLabelText(/Referința plății/)).toHaveValue('reference')
})

it('prevents confirming purchases belonging to a deleted account', async () => {
  await renderPage(<PurchaseReviewDialog purchase={purchase({ userId: null })} name="Deleted" asOf={Date.parse(stamp)}
    onClose={vi.fn()} onSettled={vi.fn()} onChanged={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Confirmă și adaugă 10 cr' })).toBeDisabled()
  expect(api.creditBalance).not.toHaveBeenCalled()
})

it('validates adjustment account, whole amount, note and available balance', async () => {
  const adjust = vi.spyOn(api, 'adjustCredits').mockResolvedValue(transaction({ amount: -10, balanceAfter: 90 }))
  const onAdjusted = vi.fn(), onChanged = vi.fn()
  const actor = userEvent.setup()
  await renderPage(<AdjustBalanceDialog users={[user()]} initialUserId={null} onClose={vi.fn()} onAdjusted={onAdjusted} onChanged={onChanged} />)
  await actor.click(screen.getByRole('button', { name: 'Adaugă credite' }))
  expect(screen.getByLabelText('Cont')).toHaveFocus()
  expect(adjust).not.toHaveBeenCalled()
  await actor.selectOptions(screen.getByLabelText('Cont'), user().id)
  await screen.findByText('Sold: 100 cr.')
  await actor.type(screen.getByLabelText('Credite', { selector: 'input' }), '1.5')
  await actor.click(screen.getByRole('button', { name: 'Adaugă credite' }))
  expect(screen.getByLabelText('Credite', { selector: 'input' })).toHaveAttribute('aria-invalid', 'true')
  await actor.clear(screen.getByLabelText('Credite', { selector: 'input' }))
  await actor.type(screen.getByLabelText('Credite', { selector: 'input' }), '101')
  await actor.click(screen.getByLabelText('Scade credite'))
  await actor.click(screen.getByRole('button', { name: 'Scade 101 cr' }))
  expect(screen.getByText(/are doar 100 cr/)).toBeInTheDocument()
  await actor.clear(screen.getByLabelText('Credite', { selector: 'input' }))
  await actor.type(screen.getByLabelText('Credite', { selector: 'input' }), '10')
  await actor.type(screen.getByLabelText('Notă'), ' Correction ')
  await actor.click(screen.getByRole('button', { name: 'Scade 10 cr' }))
  await waitFor(() => expect(onAdjusted).toHaveBeenCalledOnce())
  expect(adjust).toHaveBeenCalledWith({ userId: user().id, amount: -10, note: 'Correction' })
  expect(onChanged).toHaveBeenCalled()
})

it('retains adjustment values on failure and disables the pending submit button', async () => {
  const pending = deferred<ReturnType<typeof transaction>>()
  vi.spyOn(api, 'adjustCredits').mockReturnValue(pending.promise)
  await renderPage(<AdjustBalanceDialog users={[user()]} initialUserId={user().id} onClose={vi.fn()} onAdjusted={vi.fn()} onChanged={vi.fn()} />)
  await userEvent.type(screen.getByLabelText('Credite', { selector: 'input' }), '10')
  await userEvent.type(screen.getByLabelText('Notă'), 'Correction')
  await userEvent.click(screen.getByRole('button', { name: 'Adaugă 10 cr' }))
  expect(await screen.findByRole('button', { name: 'Se salvează…' })).toBeDisabled()
  await act(async () => pending.reject(new ApiError(500, 'Offline')))
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
  expect(screen.getByLabelText('Notă')).toHaveValue('Correction')
})
