import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { dismissNotification, runNotificationAction, useNotifications } from '../lib/notifications'
import type { AppNotification, NotificationVariant } from '../lib/notifications'
import './NotificationViewport.css'

const labels: Record<NotificationVariant, string> = {
  success: 'Success', error: 'Error', warning: 'Warning', info: 'Information',
}

function presentationBlocked() {
  return document.visibilityState === 'hidden' || document.querySelector('dialog:modal') !== null
}

function subscribePresentation(onChange: () => void) {
  // Native dialogs make the rest of the document inert, regardless of z-index.
  const observer = new MutationObserver(onChange)
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
  document.addEventListener('visibilitychange', onChange)
  return () => {
    observer.disconnect()
    document.removeEventListener('visibilitychange', onChange)
  }
}

function NotificationIcon({ variant }: { variant: NotificationVariant }) {
  return <svg className="notification-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {variant === 'success' ? <><circle cx="12" cy="12" r="9" /><path d="m7.5 12 3 3 6-6" /></>
      : variant === 'error' ? <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m-6 0 6-6" /></>
      : variant === 'warning' ? <><path d="m12 3 10 18H2L12 3Zm0 5v6m0 3h.01" /></>
      : <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></>}
  </svg>
}

function NotificationToast({ notification, blocked, onDismiss }: {
  notification: AppNotification, blocked: boolean, onDismiss: (id: string) => void,
}) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const remaining = useRef(notification.duration)
  const paused = blocked || hovered || focused

  useEffect(() => {
    if (paused || notification.duration === 0) return
    const started = performance.now()
    const timer = window.setTimeout(() => dismissNotification(notification.id), Math.max(0, remaining.current))
    return () => {
      window.clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (performance.now() - started))
    }
  }, [notification.id, notification.duration, paused])

  return <li className={`notification-toast notification-${notification.variant}`}
    onPointerEnter={(event) => { if (event.pointerType !== 'touch') setHovered(true) }}
    onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <NotificationIcon variant={notification.variant} />
    <div className="notification-content">
      <p className="notification-label">{labels[notification.variant]}</p>
      <p>{notification.message}</p>
      {notification.action && <button type="button" className="text-button notification-action"
        onClick={() => runNotificationAction(notification.id)}>{notification.action.label}</button>}
    </div>
    <button type="button" className="icon-button notification-dismiss" data-notification-dismiss
      aria-label={`Dismiss notification: ${notification.message}`} onClick={() => onDismiss(notification.id)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M6 18 18 6" /></svg>
    </button>
  </li>
}

function Announcements({ notifications, blocked }: { notifications: AppNotification[], blocked: boolean }) {
  const polite = useRef<HTMLDivElement>(null)
  const assertive = useRef<HTMLDivElement>(null)
  const announced = useRef(new Map<string, HTMLParagraphElement>())

  useEffect(() => {
    for (const [id, element] of announced.current) {
      if (!notifications.some((item) => item.id === id)) {
        element.remove()
        announced.current.delete(id)
      }
    }
    if (blocked) return
    for (const item of notifications.slice(0, 3)) {
      if (announced.current.has(item.id)) continue
      const region = item.variant === 'error' ? assertive.current : polite.current
      if (!region) continue
      const message = document.createElement('p')
      message.setAttribute('aria-atomic', 'true')
      message.textContent = `${labels[item.variant]}. ${item.message}${item.action ? ` ${item.action.label}.` : ''}`
      // Mutate an already-mounted live region once, after commit, for assistive technology.
      // Keeping its existing nodes also avoids repeating announcements on timer or focus changes.
      region.append(message)
      announced.current.set(item.id, message)
    }
  }, [notifications, blocked])

  // Announce additions only: dismissing one toast must not reannounce its neighbours.
  return <>
    <div ref={polite} className="sr-only" role="status" aria-atomic="false" aria-relevant="additions" />
    <div ref={assertive} className="sr-only" role="alert" aria-atomic="false" aria-relevant="additions" />
  </>
}

export default function NotificationViewport() {
  const notifications = useNotifications((state) => state.notifications)
  const revision = useNotifications((state) => state.revision)
  const blocked = useSyncExternalStore(subscribePresentation, presentationBlocked)
  const viewport = useRef<HTMLElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  function dismiss(id: string) {
    const restore = viewport.current?.contains(document.activeElement)
    dismissNotification(id)
    if (restore) requestAnimationFrame(() => {
      if (presentationBlocked()) return
      const target = viewport.current?.querySelector<HTMLButtonElement>('[data-notification-dismiss]')
        ?? (returnFocus.current?.isConnected ? returnFocus.current : document.getElementById('main-content'))
      target?.focus()
    })
  }

  return <>
    <section ref={viewport} className="notification-viewport" aria-label="Notifications" hidden={blocked || notifications.length === 0}
      onFocusCapture={(event) => {
        if (event.relatedTarget instanceof HTMLElement && !event.currentTarget.contains(event.relatedTarget)) {
          returnFocus.current = event.relatedTarget
        }
      }}>
      <ol className="notification-list">
        {notifications.slice(0, 3).map((notification) => <NotificationToast key={notification.id}
          notification={notification} blocked={blocked} onDismiss={dismiss} />)}
      </ol>
    </section>
    <Announcements key={revision} notifications={notifications} blocked={blocked} />
  </>
}
