import { AppState } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'
import { queryClient } from '../lib/queryClient'

// Port of frontend/src/auth/session.ts. The token lives in the Keychain (iOS) or the
// Keystore (Android) instead of localStorage, and that storage is asynchronous.
interface Session {
  accessToken: string
  expiresAt: number
}

interface SessionState {
  session: Session | null
  revision: number
  /** The saved session has been read from secure storage. */
  hydrated: boolean
  notice: string
  message: string
}

const storageKey = 'camioane.session.v1'
const storageNotice = 'Secure storage is unavailable. You may need to sign in again after closing the app.'
const expiredMessage = 'Your session expired. Please sign in again.'

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
    // Malformed or outdated saved sessions never authenticate a user.
  }
  return null
}

export const useSession = create<SessionState>(() => ({
  session: null, revision: 0, hydrated: false, notice: '', message: '',
}))
let requests = new AbortController()
let writes = Promise.resolve()
let hydration: Promise<void> | undefined

export function sessionSignal() {
  return requests.signal
}

// Writes run one after another, so a quick sign-in then sign-out can't land out of order.
function persist(session: Session | null) {
  writes = writes.then(async () => {
    try {
      if (session) await SecureStore.setItemAsync(storageKey, JSON.stringify(session))
      else await SecureStore.deleteItemAsync(storageKey)
      useSession.setState({ notice: '' })
    } catch {
      useSession.setState({ notice: storageNotice })
    }
  })
}

async function loadSession() {
  try {
    const saved = await SecureStore.getItemAsync(storageKey)
    const session = parseSession(saved)
    if (saved && !session) persist(null)
    useSession.setState({ session, hydrated: true, message: saved && !session ? expiredMessage : '' })
  } catch {
    useSession.setState({ session: null, hydrated: true, notice: storageNotice })
  }
}

/** Reads the saved session once. The app shows its splash screen until this settles. */
export function hydrateSession() {
  hydration ??= loadSession()
  return hydration
}

function replaceSession(session: Session | null, message = '') {
  requests.abort()
  requests = new AbortController()
  void queryClient.cancelQueries()
  queryClient.clear()
  persist(session)
  useSession.setState((state) => ({ session, revision: state.revision + 1, message }))
}

export function signIn(accessToken: string, expiresIn: number) {
  // JWT expiry is only a UI scheduling hint; /users/me verifies authenticity.
  let expiresAt = Date.now() + expiresIn * 1000
  try {
    const encoded = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload: unknown = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')))
    if (typeof payload === 'object' && payload !== null && 'exp' in payload
      && typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      expiresAt = Math.min(expiresAt, payload.exp * 1000)
    }
  } catch {
    // The backend remains authoritative if a token cannot be decoded here.
  }
  replaceSession({ accessToken, expiresAt })
}

export function signOut(message = '') {
  replaceSession(null, message)
}

/** Signs out when the token expires. Timers pause in the background, so recheck on return. */
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
  const unsubscribe = useSession.subscribe(scheduleExpiry)
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') scheduleExpiry()
  })
  scheduleExpiry()
  return () => {
    unsubscribe()
    clearTimeout(timer)
    appState.remove()
  }
}
