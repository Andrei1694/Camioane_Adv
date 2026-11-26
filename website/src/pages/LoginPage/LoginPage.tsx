import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import AccountLayout from '../../components/AccountLayout'
import AuthenticationUnavailable from '../../components/AuthenticationUnavailable'
import { authErrorMessage } from '../../auth/errorMessage'
import { signIn, useSession } from '../../auth/session'
import { api, isApiConfigured } from '../../lib/api'
import { getEmailError, getPasswordError } from '../../lib/user'
import type { Credentials } from '../../lib/user'

export default function LoginPage() {
  const session = useSession((state) => state.session)
  const message = useSession((state) => state.message)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string, password?: string }>({})
  const [failure, setFailure] = useState('')
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const pendingRequest = useRef<AbortController | null>(null)
  const login = useMutation({
    mutationFn: ({ credentials, signal }: { credentials: Credentials, signal: AbortSignal }) => api.login(credentials, signal),
  })

  useEffect(() => () => { pendingRequest.current?.abort() }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingRequest.current) return
    const normalized = email.trim().toLowerCase()
    const next = { email: getEmailError(normalized), password: getPasswordError(password) }
    setErrors(next)
    setFailure('')
    if (next.email) { emailInput.current?.focus(); return }
    if (next.password) { passwordInput.current?.focus(); return }

    const controller = new AbortController()
    const revision = useSession.getState().revision
    pendingRequest.current = controller
    try {
      const result = await login.mutateAsync({ credentials: { email: normalized, password }, signal: controller.signal })
      if (controller.signal.aborted || revision !== useSession.getState().revision) return
      setPassword('')
      signIn(result.accessToken, result.expiresIn)
    } catch (error) {
      if (!controller.signal.aborted && revision === useSession.getState().revision) setFailure(authErrorMessage(error))
    } finally {
      pendingRequest.current = null
      login.reset()
    }
  }

  if (session) return <Navigate to="/account" replace />
  if (!isApiConfigured()) return <AuthenticationUnavailable />

  return (
    <AccountLayout title="Autentificare" compact>
      <p className="account-lead">Folosește contul oferit de administratorul tău.</p>
      {message && <p className="account-notice" role="status">{message}</p>}
      <form className="account-form" onSubmit={submit} noValidate aria-label="Autentificare" aria-busy={login.isPending}>
        <div className="account-field">
          <label htmlFor="login-email">E-mail</label>
          <input ref={emailInput} id="login-email" name="email" type="email" autoComplete="username"
            autoCapitalize="none" spellCheck={false} required disabled={login.isPending} value={email}
            aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'login-email-error' : undefined}
            onChange={(event) => { setEmail(event.target.value); setErrors((old) => ({ ...old, email: undefined })) }} />
          {errors.email && <p id="login-email-error" className="account-field-error" role="alert">{errors.email}</p>}
        </div>
        <div className="account-field">
          <label htmlFor="login-password">Parolă</label>
          <input ref={passwordInput} id="login-password" name="password" type="password" autoComplete="current-password"
            required disabled={login.isPending} value={password}
            aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'login-password-error' : undefined}
            onChange={(event) => { setPassword(event.target.value); setErrors((old) => ({ ...old, password: undefined })) }} />
          {errors.password && <p id="login-password-error" className="account-field-error" role="alert">{errors.password}</p>}
        </div>
        {failure && <p className="account-notice" role="alert">{failure}</p>}
        <button className="button button-primary" type="submit" disabled={login.isPending}>
          {login.isPending ? 'Autentificare în curs…' : 'Autentificare'}
        </button>
      </form>
    </AccountLayout>
  )
}
