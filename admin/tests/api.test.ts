import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, errorMessage, isRetryableUpload } from '../src/lib/api'
import type { CarInput } from '../src/lib/car'
import { signIn, signOut, useSession } from '../src/auth/session'
import { car, campaign, deferred, file, id, purchase, route, transaction, user } from './helpers/fixtures'
import { jsonResponse, respond, TestXHR } from './helpers/network'

const signal = () => new AbortController().signal
const newUser = { email: 'new@example.test', role: 'USER' as const, password: 'long password' }
const carInput: CarInput = { plate: 'B 01 TEST', makeModel: 'Test van', driverName: 'Test Driver', routeId: 'centru', status: 'active' }
const campaignInput = { name: 'Test campaign', days: campaign().days }
const routeInput = { name: 'Test route', waypoints: route().waypoints }
const adjustment = { userId: id(1), amount: -10, note: 'Correction' }
beforeEach(() => signIn('test-token', 3600))

describe('JSON API contracts', () => {
  const cases: { name: string, run: () => Promise<unknown>, path: string, response: unknown, expected: unknown }[] = [
    { name: 'current user', run: () => api.me(signal()), path: '/users/me', response: { user: user() }, expected: user() },
    { name: 'users', run: () => api.users(signal()), path: '/users', response: { users: [user()] }, expected: [user()] },
    { name: 'cars', run: () => api.cars(signal()), path: '/cars', response: { cars: [car()] }, expected: [car()] },
    { name: 'car', run: () => api.car(id(2), signal()), path: `/cars/${id(2)}`, response: { car: car() }, expected: car() },
    { name: 'campaign', run: () => api.campaign(id(4), signal()), path: `/campaigns/${id(4)}`, response: { campaign: campaign() }, expected: campaign() },
    { name: 'campaigns', run: () => api.campaigns({ limit: 50, offset: 0 }, signal()), path: '/campaigns?limit=50&offset=0', response: { campaigns: [campaign()], total: 1 }, expected: { campaigns: [campaign()], total: 1 } },
    { name: 'route', run: () => api.route(id(5), signal()), path: `/routes/${id(5)}`, response: { route: route() }, expected: route() },
    { name: 'routes', run: () => api.routes({ limit: 50, offset: 0 }, signal()), path: '/routes?limit=50&offset=0', response: { routes: [route()], total: 1 }, expected: { routes: [route()], total: 1 } },
    { name: 'files', run: () => api.files({ limit: 50, offset: 0 }, signal()), path: '/files?limit=50&offset=0', response: { files: [file()], total: 1 }, expected: { files: [file()], total: 1 } },
    { name: 'balance', run: () => api.creditBalance(undefined, signal()), path: '/credits/balance', response: { balance: 100, currency: 'RON', unitPriceMinor: 100 }, expected: { balance: 100, currency: 'RON', unitPriceMinor: 100 } },
    { name: 'purchases', run: () => api.creditPurchases({ limit: 50, offset: 0, status: 'PENDING' }, signal()), path: '/credits/purchases?limit=50&offset=0&status=PENDING', response: { purchases: [purchase()], total: 1 }, expected: { purchases: [purchase()], total: 1 } },
    { name: 'transactions', run: () => api.creditTransactions({ limit: 50, offset: 0 }, signal()), path: '/credits/transactions?limit=50&offset=0', response: { transactions: [transaction()], total: 1 }, expected: { transactions: [transaction()], total: 1 } },
  ]
  it.each(cases)('decodes $name and sends authorization', async ({ run, path, response, expected }) => {
    const fetcher = respond(response)
    await expect(run()).resolves.toEqual(expected)
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test' + path, expect.objectContaining({
      method: 'GET', credentials: 'omit', cache: 'no-store', headers: { Authorization: 'Bearer test-token' },
    }))
  })
  it.each(cases)('rejects a malformed $name envelope', async ({ run }) => {
    respond({ unexpected: true })
    await expect(run()).rejects.toBeInstanceOf(ApiError)
  })
  it.each([
    ['user', () => api.me(signal()), { user: { ...user(), role: 'INVALID' } }],
    ['avatar URL', () => api.me(signal()), { user: user({ avatar: { url: 'https://evil.test/image', updatedAt: '2026-11-10' } }) }],
    ['another user avatar', () => api.me(signal()), { user: user({ avatar: { url: `/users/${id(9)}/avatar`, updatedAt: '2026-11-10' } }) }],
    ['file URL', () => api.files({ limit: 1, offset: 0 }, signal()), { files: [file({ downloadUrl: 'https://evil.test/file' })], total: 1 }],
    ['purchase total', () => api.creditPurchases({ limit: 1, offset: 0 }, signal()), { purchases: [purchase({ amountMinor: 1 })], total: 1 }],
    ['transaction', () => api.creditTransactions({ limit: 1, offset: 0 }, signal()), { transactions: [transaction({ amount: 0 })], total: 1 }],
    ['balance', () => api.creditBalance(undefined, signal()), { balance: -1, currency: 'RON', unitPriceMinor: 100 }],
    ['campaign', () => api.campaign(id(4), signal()), { campaign: campaign({ days: [] }) }],
    ['car version', () => api.car(id(2), signal()), { car: car({ version: 0 }) }],
    ['route stops', () => api.route(id(5), signal()), { route: route({ waypoints: [] }) }],
  ] as const)('rejects invalid resource fields: %s', async (_name, run, body) => {
    respond(body)
    await expect(run()).rejects.toBeInstanceOf(ApiError)
  })
  it('allows only the matching avatar path and omits unrecognized server fields', async () => {
    const expected = user({ avatar: { url: `/users/${id(1)}/avatar`, updatedAt: '2026-11-10' } })
    respond({ user: { ...expected, passwordHash: 'private' } })
    await expect(api.me(signal())).resolves.toEqual(expected)
  })
  it('logs in without an existing bearer token and validates token metadata', async () => {
    const credentials = { email: 'a@example.test', password: ' twelve chars ' }
    const fetcher = respond({ user: user(), accessToken: 'new-token', tokenType: 'Bearer', expiresIn: 3600 })
    await expect(api.login(credentials)).resolves.toMatchObject({ accessToken: 'new-token', expiresIn: 3600 })
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify(credentials), headers: { 'Content-Type': 'application/json' } })
    expect(fetcher.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization')
    respond({ user: user(), accessToken: 'token', tokenType: 'Basic', expiresIn: -1 })
    await expect(api.login(credentials)).rejects.toBeInstanceOf(ApiError)
  })
  it.each([
    ['create user', () => api.createUser(newUser), '/users', 'POST', { user: user() }, newUser],
    ['update user', () => api.updateUser('a/b', { email: 'new@example.test' }), '/users/a%2Fb', 'PATCH', { user: user() }, { email: 'new@example.test' }],
    ['create car', () => api.createCar(carInput), '/cars', 'POST', { car: car() }, carInput],
    ['update car', () => api.updateCar(id(2), { ...carInput, version: 1 }), `/cars/${id(2)}`, 'PATCH', { car: car() }, { ...carInput, version: 1 }],
    ['create campaign', () => api.createCampaign(campaignInput), '/campaigns', 'POST', { campaign: campaign() }, campaignInput],
    ['update campaign', () => api.updateCampaign(id(4), { ...campaignInput, version: 1 }), `/campaigns/${id(4)}`, 'PATCH', { campaign: campaign() }, { ...campaignInput, version: 1 }],
    ['create route', () => api.createRoute(routeInput), '/routes', 'POST', { route: route() }, routeInput],
    ['update route', () => api.updateRoute(id(5), { ...routeInput, version: 1 }), `/routes/${id(5)}`, 'PATCH', { route: route() }, { ...routeInput, version: 1 }],
    ['adjust credits', () => api.adjustCredits(adjustment), '/credits/adjustments', 'POST', { transaction: transaction() }, adjustment],
  ] as const)('sends the %s mutation contract', async (_name, run, path, method, response, body) => {
    const fetcher = respond(response)
    await run()
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.example.test' + path)
    expect(options).toMatchObject({ method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' } })
    expect(JSON.parse(String(options?.body))).toEqual(body)
  })
  it.each([
    [() => api.deleteUser('a/b'), '/users/a%2Fb'], [() => api.deleteAvatar(id(1)), `/users/${id(1)}/avatar`],
    [() => api.deleteFile(id(3)), `/files/${id(3)}`], [() => api.deleteCar(id(2)), `/cars/${id(2)}`],
    [() => api.deleteRoute(id(5)), `/routes/${id(5)}`],
  ] as const)('handles a successful empty delete response', async (run, path) => {
    const fetcher = respond(undefined, 204)
    await expect(run()).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test' + path, expect.objectContaining({ method: 'DELETE', body: undefined }))
  })
  it('settles purchases with an optional reference and no invented body', async () => {
    const fetcher = respond({ purchase: purchase({ status: 'PAID' }), transaction: transaction() })
    await api.confirmPurchase(id(6))
    expect(fetcher.mock.calls[0][1]?.body).toBeUndefined()
    await api.confirmPurchase(id(6), 'bank-123')
    expect(fetcher.mock.calls[1][1]?.body).toBe('{"reference":"bank-123"}')
    for (const [run, action] of [[api.failPurchase, 'fail'], [api.cancelPurchase, 'cancel']] as const) {
      const call = respond({ purchase: purchase() })
      await run(id(6))
      expect(call.mock.calls[0][0]).toBe(`https://api.example.test/credits/purchases/${id(6)}/${action}`)
    }
  })
})

