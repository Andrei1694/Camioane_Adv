import { getEmailError, normalizeEmail } from './user'
import type { User } from './user'

const storageKey = 'camioane.users-demo.v1'

interface StoredUsers {
  users: User[]
  notice: string | null
}

function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && 'email' in value && typeof value.email === 'string'
    && !getEmailError(normalizeEmail(value.email))
}

export function loadUsers(): StoredUsers {
  let saved: string | null

  try {
    saved = localStorage.getItem(storageKey)
  } catch {
    return {
      users: [],
      notice: 'Browser storage is unavailable. Changes will only last until you refresh.',
    }
  }

  if (saved === null) {
    return {
      users: [
        { email: 'demo.admin@example.com' },
        { email: 'demo.dispatcher@example.com' },
        { email: 'demo.driver@example.com' },
      ],
      notice: null,
    }
  }

  try {
    const parsed: unknown = JSON.parse(saved)

    if (Array.isArray(parsed) && parsed.every(isUser)) {
      const users = parsed.map(({ email }) => ({ email: normalizeEmail(email) }))

      if (new Set(users.map(({ email }) => email)).size === users.length) {
        return { users, notice: null }
      }
    }
  } catch {
    // Invalid saved data is handled by the same visible recovery state below.
  }

  return {
    users: [],
    notice: 'Saved demo users could not be read. Add a user to start a new list.',
  }
}

export function saveUsers(users: readonly User[]): string | null {
  try {
    // Explicitly select the public field; passwords never enter browser storage.
    localStorage.setItem(storageKey, JSON.stringify(users.map(({ email }) => ({ email }))))
    return null
  } catch {
    return 'Changes could not be saved in this browser. They will only last until you refresh.'
  }
}
