import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { getEmailError, normalizeEmail } from '../user'
import type { User } from '../user'

interface UserFormProps {
  user?: User
  users: readonly User[]
  onSave: (user: User) => void
  onCancel: () => void
}

interface FormErrors {
  email?: string
  password?: string
}

export default function UserForm({ user, users, onSave, onCancel }: UserFormProps) {
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const id = useId()

  useEffect(() => {
    emailInput.current?.focus()
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmail = normalizeEmail(email)
    const nextErrors: FormErrors = { email: getEmailError(normalizedEmail) }

    if (!nextErrors.email && users.some((existing) => (
      existing.email === normalizedEmail && existing.email !== user?.email
    ))) {
      nextErrors.email = 'A user with this email already exists.'
    }

    const passwordLength = Array.from(password).length

    if ((!user || passwordLength > 0) && (passwordLength < 12 || passwordLength > 128)) {
      nextErrors.password = 'Use a password with 12–128 characters.'
    }

    setErrors(nextErrors)

    if (nextErrors.email) {
      emailInput.current?.focus()
      return
    }

    if (nextErrors.password) {
      passwordInput.current?.focus()
      return
    }

    setPassword('')
    onSave({ email: normalizedEmail })
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
            value={password}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={`${id}-password-hint${errors.password ? ` ${id}-password-error` : ''}`}
            onChange={(event) => {
              setPassword(event.target.value)
              setErrors((current) => ({ ...current, password: undefined }))
            }}
          />
          <p className="field-hint" id={`${id}-password-hint`}>12–128 characters. Demo only; never saved.</p>
          {errors.password && <p className="field-error" id={`${id}-password-error`} role="alert">{errors.password}</p>}
        </div>
      </div>
      <div className="form-actions">
        <button className="primary-button" type="submit">Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
