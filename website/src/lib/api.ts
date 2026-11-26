import { sessionSignal, signOut, useSession } from '../auth/session'
import { roles } from './user'
import type { Credentials, LoginResult, User } from './user'

// Only account routes call the API. The public landing page remains independent of the backend.

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

export function isApiConfigured() {
  try {
    apiBase()
    return true
  } catch {
    return false
  }
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function decodeAvatar(value: unknown, userId: string): User['avatar'] | undefined {
  if (value === null) return null
  if (!record(value) || value.url !== '/users/' + userId + '/avatar' || !isTimestamp(value.updatedAt)) return undefined
  return { url: '/users/' + userId + '/avatar', updatedAt: value.updatedAt }
}

function decodeUser(value: unknown): User {
  const avatar = record(value) && typeof value.id === 'string' ? decodeAvatar(value.avatar, value.id) : undefined
  if (!record(value) || typeof value.id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.id)
    || typeof value.email !== 'string' || !value.email
    || typeof value.displayName !== 'string' || value.displayName.length > 200 || value.displayName.includes('\0')
    || !(value.phone === null || (typeof value.phone === 'string' && /^\+[1-9]\d{1,14}$/.test(value.phone)))
    || !roles.some((role) => role === value.role)
    || (value.status !== 'ACTIVE' && value.status !== 'DISABLED')
    || !isTimestamp(value.createdAt) || !(value.lastLoginAt === null || isTimestamp(value.lastLoginAt))
    || avatar === undefined) {
    throw new ApiError(0, 'The API returned an unexpected account response.')
  }
  return {
    id: value.id, email: value.email, displayName: value.displayName, phone: value.phone,
    role: value.role as User['role'], status: value.status,
    avatar,
    createdAt: value.createdAt, lastLoginAt: value.lastLoginAt,
  }
}

function decodeLogin(value: unknown): LoginResult {
  if (!record(value) || typeof value.accessToken !== 'string' || !value.accessToken.trim()
    || value.tokenType !== 'Bearer' || typeof value.expiresIn !== 'number'
    || !Number.isFinite(value.expiresIn) || value.expiresIn <= 0) {
    throw new ApiError(0, 'The API returned an unexpected login response.')
  }
  return { user: decodeUser(value.user), accessToken: value.accessToken, expiresIn: value.expiresIn }
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
  /** Milliseconds before the request gives up; 15 s by default. */
  timeout?: number
  authenticated?: boolean
  sessionBound?: boolean
}

async function request<T>(path: string, decode: (value: unknown) => T, options: RequestOptions = {}): Promise<T> {
  const state = useSession.getState()
  const token = options.authenticated ? state.session?.accessToken : undefined
  const globalSignal = options.authenticated || options.sessionBound ? sessionSignal() : undefined
  if (options.authenticated && (!token || state.session!.expiresAt <= Date.now())) {
    signOut('Sesiunea ta a expirat. Autentifică-te din nou.')
    throw new ApiError(401, 'Unauthorized')
  }
  const signal = AbortSignal.any([
    AbortSignal.timeout(options.timeout ?? 15_000),
    ...(options.signal ? [options.signal] : []), ...(globalSignal ? [globalSignal] : []),
  ])
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
    if (options.signal?.aborted || (globalSignal && (globalSignal.aborted || state.revision !== useSession.getState().revision))) {
      throw new DOMException('Request cancelled', 'AbortError')
    }
    if (!response.ok) {
      if (response.status === 401 && token) signOut('Sesiunea ta nu mai este validă. Autentifică-te din nou.')
      const message = record(data) && typeof data.error === 'string' ? data.error : 'The request failed. Please try again.'
      throw new ApiError(response.status, message)
    }
    return decode(data)
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (options.signal?.aborted || globalSignal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
    if (signal.aborted) throw new ApiError(0, 'The API took too long to respond. Please try again.')
    throw new ApiError(0, 'Could not reach the API. Check your connection and try again.')
  }
}

export const api = {
  login: (credentials: Credentials, signal?: AbortSignal) => request('/users/login', decodeLogin, {
    method: 'POST', body: credentials, signal, sessionBound: true,
  }),
  me: (signal: AbortSignal) => request('/users/me', (value) => {
    if (!record(value)) throw new ApiError(0, 'The API returned an unexpected account response.')
    const user = decodeUser(value.user)
    if (user.status !== 'ACTIVE') {
      signOut('Sesiunea ta nu mai este validă. Autentifică-te din nou.')
      throw new ApiError(401, 'Unauthorized')
    }
    return user
  }, { signal, authenticated: true }),
  /** GET /health answers without touching the database. */
  health: (signal?: AbortSignal) => request('/health', (value) => {
    if (!record(value) || value.status !== 'ok') throw new ApiError(0, 'The API returned an unexpected health response.')
    return { status: 'ok' as const }
  }, { signal }),
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}
