import { expect, it, vi } from 'vitest'
import { adminAccessOptions, handleAdminError, updateAdminUsers } from '../src/auth/adminAccess'
import { replaceCachedUser } from '../src/auth/currentUser'
import { signIn, useSession } from '../src/auth/session'
import { api, ApiError } from '../src/lib/api'
import { queryClient } from '../src/lib/queryClient'
import { authenticate } from './helpers/render'
import { deferred, id, user } from './helpers/fixtures'

it('records access denial while retaining the authenticated session', async () => {
  const revision = authenticate()
  await handleAdminError(new ApiError(403, 'Forbidden'), revision)
  expect(queryClient.getQueryData(adminAccessOptions(revision).queryKey)).toEqual({ status: 'denied' })
  expect(useSession.getState().session).not.toBeNull()
  expect(await updateAdminUsers(revision, () => [user()])).toBe(false)
})

it('cancels an in-flight access check so a late success cannot restore denied access', async () => {
  const revision = authenticate()
  const pending = deferred<ReturnType<typeof user>[]>()
  vi.spyOn(api, 'users').mockReturnValue(pending.promise)
  const fetching = queryClient.fetchQuery(adminAccessOptions(revision)).catch(() => undefined)
  await handleAdminError(new ApiError(403, 'Forbidden'), revision)
  pending.resolve([user()])
  await fetching
  expect(queryClient.getQueryData(adminAccessOptions(revision).queryKey)).toEqual({ status: 'denied' })
})

it('ignores stale session mutations and non-403 errors', async () => {
  const revision = authenticate()
  await handleAdminError(new ApiError(500, 'Unavailable'), revision)
  expect(queryClient.getQueryData(adminAccessOptions(revision).queryKey)).toMatchObject({ status: 'granted' })
  signIn('replacement', 3600)
  await handleAdminError(new ApiError(403, 'Forbidden'), revision)
  expect(await updateAdminUsers(revision, () => [])).toBe(false)
  expect(queryClient.getQueryData(adminAccessOptions(revision).queryKey)).toBeUndefined()
})

it('distinguishes temporary verification failures from denial and allows revalidation', async () => {
  const revision = authenticate()
  const users = vi.spyOn(api, 'users').mockRejectedValueOnce(new ApiError(500, 'Unavailable'))
    .mockRejectedValueOnce(new ApiError(403, 'Forbidden')).mockResolvedValue([user()])
  await expect(queryClient.fetchQuery(adminAccessOptions(revision))).rejects.toMatchObject({ status: 500 })
  await expect(queryClient.fetchQuery(adminAccessOptions(revision))).resolves.toEqual({ status: 'denied' })
  await expect(queryClient.fetchQuery(adminAccessOptions(revision))).resolves.toEqual({ status: 'granted', users: [user()] })
  expect(users).toHaveBeenCalledTimes(3)
})

it('updates the current account and administrator list after avatar changes only in the current session', async () => {
  const revision = authenticate(user(), [user(), user({ id: id(9), email: 'other@example.test' })])
  const changed = user({ avatar: { url: `/users/${id(1)}/avatar`, updatedAt: '2026-11-11' } })
  await replaceCachedUser(revision, changed)
  expect(queryClient.getQueryData(['me', revision])).toEqual(changed)
  expect(queryClient.getQueryData(adminAccessOptions(revision).queryKey)).toMatchObject({ users: [changed, expect.objectContaining({ id: id(9) })] })
  signIn('replacement', 3600)
  await replaceCachedUser(revision, changed)
  expect(queryClient.getQueryData(['me', revision])).toBeUndefined()
})
