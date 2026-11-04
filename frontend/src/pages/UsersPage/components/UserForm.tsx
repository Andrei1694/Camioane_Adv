import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { getEmailError, getPasswordError, normalizeEmail } from '../../../lib/user'
import type { Role, User, UserInput } from '../../../lib/user'

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
}

export default function UserForm({ user, users, isSelf, pending, error, onSave, onCancel }: UserFormProps) {
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>(user?.role ?? 'USER')
  const [errors, setErrors] = useState<FormErrors>({})
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const id = useId()

  useEffect(() => {
    emailInput.current?.focus()
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const normalizedEmail = normalizeEmail(email)
    const nextErrors: FormErrors = { email: getEmailError(normalizedEmail) }

    if (!nextErrors.email && users.some((existing) => (
      existing.email === normalizedEmail && existing.id !== user?.id
    ))) {
      nextErrors.email = 'A user with this email already exists.'
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

    void onSave({ email: normalizedEmail, role, ...(!user || password ? { password } : {}) })
  }

  return (
    <form className="user-form" aria-labelledby={`${id}-title`} onSubmit={handleSubmit} noValidate>
      <h2 id={`${id}-title`}>{user ? 'Edit user' : 'Add user'}</h2>
      <div className="form-fields">
        <div className="form-field">
          <label htmlFor={`${id}-email`}>Email</label>
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
            Password{user && <span className="optional-label"> (optional)</span>}
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
          <p className="field-hint" id={`${id}-password-hint`}>12–128 characters.{user && ' Leave blank to keep the current password.'}</p>
          {errors.password && <p className="field-error" id={`${id}-password-error`} role="alert">{errors.password}</p>}
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-role`}>Role</label>
          <select id={`${id}-role`} name="role" value={role} disabled={pending || isSelf}
            aria-describedby={isSelf ? `${id}-role-hint` : undefined}
            onChange={(event) => setRole(event.target.value === 'ADMIN' ? 'ADMIN' : 'USER')}>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
          {isSelf && <p className="field-hint" id={`${id}-role-hint`}>Another administrator must change your role.</p>}
        </div>
      </div>
      {isSelf && <p className="field-hint">Changing your email or password will sign you out.</p>}
      {error && <p className="request-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
        <button type="button" disabled={pending} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
