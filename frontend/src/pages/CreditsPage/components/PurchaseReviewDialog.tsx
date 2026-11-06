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

const pendingLabels: Record<Settlement, string> = { confirm: 'Se confirmă…', fail: 'Se marchează…', cancel: 'Se anulează…' }
const failureLeads: Record<Settlement, string> = {
  confirm: "Achiziția nu a putut fi confirmată.",
  fail: "Plata nu a putut fi marcată ca eșuată.",
  cancel: "Achiziția nu a putut fi anulată.",
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
        return `S-a confirmat achiziția de ${credits} cr pentru ${name}. Soldul actual este ${formatCount(transaction.balanceAfter)} cr.`
      }
      if (action === 'fail') {
        await api.failPurchase(purchase.id)
        return `Plata pentru achiziția de ${credits} cr pentru ${name} a fost marcată ca eșuată. Nu au fost adăugate credite.`
      }
      await api.cancelPurchase(purchase.id)
      return `S-a anulat achiziția de ${credits} cr pentru ${name}. Nu au fost adăugate credite.`
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
          <h2 id={`${id}-title`}>{credits} cr pentru {name}</h2>
          <p className="dialog-sub" id={`${id}-sub`}>
            {/* Non-breaking spaces keep each separator at the end of its line when the subline wraps. */}
            Solicitată {formatLocalDay(purchase.createdAt)}, <span className="num">{formatLocalTime(purchase.createdAt)}</span>
            {' · '}în așteptare de <span className="num">{formatDuration((asOf - Date.parse(purchase.createdAt)) / 60_000)}</span>
          </p>
        </div>
        <button type="button" className="icon-button" aria-label="Închide verificarea" onClick={() => dialog.current?.close()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>

      <dl className="review-checks">
        <div className="check">
          <dt>Sumă de plată</dt>
          <dd>
            <span className="num">{amount.value}</span><span className="unit"> {amount.unit}</span>
            <span className="unit"> · {credits} cr la <span className="num">{formatMoney(purchase.unitPriceMinor, purchase.currency)}</span> fiecare</span>
          </dd>
        </div>
        <div className={deleted ? 'check check-fail' : 'check'}>
          <dt>Sold</dt>
          <dd aria-live="polite">
            {deleted ? 'Contul a fost șters, deci aceste credite nu mai pot fi adăugate la un sold.'
              : balance.data ? (
                <>
                  <span className="num">{formatCount(balance.data.balance)} cr</span> acum,{' '}
                  <span className="num">{formatCount(balance.data.balance + purchase.credits)} cr</span> după confirmare.
                </>
              )
              : balance.isError ? (
                <span className="inline-error">
                  <span className="danger">Soldul nu a putut fi încărcat. {errorMessage(balance.error)}</span>
                  <button type="button" className="text-button" disabled={balance.isFetching} onClick={() => void balance.refetch()}>
                    {balance.isFetching ? 'Se reîncearcă…' : 'Reîncearcă'}
                  </button>
                </span>
              )
              : <span className="missing">Se încarcă soldul…</span>}
          </dd>
        </div>
      </dl>

      <div className="form-field dialog-field">
        <label htmlFor={`${id}-reference`}>Referința plății <span className="optional-label">(opțional)</span></label>
        <input id={`${id}-reference`} value={reference} maxLength={maxReferenceLength} autoComplete="off" spellCheck={false}
          disabled={deleted} aria-describedby={`${id}-reference-hint`} onChange={(event) => setReference(event.target.value)} />
        <p id={`${id}-reference-hint`} className="field-hint">Numărul transferului bancar sau al chitanței verificate. Fiecare referință poate confirma o singură achiziție.</p>
      </div>

      {settle.isError && settle.variables && <p className="request-error" role="alert">{failureLeads[settle.variables]} {errorMessage(settle.error)}</p>}

      <div className="dialog-actions">
        <button type="button" className="primary-button" disabled={busy || deleted} aria-describedby={deleted ? `${id}-blocked` : undefined}
          onClick={() => void run('confirm')}>
          {busy && settle.variables === 'confirm' ? pendingLabels.confirm : `Confirmă și adaugă ${credits} cr`}
        </button>
        <button type="button" disabled={busy} onClick={() => void run('fail')}>
          {busy && settle.variables === 'fail' ? pendingLabels.fail : 'Marchează plata ca eșuată'}
        </button>
        <button type="button" className="text-button danger" disabled={busy} onClick={() => void run('cancel')}>
          {busy && settle.variables === 'cancel' ? pendingLabels.cancel : 'Anulează achiziția'}
        </button>
      </div>
      {deleted && <p id={`${id}-blocked`} className="dialog-note">Confirmarea nu este posibilă: contul nu mai există. Marchează plata ca eșuată sau anulează achiziția.</p>}
    </dialog>
  )
}
