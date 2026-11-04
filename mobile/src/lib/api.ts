import Constants from 'expo-constants'
import { sessionSignal, signOut, useSession } from '../auth/session'
import { isRole } from './user'
import type { Credentials, User } from './user'

// Port of frontend/src/lib/api.ts, limited to the endpoints this app uses.
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

function decodeLogin(value: unknown) {
  if (!record(value) || typeof value.accessToken !== 'string' || value.tokenType !== 'Bearer'
    || typeof value.expiresIn !== 'number' || !Number.isFinite(value.expiresIn) || value.expiresIn <= 0) {
    throw new ApiError(0, 'The API returned an unexpected sign-in response.')
  }
  return { user: decodeUser(value.user), accessToken: value.accessToken, expiresIn: value.expiresIn }
}

// In development the API usually runs on the computer that serves Metro, so reuse its address.
function developmentApiBase() {
  const host = Constants.expoConfig?.hostUri?.split(':')[0]
  return host ? 'http://' + host + ':3000' : ''
}

// React Native's URL class doesn't validate, so check the shape here: a scheme, a host, an optional
// path, and no credentials, query or fragment.
const apiAddress = /^https?:\/\/[^\s/?#@]+(\/[^\s?#@]*)?$/

function apiBase() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim()
  const base = configured || (__DEV__ ? developmentApiBase() : '')
  if (!base) throw new ApiError(0, 'The API address is not configured.')
  if (!apiAddress.test(base)) throw new ApiError(0, 'The API address is invalid.')
  if (!__DEV__ && !base.startsWith('https://')) throw new ApiError(0, 'The API address must use HTTPS.')
  return base.replace(/\/+$/, '')
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
  authenticated?: boolean
  /** Milliseconds before the request gives up. */
  timeout?: number
}

interface RequestContext {
  token?: string
  revision: number
  globalSignal: AbortSignal
}

function begin(authenticated: boolean): RequestContext {
  const state = useSession.getState()
  return { token: authenticated ? state.session?.accessToken : undefined, revision: state.revision, globalSignal: sessionSignal() }
}

// React Native has no global DOMException, so cancellations are plain errors named AbortError.
function cancelled(message = 'Request cancelled') {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

// Drops responses that arrive after a session change, signs out on 401, then decodes.
function settle<T>(context: RequestContext, status: number, data: unknown, decode: (value: unknown) => T): T {
  if (context.globalSignal.aborted || context.revision !== useSession.getState().revision) {
    throw cancelled('Session changed')
  }
  if (status < 200 || status > 299) {
    if (status === 401 && context.token) signOut('Your session is no longer valid. Please sign in again.')
    const message = record(data) && typeof data.error === 'string' ? data.error : 'The request failed. Please try again.'
    throw new ApiError(status, message)
  }
  return decode(data)
}

async function request<T>(path: string, decode: (value: unknown) => T, options: RequestOptions = {}): Promise<T> {
  const context = begin(options.authenticated !== false)
  const timeout = AbortSignal.timeout(options.timeout ?? 15_000)
  const signal = AbortSignal.any([context.globalSignal, timeout, ...(options.signal ? [options.signal] : [])])
  try {
    // No `cache` option: React Native's fetch polyfill appends `_=<time>` to the URL for it.
    // API responses carry Cache-Control: no-store instead.
    const response = await fetch(apiBase() + path, {
      method: options.method ?? 'GET',
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(context.token ? { Authorization: 'Bearer ' + context.token } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    })
    const data: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined)
    return settle(context, response.status, data, decode)
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (context.globalSignal.aborted || options.signal?.aborted) throw cancelled()
    if (timeout.aborted) throw new ApiError(0, 'The API took too long to respond. Please try again.')
    throw new ApiError(0, 'Could not reach the API. Check your connection and try again.')
  }
}

export const api = {
  login: (credentials: Credentials) => request('/users/login', decodeLogin, { method: 'POST', body: credentials, authenticated: false }),
  me: (signal: AbortSignal) => request('/users/me', decodeUserResponse, { signal }),
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}
