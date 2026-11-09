import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import Avatar from '../src/components/Avatar'
import AvatarEditor from '../src/components/AvatarEditor'
import { api, ApiError } from '../src/lib/api'
import { queryClient } from '../src/lib/queryClient'
import { useSession } from '../src/auth/session'
import { authenticate, renderPage } from './helpers/render'
import { deferred, id, user } from './helpers/fixtures'

beforeEach(() => authenticate())
const pictureUser = user({ avatar: { url: `/users/${id(1)}/avatar`, updatedAt: '2026-11-10' } })

it('shows an initial on load failure and revokes loaded object URLs on unmount', async () => {
  vi.spyOn(api, 'avatarImage').mockResolvedValue(new Blob(['image']))
  const view = await renderPage(<Avatar user={pictureUser} size={96} label="Profile picture" />)
  await waitFor(() => expect(view.container.querySelector('img')).toHaveAttribute('src', 'blob:test-object'))
  fireEvent.error(view.container.querySelector('img')!)
  expect(screen.getByRole('img', { name: 'Profile picture' })).toHaveTextContent('A')
  expect(view.container.querySelector('img')).toBeNull()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-object')
  view.unmount()
})

it('rejects invalid picture selections before upload', async () => {
  const upload = vi.spyOn(api, 'uploadAvatar')
  const { container } = await renderPage(<AvatarEditor user={user()} isSelf />)
  fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [new File(['x'], 'bad.txt', { type: 'text/plain' })] } })
  expect(await screen.findByRole('alert')).toHaveTextContent('nu este o imagine')
  expect(upload).not.toHaveBeenCalled()
})

it('uploads immediately, reports progress and refreshes account caches', async () => {
  const pending = deferred<ReturnType<typeof user>>()
  const upload = vi.spyOn(api, 'uploadAvatar').mockReturnValue(pending.promise)
  const { container } = await renderPage(<AvatarEditor user={user()} isSelf />)
  const input = new File(['12345'], 'avatar.png', { type: 'image/png' })
  fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [input] } })
  await waitFor(() => expect(upload).toHaveBeenCalledOnce())
  expect(screen.getByRole('button', { name: 'Încarcă o fotografie' })).toBeDisabled()
  act(() => upload.mock.calls[0][2]?.onProgress?.(3))
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')
  act(() => upload.mock.calls[0][2]?.onSent?.())
  await act(async () => pending.resolve(pictureUser))
  await waitFor(() => expect(queryClient.getQueryData(['me', useSession.getState().revision])).toEqual(pictureUser))
})

it('allows retry after transient failure', async () => {
  const upload = vi.spyOn(api, 'uploadAvatar').mockRejectedValueOnce(new ApiError(500, 'Try again')).mockResolvedValue(pictureUser)
  const { container } = await renderPage(<AvatarEditor user={user()} isSelf />)
  fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [new File(['x'], 'avatar.png', { type: 'image/png' })] } })
  await userEvent.click(await screen.findByRole('button', { name: /Reîncearcă/ }))
  await waitFor(() => expect(upload).toHaveBeenCalledTimes(2))
})

it('removes a picture only after confirmation and updates the account cache', async () => {
  const revision = authenticate(pictureUser)
  vi.spyOn(api, 'avatarImage').mockResolvedValue(new Blob(['image']))
  const remove = vi.spyOn(api, 'deleteAvatar').mockResolvedValue(undefined)
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  await renderPage(<AvatarEditor user={pictureUser} isSelf />)
  await userEvent.click(screen.getByRole('button', { name: 'Elimină fotografia' }))
  expect(remove).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Elimină fotografia' }))
  await waitFor(() => expect(queryClient.getQueryData(['me', revision])).toEqual(user()))
})
