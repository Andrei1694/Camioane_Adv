import { useEffect, useId, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { handleAdminError } from '../../../auth/adminAccess'
import { useSession } from '../../../auth/session'
import { api, errorMessage } from '../../../lib/api'
import { maxReferenceLength } from '../../../lib/credit'
import type { CreditPurchase } from '../../../lib/credit'
import { formatCount, formatDuration, formatLocalDay, formatLocalTime, formatMoney, money } from '../../../lib/format'
import { useBalance } from '../creditsData'

type Settlement = 'confirm' | 'fail' | 'cancel'

const pendingLabels: Record<Settlement, string> = { confirm: 'Confirming…', fail: 'Marking…', cancel: 'Cancelling…' }
const failureLeads: Record<Settlement, string> = {
  confirm: "Couldn't confirm the purchase.",
  fail: "Couldn't mark the payment as failed.",
  cancel: "Couldn't cancel the purchase.",
}

/** Settles one pending purchase once the admin has checked its payment outside the app. */
export default function PurchaseReviewDialog({ purchase, name, asOf, onClose, onSettled, onChanged }: {
  purchase: CreditPurchase
  /** The account's email, or how the account is described when it's gone. */
  name: string
  /** When the pending list was read; the waiting time counts to it, as in the table. */
  asOf: number
  onClose: () => void
  onSettled: (outcome: string) => void
  /** Any attempt may have changed the lists, even a failed one. */
  onChanged: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const revision = useSession((state) => state.revision)
  const [reference, setReference] = useState('')
  const id = useId()
  const balance = useBalance(purchase.userId)
  const deleted = purchase.userId === null
  const credits = formatCount(purchase.credits)
  const amount = money(purchase.amountMinor, purchase.currency)
  const settle = useMutation({
    mutationFn: async (action: Settlement) => {
      if (action === 'confirm') {
        const { transaction } = await api.confirmPurchase(purchase.id, reference.trim() || undefined)
        return `Confirmed ${credits} cr for ${name}. Balance now ${formatCount(transaction.balanceAfter)} cr.`
      }
      if (action === 'fail') {
        await api.failPurchase(purchase.id)
        return `Marked the ${credits} cr purchase for ${name} as failed. No credits were added.`
      }
      await api.cancelPurchase(purchase.id)
      return `Cancelled the ${credits} cr purchase for ${name}. No credits were added.`
    },
    onError: (error) => handleAdminError(error, revision),
  })

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  async function run(action: Settlement) {
    if (settle.isPending) return
    try {
      const outcome = await settle.mutateAsync(action)
      if (revision !== useSession.getState().revision) return
      onSettled(outcome)
      dialog.current?.close()
    } catch {
      // The error shows in the dialog from the mutation's state.
    } finally {
      if (revision === useSession.getState().revision) onChanged()
    }
  }

  const busy = settle.isPending

  return (
    <dialog ref={dialog} className="dialog credits-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-sub`} onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close()
      }}>
      <div className="dialog-head">
        <div>
          <h2 id={`${id}-title`}>{credits} cr for {name}</h2>
          <p className="dialog-sub" id={`${id}-sub`}>
            {/* Non-breaking spaces keep each separator at the end of its line when the subline wraps. */}
            Requested {formatLocalDay(purchase.createdAt)}, <span className="num">{formatLocalTime(purchase.createdAt)}</span>
            {' · '}waiting <span className="num">{formatDuration((asOf - Date.parse(purchase.createdAt)) / 60_000)}</span>
          </p>
        </div>
        <button type="button" className="icon-button" aria-label="Close review" onClick={() => dialog.current?.close()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>

      <dl className="review-checks">
        <div className="check">
          <dt>Amount due</dt>
          <dd>
            <span className="num">{amount.value}</span><span className="unit"> {amount.unit}</span>
            <span className="unit"> · {credits} cr at <span className="num">{formatMoney(purchase.unitPriceMinor, purchase.currency)}</span> each</span>
          </dd>
        </div>
        <div className={deleted ? 'check check-fail' : 'check'}>
          <dt>Balance</dt>
          <dd aria-live="polite">
            {deleted ? 'The account was deleted, so there is no balance to add these credits to.'
              : balance.data ? (
                <>
                  <span className="num">{formatCount(balance.data.balance)} cr</span> now,{' '}
                  <span className="num">{formatCount(balance.data.balance + purchase.credits)} cr</span> after confirming.
                </>
              )
              : balance.isError ? (
                <span className="inline-error">
                  <span className="danger">Couldn't load the balance. {errorMessage(balance.error)}</span>
                  <button type="button" className="text-button" disabled={balance.isFetching} onClick={() => void balance.refetch()}>
                    {balance.isFetching ? 'Retrying…' : 'Retry'}
                  </button>
                </span>
              )
              : <span className="missing">Loading balance…</span>}
          </dd>
        </div>
      </dl>

      <div className="form-field dialog-field">
        <label htmlFor={`${id}-reference`}>Payment reference <span className="optional-label">(optional)</span></label>
        <input id={`${id}-reference`} value={reference} maxLength={maxReferenceLength} autoComplete="off" spellCheck={false}
          disabled={deleted} aria-describedby={`${id}-reference-hint`} onChange={(event) => setReference(event.target.value)} />
        <p id={`${id}-reference-hint`} className="field-hint">The bank transfer or receipt number you checked. Each reference can confirm only one purchase.</p>
      </div>

      {settle.isError && settle.variables && <p className="request-error" role="alert">{failureLeads[settle.variables]} {errorMessage(settle.error)}</p>}

      <div className="dialog-actions">
        <button type="button" className="primary-button" disabled={busy || deleted} aria-describedby={deleted ? `${id}-blocked` : undefined}
          onClick={() => void run('confirm')}>
          {busy && settle.variables === 'confirm' ? pendingLabels.confirm : `Confirm and add ${credits} cr`}
        </button>
        <button type="button" disabled={busy} onClick={() => void run('fail')}>
          {busy && settle.variables === 'fail' ? pendingLabels.fail : 'Mark payment failed'}
        </button>
        <button type="button" className="text-button danger" disabled={busy} onClick={() => void run('cancel')}>
          {busy && settle.variables === 'cancel' ? pendingLabels.cancel : 'Cancel purchase'}
        </button>
      </div>
      {deleted && <p id={`${id}-blocked`} className="dialog-note">Can't confirm: the account no longer exists. Mark the payment failed or cancel the purchase.</p>}
    </dialog>
  )
}
