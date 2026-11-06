import { create } from 'zustand'
import { queryClient } from '../lib/queryClient'
import { resetNotifications } from '../lib/notifications'

interface Session {
  accessToken: string
  expiresAt: number
}

interface SessionState {
  session: Session | null
  revision: number
  notice: string
  message: string
}

const storageKey = 'camioane.session.v1'
const storageNotice = 'Stocarea în browser nu este disponibilă. Este posibil să fie nevoie să te autentifici din nou după reîncărcare.'

function parseSession(saved: string | null): Session | null {
  if (!saved) return null
  try {
    const value: unknown = JSON.parse(saved)
    if (typeof value === 'object' && value !== null
      && 'accessToken' in value && typeof value.accessToken === 'string' && value.accessToken
      && 'expiresAt' in value && typeof value.expiresAt === 'number'
      && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now()) {
      return { accessToken: value.accessToken, expiresAt: value.expiresAt }
    }
  } catch {
    // Malformed or outdated browser sessions never authenticate a user.
  }
  return null
}

function initialState(): SessionState {
  try {
    const saved = localStorage.getItem(storageKey)
    const session = parseSession(saved)
    if (saved && !session) localStorage.removeItem(storageKey)
    return { session, revision: 0, notice: '', message: saved && !session ? 'Sesiunea ta a expirat. Autentifică-te din nou.' : '' }
  } catch {
    return { session: null, revision: 0, notice: storageNotice, message: '' }
  }
}

export const useSession = create<SessionState>(() => initialState())
let requests = new AbortController()

export function sessionSignal() {
  return requests.signal
}

function replaceSession(session: Session | null, persist: boolean, message = '') {
  const revision = useSession.getState().revision + 1
  resetNotifications(revision)
  requests.abort()
  requests = new AbortController()
  void queryClient.cancelQueries()
  queryClient.clear()
  let notice = useSession.getState().notice
  if (persist) {
    try {
      if (session) localStorage.setItem(storageKey, JSON.stringify(session))
      else localStorage.removeItem(storageKey)
      notice = ''
    } catch {
      notice = storageNotice
    }
  }
  useSession.setState({ session, revision, notice, message })
}

export function signIn(accessToken: string, expiresIn: number) {
  // JWT expiry is only a UI scheduling hint; /users/me verifies authenticity.
  let expiresAt = Date.now() + expiresIn * 1000
  try {
    const encoded = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload: unknown = JSON.parse(atob(encoded))
    if (typeof payload === 'object' && payload !== null && 'exp' in payload
      && typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      expiresAt = Math.min(expiresAt, payload.exp * 1000)
    }
  } catch {
    // The backend remains authoritative if a token cannot be decoded here.
  }
  replaceSession({ accessToken, expiresAt }, true)
}

export function signOut(message = '') {
  replaceSession(null, true, message)
}

export function startSessionSync() {
  let timer: ReturnType<typeof setTimeout> | undefined
  function scheduleExpiry() {
    clearTimeout(timer)
    const session = useSession.getState().session
    if (!session) return
    const remaining = session.expiresAt - Date.now()
    if (remaining <= 0) signOut('Sesiunea ta a expirat. Autentifică-te din nou.')
    else timer = setTimeout(scheduleExpiry, Math.min(remaining, 2_147_483_647))
  }
  function onStorage(event: StorageEvent) {
    if (event.key !== storageKey && event.key !== null) return
    const session = parseSession(event.newValue)
    if (session?.accessToken === useSession.getState().session?.accessToken
      && session?.expiresAt === useSession.getState().session?.expiresAt) return
    replaceSession(session, false)
  }
  function onVisibility() {
    if (document.visibilityState === 'visible') scheduleExpiry()
  }
  const unsubscribe = useSession.subscribe(scheduleExpiry)
  window.addEventListener('storage', onStorage)
  document.addEventListener('visibilitychange', onVisibility)
  scheduleExpiry()
  return () => {
    unsubscribe()
    clearTimeout(timer)
    window.removeEventListener('storage', onStorage)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
