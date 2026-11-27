import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { getDisplayNameError, getEmailError, getPasswordError, getPhoneError, isRole, isUserStatus, normalizeEmail, roleLabels, roles, userStatusLabels, userStatuses } from '../../../lib/user'
import type { Role, User, UserInput, UserStatus } from '../../../lib/user'
import AvatarEditor from '../../../components/AvatarEditor'
import BillingEditor from '../../../components/BillingEditor'

interface UserFormProps {
  user?: User
  users: readonly User[]
  isSelf: boolean
  pending: boolean
  error: string
  onSave: (user: UserInput) => Promise<void>
  onCancel: () => void
}

interface FormErrors {
  email?: string
  password?: string
  displayName?: string
  phone?: string
}

export default function UserForm({ user, users, isSelf, pending, error, onSave, onCancel }: UserFormProps) {
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>(user?.role ?? 'USER')
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [status, setStatus] = useState<UserStatus>(user?.status ?? 'ACTIVE')
  const [errors, setErrors] = useState<FormErrors>({})
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const displayNameInput = useRef<HTMLInputElement>(null)
  const phoneInput = useRef<HTMLInputElement>(null)
  const billingDirty = useRef(false)
  const id = useId()

  useEffect(() => {
    emailInput.current?.focus()
  }, [])

  function canClose() {
    return !billingDirty.current || window.confirm('Datele de facturare au modificări nesalvate. Continui fără ele?')
  }

  function handleCancel() {
    if (!pending && canClose()) onCancel()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const normalizedEmail = normalizeEmail(email)
    const nextErrors: FormErrors = {
      email: getEmailError(normalizedEmail),
      displayName: getDisplayNameError(displayName.trim()),
      phone: getPhoneError(phone.trim()),
    }

    if (!nextErrors.email && users.some((existing) => (
      existing.email === normalizedEmail && existing.id !== user?.id
    ))) {
      nextErrors.email = 'Există deja un utilizator cu această adresă de e-mail.'
    }

    if (!user || password.length > 0) nextErrors.password = getPasswordError(password)

    setErrors(nextErrors)

    if (nextErrors.email) {
      emailInput.current?.focus()
      return
    }

    if (nextErrors.password) {
      passwordInput.current?.focus()
      return
    }

    if (nextErrors.displayName) {
      displayNameInput.current?.focus()
      return
    }
    if (nextErrors.phone) {
      phoneInput.current?.focus()
      return
    }

    if (!canClose()) return

    void onSave({
      email: normalizedEmail, role, displayName: displayName.trim(), phone: phone.trim() || null, status,
      ...(!user || password ? { password } : {}),
    })
  }

  return (
    <section className="user-form" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{user ? 'Editează utilizatorul' : 'Adaugă un utilizator'}</h2>
      {user && (
        <div className="user-form-picture" role="group" aria-labelledby={`${id}-picture`}>
          <p className="user-form-picture-label" id={`${id}-picture`}>
            Fotografie de profil<span className="optional-label"> (se salvează imediat, separat de formular)</span>
          </p>
          <AvatarEditor user={user} isSelf={isSelf} />
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-fields">
          <div className="form-field">
            <label htmlFor={`${id}-displayName`}>Nume<span className="optional-label"> (opțional)</span></label>
            <input ref={displayNameInput} id={`${id}-displayName`} name="displayName" autoComplete="off"
              value={displayName} disabled={pending} maxLength={200}
              aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? `${id}-name-error` : undefined}
              onChange={(event) => {
                setDisplayName(event.target.value)
                setErrors((current) => ({ ...current, displayName: undefined }))
              }} />
            {errors.displayName && <p className="field-error" id={`${id}-name-error`} role="alert">{errors.displayName}</p>}
          </div>
          <div className="form-field">
            <label htmlFor={`${id}-phone`}>Telefon<span className="optional-label"> (opțional)</span></label>
            <input ref={phoneInput} id={`${id}-phone`} name="phone" type="tel" autoComplete="off"
              value={phone} disabled={pending} maxLength={32} placeholder="+40712345678"
              aria-invalid={Boolean(errors.phone)} aria-describedby={`${id}-phone-hint${errors.phone ? ` ${id}-phone-error` : ''}`}
              onChange={(event) => {
                setPhone(event.target.value)
                setErrors((current) => ({ ...current, phone: undefined }))
              }} />
            <p className="field-hint" id={`${id}-phone-hint`}>Include prefixul țării, fără spații. Lasă gol pentru a elimina numărul.</p>
            {errors.phone && <p className="field-error" id={`${id}-phone-error`} role="alert">{errors.phone}</p>}
          </div>
          <div className="form-field">
            <label htmlFor={`${id}-email`}>E-mail</label>
            <input
              ref={emailInput}
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={pending}
              value={email}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${id}-email-error` : undefined}
              onChange={(event) => {
                setEmail(event.target.value)
                setErrors((current) => ({ ...current, email: undefined }))
              }}
            />
            {errors.email && <p className="field-error" id={`${id}-email-error`} role="alert">{errors.email}</p>}
          </div>
          <div className="form-field">
            <label htmlFor={`${id}-password`}>
              Parolă{user && <span className="optional-label"> (opțional)</span>}
            </label>
            <input
              ref={passwordInput}
              id={`${id}-password`}
              name="password"
              type="password"
              autoComplete="new-password"
              required={!user}
              disabled={pending}
              value={password}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={`${id}-password-hint${errors.password ? ` ${id}-password-error` : ''}`}
              onChange={(event) => {
                setPassword(event.target.value)
                setErrors((current) => ({ ...current, password: undefined }))
              }}
            />
            <p className="field-hint" id={`${id}-password-hint`}>12–128 de caractere.{user && ' Lasă câmpul gol pentru a păstra parola actuală.'}</p>
            {errors.password && <p className="field-error" id={`${id}-password-error`} role="alert">{errors.password}</p>}
          </div>
          <div className="form-field">
            <label htmlFor={`${id}-role`}>Rol</label>
            <select id={`${id}-role`} name="role" value={role} disabled={pending || isSelf}
              aria-describedby={isSelf ? `${id}-role-hint` : undefined}
              onChange={(event) => {
                const selectedRole = event.target.value
                if (isRole(selectedRole)) setRole(selectedRole)
              }}>
              {roles.map((option) => <option key={option} value={option}>{roleLabels[option]}</option>)}
            </select>
            {isSelf && <p className="field-hint" id={`${id}-role-hint`}>Rolul tău trebuie schimbat de un alt administrator.</p>}
          </div>
          <div className="form-field">
            <label htmlFor={`${id}-status`}>Stare cont</label>
            <select id={`${id}-status`} name="status" value={status} disabled={pending || isSelf}
              aria-describedby={`${id}-status-hint`}
              onChange={(event) => {
                if (isUserStatus(event.target.value)) setStatus(event.target.value)
              }}>
              {userStatuses.map((option) => <option key={option} value={option}>{userStatusLabels[option]}</option>)}
            </select>
            <p className="field-hint" id={`${id}-status-hint`}>{isSelf
              ? 'Nu îți poți dezactiva propriul cont.'
              : 'Dezactivarea oprește accesul și păstrează contul și istoricul. Reactivarea cere o nouă autentificare.'}</p>
          </div>
        </div>
        {isSelf && <p className="field-hint">Schimbarea adresei de e-mail sau a parolei te va deconecta.</p>}
        {!user && <p className="field-hint">Datele de facturare pot fi adăugate după crearea contului.</p>}
        {error && <p className="request-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Se salvează…' : 'Salvează'}</button>
          <button type="button" disabled={pending} onClick={handleCancel}>Anulează</button>
        </div>
      </form>
      {user && (
        <fieldset className="user-form-billing" disabled={pending} aria-labelledby={`${id}-billing`}>
          <p className="user-form-billing-label" id={`${id}-billing`}>
            Date de facturare<span className="optional-label"> (se salvează separat, cu butonul propriu)</span>
          </p>
          <BillingEditor user={user} isSelf={isSelf} onDirtyChange={(dirty) => { billingDirty.current = dirty }} />
        </fieldset>
      )}
    </section>
  )
}
