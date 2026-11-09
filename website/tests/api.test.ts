import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, errorMessage, record } from '../src/lib/api'

let timeoutController: AbortController

beforeEach(() => {
  timeoutController = new AbortController()
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutController.signal)
})

// Model fetch's cancellation contract while keeping every request inside the test.
function rejectOnAbort(_input: RequestInfo | URL, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal
    if (!signal) throw new Error('The request must supply an abort signal')
    if (signal.aborted) {
      reject(signal.reason)
    } else {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }
  })
}

describe('health requests', () => {
  it('decodes health and sends a GET without credentials, caching, or a body', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ status: 'ok', ignored: true }))

    await expect(api.health()).resolves.toEqual({ status: 'ok' })
    expect(fetch).toHaveBeenCalledExactlyOnceWith('https://api.example.test/health', {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      headers: {},
      body: undefined,
      signal: expect.any(AbortSignal),
    })
    expect(AbortSignal.timeout).toHaveBeenCalledWith(15_000)
  })

  it.each([null, [], {}, { status: 'down' }, { status: true }, 'ok', 1])('rejects an unexpected health payload: %j', async body => {
    vi.mocked(fetch).mockResolvedValue(Response.json(body))

    await expect(api.health()).rejects.toMatchObject({
      name: 'ApiError', status: 0, message: 'The API returned an unexpected health response.',
    })
  })

  it.each(['', '<html>Unavailable</html>', '{broken'])('rejects an unreadable success response: %j', async body => {
    vi.mocked(fetch).mockResolvedValue(new Response(body))

    await expect(api.health()).rejects.toMatchObject({
      name: 'ApiError', status: 0, message: 'The API returned an unexpected health response.',
    })
  })

  it('rejects a 204 health response without attempting to parse JSON', async () => {
    const response = new Response(null, { status: 204 })
    const json = vi.spyOn(response, 'json')
    vi.mocked(fetch).mockResolvedValue(response)

    await expect(api.health()).rejects.toMatchObject({ status: 0, message: 'The API returned an unexpected health response.' })
    expect(json).not.toHaveBeenCalled()
  })

  it('preserves the status and error message from the server', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ error: 'Temporarily unavailable' }, { status: 503 }))

    await expect(api.health()).rejects.toMatchObject({
      name: 'ApiError', status: 503, message: 'Temporarily unavailable',
    })
  })

  it.each([{}, { error: 42 }, null, [], 'Unavailable'])('uses the fallback server error for %j', async body => {
    vi.mocked(fetch).mockResolvedValue(Response.json(body, { status: 500 }))

    await expect(api.health()).rejects.toMatchObject({
      name: 'ApiError', status: 500, message: 'The request failed. Please try again.',
    })
  })

  it('uses the fallback server error when the response is not JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Bad gateway', { status: 502 }))

    await expect(api.health()).rejects.toMatchObject({
      status: 502, message: 'The request failed. Please try again.',
    })
  })

  it('turns a network failure into a useful connection error', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(api.health()).rejects.toMatchObject({
      name: 'ApiError', status: 0, message: 'Could not reach the API. Check your connection and try again.',
    })
  })

  it('cancels an in-flight request when the caller aborts', async () => {
    vi.mocked(fetch).mockImplementation(rejectOnAbort)
    const controller = new AbortController()
    const result = api.health(controller.signal)
    const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError', message: 'Request cancelled' })

    controller.abort()

    await assertion
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true)
    expect(timeoutController.signal.aborted).toBe(false)
  })

  it('handles a signal that was already cancelled', async () => {
    vi.mocked(fetch).mockImplementation(rejectOnAbort)
    const controller = new AbortController()
    controller.abort()

    await expect(api.health(controller.signal)).rejects.toBeInstanceOf(DOMException)
  })

  it('reports timeout separately from caller cancellation without a real wait', async () => {
    vi.mocked(fetch).mockImplementation(rejectOnAbort)
    const controller = new AbortController()
    const result = api.health(controller.signal)
    const assertion = expect(result).rejects.toMatchObject({
      name: 'ApiError', status: 0, message: 'The API took too long to respond. Please try again.',
    })

    timeoutController.abort(new DOMException('Timed out', 'TimeoutError'))

    await assertion
    expect(controller.signal.aborted).toBe(false)
  })
})

describe('API address configuration', () => {
  it.each([
    ['https://api.example.test', 'https://api.example.test/health'],
    ['  https://api.example.test/v1/  ', 'https://api.example.test/v1/health'],
    ['http://api.example.test:3000/', 'http://api.example.test:3000/health'],
    ['/api/', 'https://website.example.test/api/health'],
  ])('resolves %j to %s', async (base, expected) => {
    vi.stubEnv('VITE_API_BASE_URL', base)
    vi.mocked(fetch).mockResolvedValue(Response.json({ status: 'ok' }))

    await api.health()

    expect(fetch).toHaveBeenCalledWith(expected, expect.any(Object))
  })

  it.each([undefined, '', '  '])('uses localhost in development when the address is %j', async base => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_API_BASE_URL', base)
    vi.mocked(fetch).mockResolvedValue(Response.json({ status: 'ok' }))

    await api.health()

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/health', expect.any(Object))
  })

  it.each([undefined, '', '  '])('fails before fetching in production when the address is %j', async base => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_API_BASE_URL', base)

    await expect(api.health()).rejects.toMatchObject({
      name: 'ApiError', status: 0, message: 'The API address is not configured.',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    'ftp://api.example.test',
    'javascript:void(0)',
    'https://user@api.example.test',
    'https://:password@api.example.test',
    'https://api.example.test?token=value',
    'https://api.example.test#fragment',
  ])('rejects the unsupported address %s before fetching', async base => {
    vi.stubEnv('VITE_API_BASE_URL', base)

    await expect(api.health()).rejects.toMatchObject({ name: 'ApiError', status: 0, message: 'The API address is invalid.' })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('API helpers', () => {
  it.each([
    [{}, true],
    [{ status: 'ok' }, true],
    [null, false],
    [undefined, false],
    [[], false],
    ['value', false],
    [42, false],
    [false, false],
  ])('recognizes object payloads: %j', (value, expected) => {
    expect(record(value)).toBe(expected)
  })

  it('exposes the status and public message of an API error', () => {
    const error = new ApiError(503, 'Please try later')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ApiError')
    expect(error.status).toBe(503)
    expect(errorMessage(error)).toBe('Please try later')
  })

  it.each([new Error('Internal detail'), 'Internal detail', null, undefined])('does not expose details of unknown errors: %j', error => {
    expect(errorMessage(error)).toBe('Something went wrong. Please try again.')
  })
})
