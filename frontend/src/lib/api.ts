import { sessionSignal, signOut, useSession } from '../auth/session'
import { isRole } from './user'
import type { Credentials, User, UserInput } from './user'
import type { FilePage, StoredFile } from './file'
import { isPurchaseStatus, isTransactionType } from './credit'
import type { Adjustment, CreditBalance, CreditPurchase, CreditTransaction, PurchasePage, PurchaseStatus, TransactionPage } from './credit'

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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}

function isWhole(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isCurrency(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value)
}

/** A query string from the defined values only, with its leading "?". */
function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const text = params.toString()
  return text ? '?' + text : ''
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
  /** Milliseconds before the request gives up. JSON calls keep the 15 s default. */
  timeout?: number
  /** Read a successful body as a Blob. Error bodies are still read as JSON. */
  binary?: boolean
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

// Shared by fetch and XHR: drops responses after a session change, signs out on 401, then decodes.
function settle<T>(context: RequestContext, status: number, data: unknown, decode: (value: unknown) => T): T {
  if (context.globalSignal.aborted || context.revision !== useSession.getState().revision) {
    throw new DOMException('Session changed', 'AbortError')
  }
  if (status < 200 || status > 299) {
    if (status === 401 && context.token) signOut('Your session is no longer valid. Please sign in again.')
    const message = record(data) && typeof data.error === 'string' ? data.error : 'The request failed. Please try again.'
    throw new ApiError(status, message)
  }
  return decode(data)
}

const cancelled = () => new DOMException('Request cancelled', 'AbortError')
const unreachable = () => new ApiError(0, 'Could not reach the API. Check your connection and try again.')

async function request<T>(path: string, decode: (value: unknown) => T, options: RequestOptions = {}): Promise<T> {
  const context = begin(options.authenticated !== false)
  const signal = AbortSignal.any([
    context.globalSignal, AbortSignal.timeout(options.timeout ?? 15_000), ...(options.signal ? [options.signal] : []),
  ])
  try {
    const response = await fetch(apiBase() + path, {
      method: options.method ?? 'GET',
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(context.token ? { Authorization: 'Bearer ' + context.token } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    })
    const data: unknown = response.status === 204 ? undefined
      : response.ok && options.binary ? await response.blob()
      : await response.json().catch(() => undefined)
    return settle(context, response.status, data, decode)
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (context.globalSignal.aborted || options.signal?.aborted) throw cancelled()
    if (signal.aborted) throw new ApiError(0, 'The API took too long to respond. Please try again.')
    throw unreachable()
  }
}

export interface UploadOptions {
  signal?: AbortSignal
  /** Bytes of the file sent so far, scaled from the multipart body to the file's own size. */
  onProgress?: (sent: number) => void
  /** Every byte has been sent; the API is now checking and storing the file. */
  onSent?: () => void
}

// fetch cannot report upload progress, so uploads use XMLHttpRequest with the same session rules.
function upload<T>(path: string, file: File, decode: (value: unknown) => T, options: UploadOptions = {}): Promise<T> {
  const context = begin(true)
  return new Promise<T>((resolve, reject) => {
    if (context.globalSignal.aborted || options.signal?.aborted) {
      reject(cancelled())
      return
    }
    let url: string
    try {
      url = apiBase() + path
    } catch (error) {
      reject(error)
      return
    }
    const xhr = new XMLHttpRequest()
    const signals = [context.globalSignal, ...(options.signal ? [options.signal] : [])]
    const abort = () => xhr.abort()
    signals.forEach((signal) => signal.addEventListener('abort', abort))
    function done(outcome: () => T) {
      signals.forEach((signal) => signal.removeEventListener('abort', abort))
      try {
        resolve(outcome())
      } catch (error) {
        reject(error)
      }
    }
    xhr.open('POST', url)
    xhr.responseType = 'json'
    xhr.timeout = 30 * 60_000
    if (context.token) xhr.setRequestHeader('Authorization', 'Bearer ' + context.token)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        options.onProgress?.(Math.min(file.size, Math.round((event.loaded / event.total) * file.size)))
      }
    }
    xhr.upload.onload = () => options.onSent?.()
    xhr.onload = () => done(() => {
      const data: unknown = xhr.status === 204 ? undefined : xhr.response ?? undefined
      return settle(context, xhr.status, data, decode)
    })
    xhr.onabort = () => done(() => { throw cancelled() })
    xhr.ontimeout = () => done(() => { throw new ApiError(0, 'The upload took too long. Please try again.') })
    xhr.onerror = () => done(() => { throw unreachable() })
    // The browser sets the multipart Content-Type and boundary itself.
    const body = new FormData()
    body.append('file', file, file.name)
    xhr.send(body)
  })
}

