import { useCallback } from 'react'
import { useSession } from '../auth/session'
import { notifyForSession } from './notifications'
import type { NotificationInput } from './notifications'

/** Captures this render's session so a late completion cannot notify the next account. */
export function useNotify() {
  const revision = useSession((state) => state.revision)
  return useCallback((input: NotificationInput) => notifyForSession(input, revision), [revision])
}
