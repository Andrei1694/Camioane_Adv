import { expect, it, onTestFinished, vi } from 'vitest'
import { sessionSignal, signIn, signOut, startSessionSync, useSession } from '../src/auth/session'
import { queryClient } from '../src/lib/queryClient'
import { notifyForSession, useNotifications } from '../src/lib/notifications'

it('persists only token and expiry and clears private state at each session boundary', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-10T10:00:00Z'))
  localStorage.setItem('camioane.users-demo.v1', 'untouched legacy data')
  const oldSignal = sessionSignal()
  queryClient.setQueryData(['private'], { secret: true })
  notifyForSession({ variant: 'success', message: 'Old account' }, 0)
  signIn('test-token', 60)
  expect(oldSignal.aborted).toBe(true)
  expect(sessionSignal().aborted).toBe(false)
  expect(queryClient.getQueryData(['private'])).toBeUndefined()
  expect(useNotifications.getState().notifications).toEqual([])
  expect(JSON.parse(localStorage.getItem('camioane.session.v1')!)).toEqual({ accessToken: 'test-token', expiresAt: Date.now() + 60_000 })
  expect(localStorage.getItem('camioane.users-demo.v1')).toBe('untouched legacy data')
  signOut('Signed out')
  expect(localStorage.getItem('camioane.session.v1')).toBeNull()
  expect(useSession.getState()).toMatchObject({ session: null, message: 'Signed out', revision: 2 })
})

it('uses the earlier JWT expiry as a scheduling hint', () => {
  vi.useFakeTimers()
  vi.setSystemTime(1_800_000_000_000)
  const token = `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 10 }))}.signature`
  signIn(token, 3600)
  expect(useSession.getState().session?.expiresAt).toBe(Date.now() + 10_000)
})

it('keeps in-memory sign-in usable when storage writes fail', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
  signIn('test-token', 60)
  expect(useSession.getState().session?.accessToken).toBe('test-token')
  expect(useSession.getState().notice).toContain('nu este disponibilă')
})

it('expires sessions and removes timers/listeners on cleanup', () => {
  vi.useFakeTimers()
  signIn('test-token', 1)
  const stop = startSessionSync()
  onTestFinished(stop)
  vi.advanceTimersByTime(1000)
  expect(useSession.getState().session).toBeNull()
  expect(useSession.getState().message).toContain('expirat')
  stop()
  signIn('after-cleanup', 1)
  vi.advanceTimersByTime(2000)
  expect(useSession.getState().session?.accessToken).toBe('after-cleanup')
})

it('rechecks expiry when a suspended tab becomes visible', () => {
  vi.useFakeTimers()
  signIn('test-token', 1)
  const stop = startSessionSync()
  onTestFinished(stop)
  vi.setSystemTime(Date.now() + 2000)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  document.dispatchEvent(new Event('visibilitychange'))
  expect(useSession.getState().session).toBeNull()
  stop()
})

it('synchronizes account replacement and cross-tab logout without echoing storage writes', () => {
  signIn('test-token', 3600)
  const stop = startSessionSync()
  onTestFinished(stop)
  const write = vi.spyOn(Storage.prototype, 'setItem')
  const replacement = JSON.stringify({ accessToken: 'another-token', expiresAt: Date.now() + 50_000 })
  window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated', newValue: replacement }))
  expect(useSession.getState().session?.accessToken).toBe('test-token')
  window.dispatchEvent(new StorageEvent('storage', { key: 'camioane.session.v1', newValue: replacement }))
  expect(useSession.getState().session?.accessToken).toBe('another-token')
  const revision = useSession.getState().revision
  window.dispatchEvent(new StorageEvent('storage', { key: 'camioane.session.v1', newValue: replacement }))
  expect(useSession.getState().revision).toBe(revision)
  expect(write).not.toHaveBeenCalled()
  window.dispatchEvent(new StorageEvent('storage', { key: null, newValue: null }))
  expect(useSession.getState().session).toBeNull()
  stop()
})