function decodeFile(value: unknown): StoredFile {
  if (!record(value) || !isUuid(value.id)
    || (value.ownerId !== null && typeof value.ownerId !== 'string')
    || typeof value.originalName !== 'string' || typeof value.mimeType !== 'string'
    || typeof value.size !== 'number' || !Number.isSafeInteger(value.size) || value.size < 0
    || typeof value.createdAt !== 'string' || Number.isNaN(Date.parse(value.createdAt))
    // The token goes wherever this path points, so accept only the file's own download route.
    || value.downloadUrl !== '/files/' + value.id + '/download') {
    throw new ApiError(0, 'The API returned an unexpected file response.')
  }
  return {
    id: value.id,
    ownerId: value.ownerId,
    originalName: value.originalName,
    mimeType: value.mimeType,
    size: value.size,
    createdAt: value.createdAt,
    downloadUrl: '/files/' + value.id + '/download',
  }
}

function decodeFileResponse(value: unknown) {
  if (!record(value)) throw new ApiError(0, 'The API returned an unexpected response.')
  return decodeFile(value.file)
}

function decodeFilePage(value: unknown): FilePage {
  if (!record(value) || !Array.isArray(value.files)
    || typeof value.total !== 'number' || !Number.isSafeInteger(value.total) || value.total < 0) {
    throw new ApiError(0, 'The API returned an unexpected files response.')
  }
  return { files: value.files.map(decodeFile), total: value.total }
}

function decodePurchase(value: unknown): CreditPurchase {
  if (!record(value) || !isUuid(value.id) || (value.userId !== null && !isUuid(value.userId))
    || !isWhole(value.credits) || value.credits < 1
    || !isWhole(value.unitPriceMinor) || value.unitPriceMinor < 1
    || !isWhole(value.amountMinor) || value.amountMinor !== value.credits * value.unitPriceMinor
    || !isCurrency(value.currency) || !isPurchaseStatus(value.status)
    || (value.reference !== null && typeof value.reference !== 'string')
    || !isTimestamp(value.createdAt) || (value.settledAt !== null && !isTimestamp(value.settledAt))) {
    throw new ApiError(0, 'The API returned an unexpected purchase response.')
  }
  return {
    id: value.id,
    userId: value.userId,
    credits: value.credits,
    unitPriceMinor: value.unitPriceMinor,
    amountMinor: value.amountMinor,
    currency: value.currency,
    status: value.status,
    reference: value.reference,
    createdAt: value.createdAt,
    settledAt: value.settledAt,
  }
}

function decodeTransaction(value: unknown): CreditTransaction {
  if (!record(value) || !isUuid(value.id) || (value.userId !== null && !isUuid(value.userId))
    || !isWhole(value.amount) || value.amount === 0 || !isWhole(value.balanceAfter) || value.balanceAfter < 0
    || !isTransactionType(value.type) || (value.purchaseId !== null && !isUuid(value.purchaseId))
    || (value.note !== null && typeof value.note !== 'string') || !isTimestamp(value.createdAt)) {
    throw new ApiError(0, 'The API returned an unexpected ledger response.')
  }
  return {
    id: value.id,
    userId: value.userId,
    amount: value.amount,
    balanceAfter: value.balanceAfter,
    type: value.type,
    purchaseId: value.purchaseId,
    note: value.note,
    createdAt: value.createdAt,
  }
}

