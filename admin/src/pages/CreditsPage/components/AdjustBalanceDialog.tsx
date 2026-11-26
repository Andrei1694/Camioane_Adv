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

  const email = users.find((user) => user.id === userId)?.email ?? 'acest cont'
  const parsed = /^\d+$/.test(amount.trim()) ? Number(amount.trim()) : Number.NaN
  const amountValid = Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maxAdjustment
  const current = balance.data?.balance
  const overdraws = direction === 'remove' && amountValid && current !== undefined && parsed > current
  const after = amountValid && current !== undefined && !overdraws ? current + (direction === 'add' ? parsed : -parsed) : undefined
  const verb = direction === 'add' ? 'Adaugă' : 'Scade'

  function validate(): Errors {
    const text = note.trim()
    return {
      account: userId === '' ? 'Alege contul al cărui sold vrei să-l ajustezi.' : undefined,
      amount: !amountValid ? `Introdu un număr întreg de credite, de la 1 la ${formatCount(maxAdjustment)}.`
        : overdraws ? `${email} are doar ${formatCount(current ?? 0)} cr disponibili pentru scădere.` : undefined,
      note: text === '' ? 'Scrie o notă care explică motivul modificării soldului.'
        : Array.from(text).length > maxNoteLength ? `Nota poate avea cel mult ${maxNoteLength} de caractere.` : undefined,
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
        ? `Credite adăugate în contul ${email}: ${formatCount(parsed)} cr. Soldul actual este ${formatCount(transaction.balanceAfter)} cr.`
        : `Credite scăzute din contul ${email}: ${formatCount(parsed)} cr. Soldul actual este ${formatCount(transaction.balanceAfter)} cr.`)
      dialog.current?.close()
    } catch {
      // The error shows in the dialog from the mutation's state.
    } finally {
      if (revision === useSession.getState().revision) onChanged()
    }
  }

  const balanceHint = userId === '' ? 'Contul al cărui sold se modifică.'
    : balance.data ? `Sold: ${formatCount(balance.data.balance)} cr.`
    : balance.isError ? `Soldul nu a putut fi încărcat. ${errorMessage(balance.error)}`
    : 'Se încarcă soldul…'

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
          <h2 id={`${id}-title`}>Ajustează soldul</h2>
          <p className="dialog-sub" id={`${id}-sub`}>Fiecare ajustare adaugă o înregistrare în registrul de tranzacții, împreună cu nota ta.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Închide" onClick={() => dialog.current?.close()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>

      <form className="adjust-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="form-field adjust-account">
          <label htmlFor={`${id}-account`}>Cont</label>
          <select id={`${id}-account`} ref={(element) => { fields.current.account = element }} value={userId}
            aria-invalid={errors.account ? true : undefined} aria-describedby={`${id}-account-hint`}
            onChange={(event) => { setUserId(event.target.value); setErrors((old) => ({ ...old, account: undefined, amount: undefined })) }}>
            <option value="">Alege un cont</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
          </select>
          <p id={`${id}-account-hint`} className={errors.account || balance.isError ? 'field-error' : 'field-hint'} aria-live="polite">
            {errors.account ?? balanceHint}
            {!errors.account && balance.isError && (
              <> <button type="button" className="text-button" disabled={balance.isFetching} onClick={() => void balance.refetch()}>
                {balance.isFetching ? 'Se reîncearcă…' : 'Reîncearcă'}
              </button></>
            )}
          </p>
        </div>

        <fieldset className="choice-field">
          <legend>Modificare</legend>
          <div className="choices">
            {(['add', 'remove'] as const).map((value) => (
              <label key={value} className="choice">
                <input type="radio" name={`${id}-direction`} value={value} checked={direction === value}
                  onChange={() => { setDirection(value); setErrors((old) => ({ ...old, amount: undefined })) }} />
                {value === 'add' ? 'Adaugă credite' : 'Scade credite'}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-field adjust-amount">
          <label htmlFor={`${id}-amount`}>Credite</label>
          <input id={`${id}-amount`} ref={(element) => { fields.current.amount = element }} inputMode="numeric" autoComplete="off"
            value={amount} aria-invalid={errors.amount ? true : undefined} aria-describedby={`${id}-amount-hint`}
            onChange={(event) => { setAmount(event.target.value); setErrors((old) => ({ ...old, amount: undefined })) }} />
          <p id={`${id}-amount-hint`} className={errors.amount ? 'field-error' : 'field-hint'}>
            {errors.amount ?? (after !== undefined ? `Sold ulterior: ${formatCount(after)} cr.` : `Un număr întreg de la 1 la ${formatCount(maxAdjustment)}.`)}
          </p>
        </div>

        <div className="form-field adjust-note">
          <label htmlFor={`${id}-note`}>Notă</label>
          <textarea id={`${id}-note`} ref={(element) => { fields.current.note = element }} rows={3} value={note}
            aria-invalid={errors.note ? true : undefined} aria-describedby={`${id}-note-hint`}
            onChange={(event) => { setNote(event.target.value); setErrors((old) => ({ ...old, note: undefined })) }} />
          <p id={`${id}-note-hint`} className={errors.note ? 'field-error' : 'field-hint'}>
            {errors.note ?? 'Motivul modificării soldului. Titularul contului poate vedea această notă.'}
          </p>
        </div>

        {adjust.isError && <p className="request-error adjust-error" role="alert">Soldul nu a putut fi ajustat. {errorMessage(adjust.error)}</p>}

        <div className="dialog-actions adjust-actions">
          <button type="submit" className="primary-button" disabled={adjust.isPending}>
            {adjust.isPending ? 'Se salvează…' : amountValid ? `${verb} ${formatCount(parsed)} cr` : `${verb} credite`}
          </button>
          <button type="button" className="text-button" onClick={() => dialog.current?.close()}>Anulează</button>
        </div>
      </form>
    </dialog>
  )
}
