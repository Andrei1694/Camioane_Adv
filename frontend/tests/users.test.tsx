import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import UsersPage from '../src/pages/UsersPage/UsersPage'
import { api, ApiError } from '../src/lib/api'
import { queryClient } from '../src/lib/queryClient'
import { useSession } from '../src/auth/session'
import { authenticate, renderPage } from './helpers/render'
import { deferred, id, user } from './helpers/fixtures'

const other = user({ id: id(9), email: 'other@example.test', role: 'USER' })
beforeEach(() => authenticate(user(), [user(), other]))

it('validates required fields and creates a normalized account', async () => {
  const create = vi.spyOn(api, 'createUser').mockResolvedValue(other)
  const actor = userEvent.setup()
  await renderPage(<UsersPage />, { users: [user()] })
  await actor.click(screen.getByRole('button', { name: 'Adaugă un utilizator' }))
  await actor.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(create).not.toHaveBeenCalled()
  expect(screen.getByLabelText('E-mail')).toHaveFocus()
  await actor.type(screen.getByLabelText('E-mail'), ' OTHER@EXAMPLE.TEST ')
  await actor.type(screen.getByLabelText(/^Parolă/), 'long password')
  await actor.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(create).toHaveBeenCalled())
  expect(create.mock.calls[0][0]).toEqual({ email: 'other@example.test', password: 'long password', role: 'USER' })
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Salvează' })).not.toBeInTheDocument())
  expect(queryClient.getQueryData(['admin-access', useSession.getState().revision])).toMatchObject({ users: expect.arrayContaining([other]) })
})

it('rejects duplicate emails and omits a blank edit password', async () => {
  const update = vi.spyOn(api, 'updateUser').mockResolvedValue(other)
  const actor = userEvent.setup()
  await renderPage(<UsersPage />, { users: [user(), other] })
  await actor.click(screen.getByRole('button', { name: `Editează ${other.email}` }))
  await actor.clear(screen.getByLabelText('E-mail'))
  await actor.type(screen.getByLabelText('E-mail'), user().email)
  await actor.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Există deja')
  expect(update).not.toHaveBeenCalled()
  await actor.clear(screen.getByLabelText('E-mail'))
  await actor.type(screen.getByLabelText('E-mail'), other.email)
  await actor.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(update).toHaveBeenCalledWith(other.id, { email: other.email, role: 'USER' }))
})

it('retains entered values after failure and disables pending submissions', async () => {
  const pending = deferred<ReturnType<typeof user>>()
  vi.spyOn(api, 'updateUser').mockReturnValue(pending.promise)
  const actor = userEvent.setup()
  await renderPage(<UsersPage />, { users: [user(), other] })
  await actor.click(screen.getByRole('button', { name: `Editează ${other.email}` }))
  await actor.clear(screen.getByLabelText('E-mail'))
  await actor.type(screen.getByLabelText('E-mail'), 'changed@example.test')
  await actor.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByRole('button', { name: 'Se salvează…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Anulează' })).toBeDisabled()
  await act(async () => pending.reject(new ApiError(500, 'Nu s-a salvat')))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu s-a salvat')
  expect(screen.getByLabelText('E-mail')).toHaveValue('changed@example.test')
})

it('prevents self-deletion and self-demotion, and signs out after self-edit', async () => {
  vi.spyOn(api, 'updateUser').mockResolvedValue(user({ email: 'changed@example.test' }))
  const actor = userEvent.setup()
  await renderPage(<UsersPage />)
  expect(screen.getByRole('button', { name: `Șterge ${user().email}` })).toBeDisabled()
  await actor.click(screen.getByRole('button', { name: `Editează ${user().email}` }))
  expect(screen.getByLabelText('Rol')).toBeDisabled()
  await actor.clear(screen.getByLabelText('E-mail'))
  await actor.type(screen.getByLabelText('E-mail'), 'changed@example.test')
  await actor.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(useSession.getState().session).toBeNull())
})

it('requires confirmation before deleting another account and updates the cache after success', async () => {
  const remove = vi.spyOn(api, 'deleteUser').mockResolvedValue(undefined)
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  await renderPage(<UsersPage />, { users: [user(), other] })
  await userEvent.click(screen.getByRole('button', { name: `Șterge ${other.email}` }))
  expect(remove).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: `Șterge ${other.email}` }))
  await waitFor(() => expect(remove).toHaveBeenCalled())
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining(other.email))
  await waitFor(() => expect(queryClient.getQueryData(['admin-access', useSession.getState().revision])).toMatchObject({ users: [user()] }))
})