function decodeBalance(value: unknown): CreditBalance {
  if (!record(value) || !isWhole(value.balance) || value.balance < 0 || !isCurrency(value.currency)
    || !isWhole(value.unitPriceMinor) || value.unitPriceMinor < 1) {
    throw new ApiError(0, 'The API returned an unexpected balance response.')
  }
  return { balance: value.balance, currency: value.currency, unitPriceMinor: value.unitPriceMinor }
}

function decodeTotal(value: Record<string, unknown>) {
  if (!isWhole(value.total) || value.total < 0) throw new ApiError(0, 'The API returned an unexpected list response.')
  return value.total
}

function decodePurchasePage(value: unknown): PurchasePage {
  if (!record(value) || !Array.isArray(value.purchases)) throw new ApiError(0, 'The API returned an unexpected purchases response.')
  return { purchases: value.purchases.map(decodePurchase), total: decodeTotal(value) }
}

function decodeTransactionPage(value: unknown): TransactionPage {
  if (!record(value) || !Array.isArray(value.transactions)) throw new ApiError(0, 'The API returned an unexpected ledger response.')
  return { transactions: value.transactions.map(decodeTransaction), total: decodeTotal(value) }
}

function decodePurchaseResponse(value: unknown) {
  if (!record(value)) throw new ApiError(0, 'The API returned an unexpected response.')
  return decodePurchase(value.purchase)
}

function decodeTransactionResponse(value: unknown) {
  if (!record(value)) throw new ApiError(0, 'The API returned an unexpected response.')
  return decodeTransaction(value.transaction)
}

function decodeConfirmation(value: unknown) {
  if (!record(value)) throw new ApiError(0, 'The API returned an unexpected response.')
  return { purchase: decodePurchase(value.purchase), transaction: decodeTransaction(value.transaction) }
}

function decodeBlob(value: unknown) {
  if (!(value instanceof Blob)) throw new ApiError(0, 'The API returned an unexpected download.')
  return value
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
  files: (page: { limit: number, offset: number }, signal: AbortSignal) => request(
    '/files?' + new URLSearchParams({ limit: String(page.limit), offset: String(page.offset) }), decodeFilePage, { signal },
  ),
  uploadFile: (file: File, options?: UploadOptions) => upload('/files', file, decodeFileResponse, options),
  // Downloads read the whole file into memory, so they get far longer than the JSON timeout.
  downloadFile: (file: StoredFile, signal?: AbortSignal) => request(file.downloadUrl, decodeBlob, { signal, binary: true, timeout: 10 * 60_000 }),
  deleteFile: (id: string) => request('/files/' + encodeURIComponent(id), () => undefined, { method: 'DELETE' }),
  /** One account's balance; without a user ID, the signed-in account's. */
  creditBalance: (userId: string | undefined, signal: AbortSignal) => request('/credits/balance' + query({ userId }), decodeBalance, { signal }),
  creditPurchases: (page: { limit: number, offset: number, status?: PurchaseStatus, userId?: string }, signal: AbortSignal) => request(
    '/credits/purchases' + query(page), decodePurchasePage, { signal },
  ),
  creditTransactions: (page: { limit: number, offset: number, userId?: string }, signal: AbortSignal) => request(
    '/credits/transactions' + query(page), decodeTransactionPage, { signal },
  ),
  // Without a reference the body stays empty, which the API reads as no reference.
  confirmPurchase: (id: string, reference?: string) => request('/credits/purchases/' + encodeURIComponent(id) + '/confirm', decodeConfirmation, {
    method: 'POST', body: reference === undefined ? undefined : { reference },
  }),
  failPurchase: (id: string) => request('/credits/purchases/' + encodeURIComponent(id) + '/fail', decodePurchaseResponse, { method: 'POST' }),
  cancelPurchase: (id: string) => request('/credits/purchases/' + encodeURIComponent(id) + '/cancel', decodePurchaseResponse, { method: 'POST' }),
  adjustCredits: (data: Adjustment) => request('/credits/adjustments', decodeTransactionResponse, { method: 'POST', body: data }),
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}
