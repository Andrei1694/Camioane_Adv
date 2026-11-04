import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { handleAdminError } from '../../../auth/adminAccess'
import { useSession } from '../../../auth/session'
import { api, errorMessage } from '../../../lib/api'
import { maxAdjustment, maxNoteLength } from '../../../lib/credit'
import type { Adjustment } from '../../../lib/credit'
import { formatCount } from '../../../lib/format'
import type { User } from '../../../lib/user'
import { useBalance } from '../creditsData'

type Direction = 'add' | 'remove'

interface Errors {
  account?: string
  amount?: string
  note?: string
}

/** Adds or removes credits by hand. Each adjustment is a new ledger row that carries its note. */
export default function AdjustBalanceDialog({ users, initialUserId, onClose, onAdjusted, onChanged }: {
  users: readonly User[]
  initialUserId: string | null
  onClose: () => void
  onAdjusted: (outcome: string) => void
  onChanged: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const fields = useRef<Record<keyof Errors, HTMLElement | null>>({ account: null, amount: null, note: null })
  const revision = useSession((state) => state.revision)
  const id = useId()
  const [userId, setUserId] = useState(initialUserId ?? '')
  const [direction, setDirection] = useState<Direction>('add')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const balance = useBalance(userId === '' ? null : userId)
  const adjust = useMutation({
    mutationFn: (data: Adjustment) => api.adjustCredits(data),
    onError: (error) => handleAdminError(error, revision),
  })

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  const email = users.find((user) => user.id === userId)?.email ?? 'this account'
  const parsed = /^\d+$/.test(amount.trim()) ? Number(amount.trim()) : Number.NaN
  const amountValid = Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maxAdjustment
  const current = balance.data?.balance
  const overdraws = direction === 'remove' && amountValid && current !== undefined && parsed > current
  const after = amountValid && current !== undefined && !overdraws ? current + (direction === 'add' ? parsed : -parsed) : undefined
  const verb = direction === 'add' ? 'Add' : 'Remove'

  function validate(): Errors {
    const text = note.trim()
    return {
      account: userId === '' ? 'Choose the account to adjust.' : undefined,
      amount: !amountValid ? `Enter a whole number of credits from 1 to ${formatCount(maxAdjustment)}.`
        : overdraws ? `${email} has only ${formatCount(current ?? 0)} cr to remove.` : undefined,
      note: text === '' ? 'Write a note that says why the balance changes.'
        : Array.from(text).length > maxNoteLength ? `Keep the note to ${maxNoteLength} characters or fewer.` : undefined,
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (adjust.isPending) return
    const found = validate()
    setErrors(found)
    const first = (['account', 'amount', 'note'] as const).find((key) => found[key])
    if (first) {
      fields.current[first]?.focus()
      return
    }
    const signed = direction === 'add' ? parsed : -parsed
    try {
      const transaction = await adjust.mutateAsync({ userId, amount: signed, note: note.trim() })
      if (revision !== useSession.getState().revision) return
      onAdjusted(direction === 'add'
        ? `Added ${formatCount(parsed)} cr to ${email}. Balance now ${formatCount(transaction.balanceAfter)} cr.`
        : `Removed ${formatCount(parsed)} cr from ${email}. Balance now ${formatCount(transaction.balanceAfter)} cr.`)
      dialog.current?.close()
    } catch {
      // The error shows in the dialog from the mutation's state.
    } finally {
      if (revision === useSession.getState().revision) onChanged()
    }
  }

  const balanceHint = userId === '' ? 'The account whose balance changes.'
    : balance.data ? `Balance: ${formatCount(balance.data.balance)} cr.`
    : balance.isError ? `Couldn't load the balance. ${errorMessage(balance.error)}`
    : 'Loading balance…'

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
          <h2 id={`${id}-title`}>Adjust balance</h2>
          <p className="dialog-sub" id={`${id}-sub`}>Each adjustment adds a row to the ledger, with your note.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Close" onClick={() => dialog.current?.close()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>

      <form className="adjust-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="form-field adjust-account">
          <label htmlFor={`${id}-account`}>Account</label>
          <select id={`${id}-account`} ref={(element) => { fields.current.account = element }} value={userId}
            aria-invalid={errors.account ? true : undefined} aria-describedby={`${id}-account-hint`}
            onChange={(event) => { setUserId(event.target.value); setErrors((old) => ({ ...old, account: undefined, amount: undefined })) }}>
            <option value="">Choose an account</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
          </select>
          <p id={`${id}-account-hint`} className={errors.account || balance.isError ? 'field-error' : 'field-hint'} aria-live="polite">
            {errors.account ?? balanceHint}
            {!errors.account && balance.isError && (
              <> <button type="button" className="text-button" disabled={balance.isFetching} onClick={() => void balance.refetch()}>
                {balance.isFetching ? 'Retrying…' : 'Retry'}
              </button></>
            )}
          </p>
        </div>

        <fieldset className="choice-field">
          <legend>Change</legend>
          <div className="choices">
            {(['add', 'remove'] as const).map((value) => (
              <label key={value} className="choice">
                <input type="radio" name={`${id}-direction`} value={value} checked={direction === value}
                  onChange={() => { setDirection(value); setErrors((old) => ({ ...old, amount: undefined })) }} />
                {value === 'add' ? 'Add credits' : 'Remove credits'}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-field adjust-amount">
          <label htmlFor={`${id}-amount`}>Credits</label>
          <input id={`${id}-amount`} ref={(element) => { fields.current.amount = element }} inputMode="numeric" autoComplete="off"
            value={amount} aria-invalid={errors.amount ? true : undefined} aria-describedby={`${id}-amount-hint`}
            onChange={(event) => { setAmount(event.target.value); setErrors((old) => ({ ...old, amount: undefined })) }} />
          <p id={`${id}-amount-hint`} className={errors.amount ? 'field-error' : 'field-hint'}>
            {errors.amount ?? (after !== undefined ? `Balance after: ${formatCount(after)} cr.` : `A whole number from 1 to ${formatCount(maxAdjustment)}.`)}
          </p>
        </div>

        <div className="form-field adjust-note">
          <label htmlFor={`${id}-note`}>Note</label>
          <textarea id={`${id}-note`} ref={(element) => { fields.current.note = element }} rows={3} value={note}
            aria-invalid={errors.note ? true : undefined} aria-describedby={`${id}-note-hint`}
            onChange={(event) => { setNote(event.target.value); setErrors((old) => ({ ...old, note: undefined })) }} />
          <p id={`${id}-note-hint`} className={errors.note ? 'field-error' : 'field-hint'}>
            {errors.note ?? 'Why the balance changes. The account owner can see this note.'}
          </p>
        </div>

        {adjust.isError && <p className="request-error adjust-error" role="alert">Couldn't adjust the balance. {errorMessage(adjust.error)}</p>}

        <div className="dialog-actions adjust-actions">
          <button type="submit" className="primary-button" disabled={adjust.isPending}>
            {adjust.isPending ? 'Saving…' : amountValid ? `${verb} ${formatCount(parsed)} cr` : `${verb} credits`}
          </button>
          <button type="button" className="text-button" onClick={() => dialog.current?.close()}>Cancel</button>
        </div>
      </form>
    </dialog>
  )
}
