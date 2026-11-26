import { afterEach, expect, it, vi } from 'vitest'

// Import-time restoration is tested separately so React tests retain one module graph.
async function restore(saved: string | null) {
  if (saved !== null) localStorage.setItem('camioane.session.v1', saved)
  vi.resetModules()
  vi.doMock('../src/lib/queryClient', () => ({ queryClient: { cancelQueries: vi.fn(), clear: vi.fn() } }))
  return (await import('../src/auth/session')).useSession.getState()
}

afterEach(() => { vi.doUnmock('../src/lib/queryClient') })

it('restores an unexpired token without trusting stored account details', async () => {
  const expiresAt = Date.now() + 60_000
  expect((await restore(JSON.stringify({ accessToken: 'saved', expiresAt, role: 'ADMIN', password: 'ignored' }))).session)
    .toEqual({ accessToken: 'saved', expiresAt })
})

it.each(['{broken', 'null', '[]', '{}', '{"accessToken":"","expiresAt":9999999999999}', '{"accessToken":"old","expiresAt":1}'])('removes invalid saved session %s', async (saved) => {
  const state = await restore(saved)
  expect(state.session).toBeNull()
  expect(state.message).toContain('expirat')
  expect(localStorage.getItem('camioane.session.v1')).toBeNull()
})

it('starts signed out when no session exists', async () => {
  expect(await restore(null)).toMatchObject({ session: null, notice: '', message: '' })
})

it('explains blocked storage without failing application startup', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
  expect(await restore(null)).toMatchObject({ session: null, notice: expect.stringContaining('nu este disponibilă') })
})
