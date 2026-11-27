import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { handleAdminError, refreshAdminAccess } from '../auth/adminAccess'
import { useSession } from '../auth/session'
import { api, ApiError, errorMessage } from '../lib/api'
import { billingKey, getAddressError, getCompanyNameError, getCuiError, maxAddressLength, maxCompanyNameLength, normalizeCui, toBillingInput } from '../lib/billing'
import type { Billing, BillingInput } from '../lib/billing'
import { formatLocalDay, formatLocalTime } from '../lib/format'
import { queryClient } from '../lib/queryClient'
import { useNotify } from '../lib/useNotify'
import { getEmailError, normalizeEmail } from '../lib/user'
import type { User } from '../lib/user'
import './BillingEditor.css'

interface BillingEditorProps {
  user: User
  isSelf: boolean
  onDirtyChange?: (dirty: boolean) => void
}

type FormErrors = Partial<Record<keyof BillingInput, string>>

function afterFailure(error: unknown, revision: number) {
  void handleAdminError(error, revision)
  if (error instanceof ApiError && error.status === 404) refreshAdminAccess(revision)
}

export default function BillingEditor(props: BillingEditorProps) {
  const revision = useSession((state) => state.revision)
  const billing = useQuery({
    queryKey: billingKey(revision, props.user.id),
    queryFn: async ({ signal }) => {
      try {
        return await api.billing(props.user.id, signal)
      } catch (error) {
        if (revision === useSession.getState().revision) afterFailure(error, revision)
        throw error
      }
    },
  })

  return (
    <div className="billing-editor">
      {billing.isPending && <p className="field-hint" role="status">Se încarcă datele de facturare…</p>}
      {billing.isError && (
        <div className="request-error" role="alert">
          <p>{errorMessage(billing.error)}</p>
          <button type="button" disabled={billing.isFetching} onClick={() => void billing.refetch()}>
            {billing.isFetching ? 'Se încarcă…' : 'Reîncearcă'}
          </button>
        </div>
      )}
      {billing.data !== undefined && (
        <BillingForm key={`${revision}:${props.user.id}`} {...props} billing={billing.data} revision={revision} />
      )}
    </div>
  )
}

