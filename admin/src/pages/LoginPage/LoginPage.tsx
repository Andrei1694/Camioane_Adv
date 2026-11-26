import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, errorMessage } from '../../lib/api'
import { getEmailError, getPasswordError, normalizeEmail } from '../../lib/user'
import { signIn, useSession } from '../../auth/session'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string, password?: string }>({})
  const [failure, setFailure] = useState('')
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const message = useSession((state) => state.message)
  const login = useMutation({ mutationFn: api.login })

  useEffect(() => { emailInput.current?.focus() }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (login.isPending) return
    const normalized = normalizeEmail(email)
    const next = { email: getEmailError(normalized), password: getPasswordError(password) }
    setErrors(next)
    setFailure('')
    if (next.email) { emailInput.current?.focus(); return }
    if (next.password) { passwordInput.current?.focus(); return }
    try {
      const result = await login.mutateAsync({ email: normalized, password })
      setPassword('')
      signIn(result.accessToken, result.expiresIn)
    } catch (error) {
      setFailure(errorMessage(error))
    } finally {
      login.reset()
    }
  }

  return (
    <section className="login-panel">
      <h1>Autentificare</h1>
      <p className="page-description">Folosește contul oferit de administratorul tău.</p>
      {message && <p className="status-message" role="status">{message}</p>}
      <form className="user-form" onSubmit={submit} noValidate aria-label="Autentificare">
        <div className="form-field">
          <label htmlFor="login-email">E-mail</label>
          <input ref={emailInput} id="login-email" name="email" type="email" autoComplete="username" autoCapitalize="none"
            spellCheck={false} required disabled={login.isPending} value={email}
            aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'login-email-error' : undefined}
            onChange={(event) => { setEmail(event.target.value); setErrors((old) => ({ ...old, email: undefined })) }} />
          {errors.email && <p className="field-error" id="login-email-error" role="alert">{errors.email}</p>}
        </div>
        <div className="form-field">
          <label htmlFor="login-password">Parolă</label>
          <input ref={passwordInput} id="login-password" name="password" type="password" autoComplete="current-password"
            required disabled={login.isPending} value={password}
            aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'login-password-error' : undefined}
            onChange={(event) => { setPassword(event.target.value); setErrors((old) => ({ ...old, password: undefined })) }} />
          {errors.password && <p className="field-error" id="login-password-error" role="alert">{errors.password}</p>}
        </div>
        {failure && <p className="request-error" role="alert">{failure}</p>}
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={login.isPending}>{login.isPending ? 'Autentificare în curs…' : 'Autentificare'}</button>
        </div>
      </form>
    </section>
  )
}