describe('transport and session boundaries', () => {
  it('resolves proxy paths and rejects unsafe configuration before fetch', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '/api/')
    const fetcher = respond({ user: user() })
    await api.me(signal())
    expect(fetcher.mock.calls[0][0]).toBe('https://dashboard.example.test/api/users/me')
    for (const base of ['file:///private', 'https://name:password@example.test', 'https://api.test?secret=1', 'https://api.test#fragment']) {
      vi.stubEnv('VITE_API_BASE_URL', base)
      await expect(api.me(signal())).rejects.toBeInstanceOf(ApiError)
    }
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('signs out on an authenticated 401 but retains the session after 403', async () => {
    respond({ error: 'Forbidden' }, 403)
    await expect(api.me(signal())).rejects.toMatchObject({ status: 403 })
    expect(useSession.getState().session).not.toBeNull()
    respond({}, 401)
    await expect(api.me(signal())).rejects.toMatchObject({ status: 401 })
    expect(useSession.getState().session).toBeNull()
  })
  it('does not sign out the current account for a failed unauthenticated login', async () => {
    respond({}, 401)
    await expect(api.login({ email: 'a@example.test', password: 'bad' })).rejects.toMatchObject({ status: 401 })
    expect(useSession.getState().session?.accessToken).toBe('test-token')
  })
  it('discards late responses from an earlier session, including 401s', async () => {
    const pending = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(pending.promise))
    const request = api.me(signal())
    const assertion = expect(request).rejects.toMatchObject({ name: 'AbortError' })
    signIn('replacement', 3600)
    pending.resolve(jsonResponse({}, 401))
    await assertion
    expect(useSession.getState().session?.accessToken).toBe('replacement')
  })
  it('distinguishes cancellation, timeout and network errors', async () => {
    const caller = new AbortController()
    const pending = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(pending.promise))
    const canceled = api.me(caller.signal)
    const cancelAssertion = expect(canceled).rejects.toMatchObject({ name: 'AbortError' })
    caller.abort()
    pending.reject(new TypeError('network'))
    await cancelAssertion
    const timeout = new AbortController()
    timeout.abort(new DOMException('Timeout', 'TimeoutError'))
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network')))
    await expect(api.me(signal())).rejects.toThrow('nu a răspuns la timp')
    vi.mocked(AbortSignal.timeout).mockRestore()
    await expect(api.me(signal())).rejects.toThrow('Conectarea la server a eșuat')
  })
  it('handles malformed JSON and does not expose arbitrary internal errors', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('not-json')))
    await expect(api.me(signal())).rejects.toBeInstanceOf(ApiError)
    expect(errorMessage(new Error('secret'))).not.toContain('secret')
    respond({ error: 'private database details' }, 500)
    await expect(api.me(signal())).rejects.not.toThrow('private database details')
  })
  it('downloads binary content with authentication', async () => {
    const blob = new Blob(['image'], { type: 'image/png' })
    const response = new Response()
    vi.spyOn(response, 'blob').mockResolvedValue(blob)
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetcher)
    await expect(api.downloadFile(file())).resolves.toBe(blob)
    await expect(api.avatarImage({ url: `/users/${id(1)}/avatar`, updatedAt: '2026-11-10' }, signal())).resolves.toBe(blob)
  })
})

