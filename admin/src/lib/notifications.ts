import { create } from 'zustand'

export type NotificationVariant = 'success' | 'error' | 'warning' | 'info'

export interface NotificationInput {
  variant: NotificationVariant
  message: string
  /** Visible milliseconds; 0 keeps the notification until dismissed. Actions always persist. */
  duration?: number
  action?: { label: string, onClick: () => void }
}

export interface AppNotification extends NotificationInput {
  id: string
  duration: number
}

interface NotificationState {
  revision: number
  notifications: AppNotification[]
}

export const useNotifications = create<NotificationState>(() => ({ revision: 0, notifications: [] }))
let nextId = 0

/** Called by the session boundary before publishing a new session. Never persists private messages. */
export function resetNotifications(revision: number) {
  useNotifications.setState({ revision, notifications: [] })
}

export function clearNotifications() {
  useNotifications.setState({ notifications: [] })
}

export function dismissNotification(id: string) {
  useNotifications.setState((state) => ({ notifications: state.notifications.filter((item) => item.id !== id) }))
}

/** Prefer useNotify in components; asynchronous callers must pass the revision they started with. */
export function notifyForSession(input: NotificationInput, revision: number): string | undefined {
  const state = useNotifications.getState()
  const message = input.message.trim()
  if (revision !== state.revision || !message) return undefined
  const duplicate = state.notifications.find((item) => item.variant === input.variant && item.message === message)
  if (duplicate) return duplicate.id
  const fallback = input.variant === 'error' || input.variant === 'warning' ? 8000 : 5000
  const duration = input.action ? 0
    : input.duration !== undefined && Number.isFinite(input.duration) && input.duration >= 0
      ? Math.min(input.duration, 2_147_483_647) : fallback
  const notification: AppNotification = { ...input, message, duration, id: `notification-${++nextId}` }
  useNotifications.setState({ notifications: [...state.notifications, notification] })
  return notification.id
}

export function runNotificationAction(id: string) {
  // Looking up the current item also makes actions from a cleared session inert.
  const item = useNotifications.getState().notifications.find((notification) => notification.id === id)
  if (!item?.action) return
  dismissNotification(id)
  item.action.onClick()
}