function BillingForm({ user, isSelf, onDirtyChange, billing, revision }: BillingEditorProps & {
  billing: Billing | null
  revision: number
}) {
  // Refetches update the saved comparison without replacing an in-progress draft.
  const [draft, setDraft] = useState(() => toBillingInput(billing))
  const [errors, setErrors] = useState<FormErrors>({})
  const companyNameInput = useRef<HTMLInputElement>(null)
  const cuiInput = useRef<HTMLInputElement>(null)
  const addressInput = useRef<HTMLTextAreaElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const saveButton = useRef<HTMLButtonElement>(null)
  const notify = useNotify()
  const id = useId()
  const owner = `pentru ${user.email}`
  const mutation = useMutation({ mutationFn: persist })
  const busy = mutation.isPending
  const removing = busy && mutation.variables === null

  function current() {
    return revision === useSession.getState().revision
  }

  async function persist(input: BillingInput | null) {
    const queryKey = billingKey(revision, user.id)
    await queryClient.cancelQueries({ queryKey, exact: true })
    if (!current()) throw new DOMException('Session changed', 'AbortError')
    let result: Billing | null = null
    if (input === null) await api.deleteBilling(user.id)
    else result = await api.saveBilling(user.id, input)
    if (!current()) return result
    // A focus-triggered read started during the write must not restore the old copy.
    await queryClient.cancelQueries({ queryKey, exact: true })
    if (!current()) return result
    queryClient.setQueryData(queryKey, result)
    return result
  }

  function changeField(field: keyof BillingInput, value: string) {
    const next = { ...draft, [field]: value }
    const saved = toBillingInput(billing)
    setDraft(next)
    setErrors((previous) => ({ ...previous, [field]: undefined }))
    mutation.reset()
    onDirtyChange?.(next.companyName !== saved.companyName || next.cui !== saved.cui
      || next.address !== saved.address || next.email !== saved.email)
  }

  function resetDraft(result: Billing | null) {
    setDraft(toBillingInput(result))
    setErrors({})
    onDirtyChange?.(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const input: BillingInput = {
      companyName: draft.companyName.trim(), cui: normalizeCui(draft.cui),
      address: draft.address.trim(), email: normalizeEmail(draft.email),
    }
    const nextErrors: FormErrors = {
      companyName: getCompanyNameError(input.companyName), cui: getCuiError(input.cui),
      address: getAddressError(input.address), email: getEmailError(input.email),
    }
    setErrors(nextErrors)
    const invalid = nextErrors.companyName ? companyNameInput : nextErrors.cui ? cuiInput
      : nextErrors.address ? addressInput : nextErrors.email ? emailInput : null
    if (invalid) {
      invalid.current?.focus()
      return
    }
    try {
      const result = await mutation.mutateAsync(input)
      if (!current()) return
      resetDraft(result)
      notify({ variant: 'success', message: isSelf ? 'Datele tale de facturare au fost salvate.' : `Datele de facturare ${owner} au fost salvate.` })
    } catch (error) {
      if (!current()) return
      afterFailure(error, revision)
    }
  }

  async function handleRemove() {
    if (busy || !window.confirm(isSelf ? 'Ștergi datele tale de facturare?' : `Ștergi datele de facturare ${owner}?`)) return
    try {
      const result = await mutation.mutateAsync(null)
      if (!current()) return
      resetDraft(result)
      notify({ variant: 'success', message: isSelf ? 'Datele tale de facturare au fost șterse.' : `Datele de facturare ${owner} au fost șterse.` })
      requestAnimationFrame(() => {
        if (current()) saveButton.current?.focus()
      })
    } catch (error) {
      if (!current()) return
      afterFailure(error, revision)
    }
  }

  return (
    <form aria-label="Date de facturare" onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div className="form-fields">
        <div className="form-field">
          <label htmlFor={`${id}-companyName`}>Denumirea firmei</label>
          <input ref={companyNameInput} id={`${id}-companyName`} name="companyName" required
            autoComplete={isSelf ? 'organization' : 'off'} maxLength={maxCompanyNameLength}
            disabled={busy} value={draft.companyName} onChange={(event) => changeField('companyName', event.target.value)}
            aria-invalid={Boolean(errors.companyName)} aria-describedby={errors.companyName ? `${id}-companyName-error` : undefined} />
          {errors.companyName && <p className="field-error" id={`${id}-companyName-error`} role="alert">{errors.companyName}</p>}
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-cui`}>CUI</label>
          <input ref={cuiInput} id={`${id}-cui`} name="cui" required placeholder="RO12345678"
            autoComplete="off" spellCheck={false} disabled={busy} value={draft.cui}
            onChange={(event) => changeField('cui', event.target.value)}
            aria-invalid={Boolean(errors.cui)} aria-describedby={`${id}-cui-hint${errors.cui ? ` ${id}-cui-error` : ''}`} />
          <p className="field-hint" id={`${id}-cui-hint`}>2–10 cifre, cu prefixul RO pentru plătitorii de TVA</p>
          {errors.cui && <p className="field-error" id={`${id}-cui-error`} role="alert">{errors.cui}</p>}
        </div>
        <div className="form-field billing-address">
          <label htmlFor={`${id}-address`}>Adresă</label>
          <textarea ref={addressInput} id={`${id}-address`} name="address" required rows={3}
            autoComplete={isSelf ? 'street-address' : 'off'} maxLength={maxAddressLength}
            disabled={busy} value={draft.address} onChange={(event) => changeField('address', event.target.value)}
            aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? `${id}-address-error` : undefined} />
          {errors.address && <p className="field-error" id={`${id}-address-error`} role="alert">{errors.address}</p>}
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-email`}>E-mail de facturare</label>
          <input ref={emailInput} id={`${id}-email`} name="email" type="email" required maxLength={254}
            autoComplete={isSelf ? 'email' : 'off'} autoCapitalize="none" spellCheck={false}
            disabled={busy} value={draft.email} onChange={(event) => changeField('email', event.target.value)}
            aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${id}-email-error` : undefined} />
          {errors.email && <p className="field-error" id={`${id}-email-error`} role="alert">{errors.email}</p>}
        </div>
      </div>
      <p className="field-hint">{billing
        ? <>Actualizat: <time dateTime={billing.updatedAt}>{formatLocalDay(billing.updatedAt)}, {formatLocalTime(billing.updatedAt)}</time></>
        : 'Nu există date de facturare salvate.'}</p>
      {mutation.isError && <p className="request-error" role="alert">{errorMessage(mutation.error)}</p>}
      <div className="form-actions">
        <button ref={saveButton} type="submit" disabled={busy}>{busy && !removing ? 'Se salvează…' : 'Salvează datele de facturare'}</button>
        {billing && (
          <button className="text-button danger" type="button" disabled={busy} onClick={() => void handleRemove()}>
            {removing ? 'Se șterge…' : 'Șterge datele de facturare'}
          </button>
        )}
      </div>
    </form>
  )
}
