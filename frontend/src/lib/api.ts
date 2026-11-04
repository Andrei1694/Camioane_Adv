import { sessionSignal, signOut, useSession } from '../auth/session'
import { isRole } from './user'
import type { Credentials, User, UserInput } from './user'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodeUser(value: unknown): User {
  if (!record(value) || typeof value.id !== 'string' || typeof value.email !== 'string'
    || !isRole(value.role)) {
    throw new ApiError(0, 'The API returned an unexpected user response.')
  }
  return { id: value.id, email: value.email, role: value.role }
}

function decodeUserResponse(value: unknown) {
  if (!record(value)) throw new ApiError(0, 'The API returned an unexpected response.')
  return decodeUser(value.user)
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
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  authenticated?: boolean
}

async function request<T>(path: string, decode: (value: unknown) => T, options: RequestOptions = {}): Promise<T> {
  const state = useSession.getState()
  const token = options.authenticated === false ? undefined : state.session?.accessToken
  const globalSignal = sessionSignal()
  const signal = AbortSignal.any([globalSignal, AbortSignal.timeout(15_000), ...(options.signal ? [options.signal] : [])])
  try {
    const response = await fetch(apiBase() + path, {
      method: options.method ?? 'GET',
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    })
    const data: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined)
    if (globalSignal.aborted || state.revision !== useSession.getState().revision) {
      throw new DOMException('Session changed', 'AbortError')
    }
    if (!response.ok) {
      if (response.status === 401 && token) signOut('Your session is no longer valid. Please sign in again.')
      const message = record(data) && typeof data.error === 'string' ? data.error : 'The request failed. Please try again.'
      throw new ApiError(response.status, message)
    }
    return decode(data)
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (globalSignal.aborted || options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
    if (signal.aborted) throw new ApiError(0, 'The API took too long to respond. Please try again.')
    throw new ApiError(0, 'Could not reach the API. Check your connection and try again.')
  }
}

export const api = {
  login: (credentials: Credentials) => request('/users/login', (value) => {
    if (!record(value) || typeof value.accessToken !== 'string' || value.tokenType !== 'Bearer'
      || typeof value.expiresIn !== 'number' || !Number.isFinite(value.expiresIn) || value.expiresIn <= 0) {
      throw new ApiError(0, 'The API returned an unexpected sign-in response.')
    }
    return { user: decodeUser(value.user), accessToken: value.accessToken, expiresIn: value.expiresIn }
  }, { method: 'POST', body: credentials, authenticated: false }),
  me: (signal: AbortSignal) => request('/users/me', decodeUserResponse, { signal }),
  users: (signal: AbortSignal) => request('/users', (value) => {
    if (!record(value) || !Array.isArray(value.users)) throw new ApiError(0, 'The API returned an unexpected users response.')
    return value.users.map(decodeUser)
  }, { signal }),
  createUser: (data: UserInput) => request('/users', decodeUserResponse, { method: 'POST', body: data }),
  updateUser: (id: string, data: Partial<UserInput>) => request('/users/' + encodeURIComponent(id), decodeUserResponse, { method: 'PATCH', body: data }),
  deleteUser: (id: string) => request('/users/' + encodeURIComponent(id), () => undefined, { method: 'DELETE' }),
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}
