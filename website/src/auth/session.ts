import { create } from 'zustand'
import { queryClient } from '../lib/queryClient'

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

const storageKey = 'camioane.website.session.v1'
const storageNotice = 'Stocarea în browser nu este disponibilă. Este posibil să fie nevoie să te autentifici din nou după reîncărcare.'
const expiredMessage = 'Sesiunea ta a expirat. Autentifică-te din nou.'

function parseSession(saved: string | null): Session | null {
  if (!saved) return null
  try {
    const value: unknown = JSON.parse(saved)
    if (typeof value === 'object' && value !== null
      && 'accessToken' in value && typeof value.accessToken === 'string' && value.accessToken.trim()
      && 'expiresAt' in value && typeof value.expiresAt === 'number'
      && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now()) {
      return { accessToken: value.accessToken, expiresAt: value.expiresAt }
    }
  } catch {
    // An invalid saved session never grants access; /users/me verifies every restored token.
  }
  return null
}

function initialState(): SessionState {
  try {
    const saved = localStorage.getItem(storageKey)
    const session = parseSession(saved)
    if (saved && !session) localStorage.removeItem(storageKey)
    return { session, revision: 0, notice: '', message: saved && !session ? expiredMessage : '' }
  } catch {
    return { session: null, revision: 0, notice: storageNotice, message: '' }
  }
}

export const useSession = create<SessionState>(initialState)
let requests = new AbortController()

export function sessionSignal() {
  return requests.signal
}

function replaceSession(session: Session | null, persist: boolean, message = '') {
  const revision = useSession.getState().revision + 1
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
  // JWT expiry is a scheduling hint only. The server remains the authority on authentication.
  let expiresAt = Date.now() + expiresIn * 1000
  try {
    const encoded = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload: unknown = JSON.parse(atob(encoded))
    if (typeof payload === 'object' && payload !== null && 'exp' in payload
      && typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      expiresAt = Math.min(expiresAt, payload.exp * 1000)
    }
  } catch {
    // A non-decodable token must still pass /users/me before showing account details.
  }
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    signOut(expiredMessage)
    return
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
    if (remaining <= 0) signOut(expiredMessage)
    else timer = setTimeout(scheduleExpiry, Math.min(remaining, 2_147_483_647))
  }

  function syncStoredSession() {
    // A session that could not be persisted must keep working in memory.
    if (useSession.getState().notice) return
    try {
      // Read the latest value: a queued event may already have been superseded in another tab.
      const session = parseSession(localStorage.getItem(storageKey))
      const current = useSession.getState().session
      if (session?.accessToken === current?.accessToken && session?.expiresAt === current?.expiresAt) return
      replaceSession(session, false, session ? '' : 'Tu sau o altă filă ați încheiat sesiunea. Autentifică-te din nou.')
    } catch {
      useSession.setState({ notice: storageNotice })
    }
  }

  function onStorage(event: StorageEvent) {
    if (event.key !== storageKey && event.key !== null) return
    try {
      if (event.storageArea === localStorage) syncStoredSession()
    } catch {
      useSession.setState({ notice: storageNotice })
    }
  }

  function onVisibility() {
    if (document.visibilityState !== 'visible') return
    syncStoredSession()
    scheduleExpiry()
  }

  function onPageShow(event: PageTransitionEvent) {
    onVisibility()
    if (event.persisted) {
      // A history-restored page must reverify its account rather than reveal a cached profile.
      void queryClient.resetQueries({ queryKey: ['account'], type: 'active' })
    }
  }

  const unsubscribe = useSession.subscribe(scheduleExpiry)
  window.addEventListener('storage', onStorage)
  window.addEventListener('pageshow', onPageShow)
  window.addEventListener('focus', onVisibility)
  document.addEventListener('visibilitychange', onVisibility)
  scheduleExpiry()
  return () => {
    unsubscribe()
    clearTimeout(timer)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('pageshow', onPageShow)
    window.removeEventListener('focus', onVisibility)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
