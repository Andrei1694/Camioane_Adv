import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import Authenticated from '../src/auth/Authenticated'
import LoginPage from '../src/pages/LoginPage/LoginPage'
import { api, ApiError } from '../src/lib/api'
import { signIn, useSession } from '../src/auth/session'
import { queryClient } from '../src/lib/queryClient'
import { renderPage } from './helpers/render'
import { deferred, user } from './helpers/fixtures'

it('validates login, retains fields after failure and signs in after retry', async () => {
  const actor = userEvent.setup()
  const login = vi.spyOn(api, 'login').mockRejectedValueOnce(new ApiError(401, 'Date incorecte'))
    .mockResolvedValue({ user: user(), accessToken: 'new-token', expiresIn: 3600 })
  await renderPage(<LoginPage />)
  await actor.click(screen.getByRole('button', { name: 'Autentificare' }))
  expect(login).not.toHaveBeenCalled()
  expect(screen.getByLabelText('E-mail')).toHaveFocus()
  await actor.type(screen.getByLabelText('E-mail'), 'ADMIN@EXAMPLE.TEST')
  await actor.type(screen.getByLabelText('Parolă'), ' twelve chars ')
  await actor.click(screen.getByRole('button', { name: 'Autentificare' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Date incorecte')
  expect(screen.getByLabelText('Parolă')).toHaveValue(' twelve chars ')
  await actor.click(screen.getByRole('button', { name: 'Autentificare' }))
  await waitFor(() => expect(useSession.getState().session?.accessToken).toBe('new-token'))
  expect(login).toHaveBeenLastCalledWith({ email: 'admin@example.test', password: ' twelve chars ' }, expect.anything())
  expect(screen.getByLabelText('Parolă')).toHaveValue('')
})

it('disables repeated login while pending', async () => {
  const pending = deferred<Awaited<ReturnType<typeof api.login>>>()
  const login = vi.spyOn(api, 'login').mockReturnValue(pending.promise)
  const actor = userEvent.setup()
  await renderPage(<LoginPage />)
  await actor.type(screen.getByLabelText('E-mail'), 'admin@example.test')
  await actor.type(screen.getByLabelText('Parolă'), 'long password')
  await actor.click(screen.getByRole('button', { name: 'Autentificare' }))
  expect(await screen.findByRole('button', { name: 'Autentificare în curs…' })).toBeDisabled()
  expect(screen.getByLabelText('E-mail')).toBeDisabled()
  expect(login).toHaveBeenCalledOnce()
  await act(async () => pending.resolve({ user: user(), accessToken: 'new-token', expiresIn: 3600 }))
})

it('redirects signed-out visitors to login without requesting protected data', async () => {
  const me = vi.spyOn(api, 'me')
  const { router } = await renderPage(<Authenticated adminOnly><h1>Protected</h1></Authenticated>, { path: '/protected' })
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(me).not.toHaveBeenCalled()
})

it.each(['OPERATOR', 'DRIVER', 'USER'] as const)('denies management to %s without loading the administrator user list', async (role) => {
  signIn('test-token', 3600)
  vi.spyOn(api, 'me').mockResolvedValue(user({ role }))
  const users = vi.spyOn(api, 'users')
  const { router } = await renderPage(<Authenticated adminOnly><h1>Protected</h1></Authenticated>, { path: '/protected' })
  await waitFor(() => expect(router.state.location.pathname).toBe('/access-denied'))
  expect(users).not.toHaveBeenCalled()
  expect(useSession.getState().session).not.toBeNull()
})

it('verifies an Admin before showing protected content and retries transient denial-check failures', async () => {
  signIn('test-token', 3600)
  vi.spyOn(api, 'me').mockResolvedValue(user())
  const users = vi.spyOn(api, 'users').mockRejectedValueOnce(new ApiError(500, 'Temporar indisponibil')).mockResolvedValue([user()])
  await renderPage(<Authenticated adminOnly><h1>Protected</h1></Authenticated>)
  expect(await screen.findByRole('heading', { name: 'Accesul de administrator nu a putut fi verificat' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Protected' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reverifică accesul' }))
  expect(await screen.findByRole('heading', { name: 'Protected' })).toBeInTheDocument()
  expect(users).toHaveBeenCalledTimes(2)
})

it('retries account verification without clearing the session', async () => {
  signIn('test-token', 3600)
  vi.spyOn(api, 'me').mockRejectedValueOnce(new ApiError(0, 'Offline')).mockResolvedValue(user({ role: 'USER' }))
  await renderPage(<Authenticated><h1>My profile</h1></Authenticated>)
  expect(await screen.findByRole('heading', { name: 'Sesiunea ta nu a putut fi verificată' })).toBeInTheDocument()
  expect(useSession.getState().session).not.toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByRole('heading', { name: 'My profile' })).toBeInTheDocument()
})

it('redirects an assigned Admin whose access check returns 403', async () => {
  signIn('test-token', 3600)
  vi.spyOn(api, 'me').mockResolvedValue(user())
  vi.spyOn(api, 'users').mockRejectedValue(new ApiError(403, 'Forbidden'))
  const { router } = await renderPage(<Authenticated adminOnly><h1>Protected</h1></Authenticated>, { path: '/protected' })
  await waitFor(() => expect(router.state.location.pathname).toBe('/access-denied'))
  expect(queryClient.getQueryData(['admin-access', useSession.getState().revision])).toEqual({ status: 'denied' })
})