describe('XHR uploads', () => {
  beforeEach(() => TestXHR.install())
  it('sends multipart POST with proportional progress and a sent notification', async () => {
    const input = new File(['12345'], 'creative.png', { type: 'image/png' })
    const onProgress = vi.fn(), onSent = vi.fn()
    const result = api.uploadFile(input, { onProgress, onSent })
    const xhr = TestXHR.last()
    expect(xhr.method).toBe('POST')
    expect(xhr.url).toBe('https://api.example.test/files')
    expect(xhr.headers).toEqual({ Authorization: 'Bearer test-token' })
    expect(xhr.body?.get('file')).toMatchObject({ name: input.name, size: input.size, type: input.type })
    xhr.progress(10, 20)
    xhr.progress(40, 20)
    xhr.progress(1, 0)
    expect(onProgress.mock.calls).toEqual([[3], [5]])
    xhr.upload.onload?.()
    expect(onSent).toHaveBeenCalledOnce()
    xhr.complete({ file: file() })
    await expect(result).resolves.toEqual(file())
  })
  it('uploads avatars with PUT and decodes the returned account', async () => {
    const result = api.uploadAvatar(id(1), new File(['x'], 'avatar.png'))
    expect(TestXHR.last().method).toBe('PUT')
    expect(TestXHR.last().url).toBe(`https://api.example.test/users/${id(1)}/avatar`)
    TestXHR.last().complete({ user: user() })
    await expect(result).resolves.toEqual(user())
  })
  it.each(['caller', 'session', 'already-aborted'] as const)('cancels on %s', async (kind) => {
    const controller = new AbortController()
    if (kind === 'already-aborted') controller.abort()
    const result = api.uploadFile(new File(['x'], 'test'), { signal: controller.signal })
    const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' })
    if (kind === 'caller') controller.abort()
    if (kind === 'session') signOut()
    await assertion
    if (kind === 'already-aborted') expect(TestXHR.instances).toHaveLength(0)
  })
  it.each(['error', 'timeout', 'invalid', '401'] as const)('handles upload %s', async (kind) => {
    const result = api.uploadFile(new File(['x'], 'test'))
    const assertion = expect(result).rejects.toBeInstanceOf(ApiError)
    if (kind === 'error') TestXHR.last().onerror?.()
    if (kind === 'timeout') TestXHR.last().ontimeout?.()
    if (kind === 'invalid') TestXHR.last().complete({ file: {} })
    if (kind === '401') TestXHR.last().complete({}, 401)
    await assertion
    if (kind === '401') expect(useSession.getState().session).toBeNull()
  })
  it.each([0, 400, 401, 403, 409, 413, 422, 500])('retries only recoverable upload status %i', (status) => {
    expect(isRetryableUpload(new ApiError(status, 'test'))).toBe(status === 0 || status === 409 || status >= 500)
  })
})
