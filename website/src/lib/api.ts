// The typed fetch client for the backend, cut down from the admin app's (frontend/src/lib/api.ts).
// The website has no sign-in, so it sends no token and keeps no session. No section calls it yet;
// add calls only for endpoints that exist in backend/README.md, each with a runtime decoder.

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function apiBase() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  const base = configured || (import.meta.env.DEV ? 'http://localhost:3000' : '')
  if (!base) throw new ApiError(0, 'The API address is not configured.')
  const url = new URL(base, window.location.origin)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new ApiError(0, 'The API address is invalid.')
  }
  return url.href.replace(/\/$/, '')
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
  /** Milliseconds before the request gives up; 15 s by default. */
  timeout?: number
}

async function request<T>(path: string, decode: (value: unknown) => T, options: RequestOptions = {}): Promise<T> {
  const signal = AbortSignal.any([AbortSignal.timeout(options.timeout ?? 15_000), ...(options.signal ? [options.signal] : [])])
  try {
    const response = await fetch(apiBase() + path, {
      method: options.method ?? 'GET',
      credentials: 'omit',
      cache: 'no-store',
      headers: options.body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    })
    const data: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined)
    if (!response.ok) {
      const message = record(data) && typeof data.error === 'string' ? data.error : 'The request failed. Please try again.'
      throw new ApiError(response.status, message)
    }
    return decode(data)
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
    if (signal.aborted) throw new ApiError(0, 'The API took too long to respond. Please try again.')
    throw new ApiError(0, 'Could not reach the API. Check your connection and try again.')
  }
}

export const api = {
  /** GET /health answers without touching the database. */
  health: (signal?: AbortSignal) => request('/health', (value) => {
    if (!record(value) || value.status !== 'ok') throw new ApiError(0, 'The API returned an unexpected health response.')
    return { status: 'ok' as const }
  }, { signal }),
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}
