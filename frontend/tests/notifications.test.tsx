import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import NotificationViewport from '../src/components/NotificationViewport'
import { clearNotifications, dismissNotification, notifyForSession, resetNotifications, runNotificationAction, useNotifications } from '../src/lib/notifications'

it('deduplicates messages, rejects stale sessions and assigns durations', () => {
  const first = notifyForSession({ variant: 'success', message: ' Saved ' }, 0)
  expect(notifyForSession({ variant: 'success', message: 'Saved' }, 0)).toBe(first)
  expect(notifyForSession({ variant: 'success', message: ' ' }, 0)).toBeUndefined()
  expect(notifyForSession({ variant: 'success', message: 'Stale' }, 9)).toBeUndefined()
  notifyForSession({ variant: 'error', message: 'Failed' }, 0)
  notifyForSession({ variant: 'info', message: 'Action', action: { label: 'Open', onClick: vi.fn() } }, 0)
  expect(useNotifications.getState().notifications.map(({ duration }) => duration)).toEqual([5000, 8000, 0])
  dismissNotification(first!)
  expect(useNotifications.getState().notifications).toHaveLength(2)
  clearNotifications()
  expect(useNotifications.getState().notifications).toEqual([])
})

it('executes actions once and makes actions from a cleared session inert', () => {
  const action = vi.fn()
  const id = notifyForSession({ variant: 'info', message: 'Open', action: { label: 'Open', onClick: action } }, 0)!
  runNotificationAction(id)
  runNotificationAction(id)
  expect(action).toHaveBeenCalledOnce()
  const stale = notifyForSession({ variant: 'info', message: 'Old', action: { label: 'Open', onClick: action } }, 0)!
  resetNotifications(1)
  runNotificationAction(stale)
  expect(action).toHaveBeenCalledOnce()
})

it('shows three notifications and starts a queued timer only when displayed', () => {
  vi.useFakeTimers()
  for (const message of ['One', 'Two', 'Three', 'Four']) notifyForSession({ variant: 'success', message }, 0)
  render(<NotificationViewport />)
  const region = screen.getByRole('region', { name: 'Notificări' })
  expect(within(region).getAllByRole('listitem')).toHaveLength(3)
  expect(within(region).queryByText('Four')).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(5000))
  expect(within(region).getByText('Four')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(4999))
  expect(within(region).getByText('Four')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1))
  expect(useNotifications.getState().notifications).toEqual([])
})

it('pauses timers on keyboard focus and resumes the remaining visible duration', () => {
  vi.useFakeTimers()
  notifyForSession({ variant: 'success', message: 'Saved' }, 0)
  render(<NotificationViewport />)
  act(() => vi.advanceTimersByTime(2000))
  const dismiss = screen.getByRole('button', { name: 'Închide notificarea: Saved' })
  fireEvent.focus(dismiss)
  act(() => vi.advanceTimersByTime(10_000))
  expect(dismiss).toBeInTheDocument()
  fireEvent.blur(dismiss, { relatedTarget: document.body })
  act(() => vi.advanceTimersByTime(2999))
  expect(dismiss).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1))
  expect(useNotifications.getState().notifications).toEqual([])
})

it('pauses a notification while hovered and resumes only its remaining time', () => {
  vi.useFakeTimers()
  notifyForSession({ variant: 'success', message: 'Hover notice' }, 0)
  render(<NotificationViewport />)
  act(() => vi.advanceTimersByTime(1500))
  const item = screen.getByRole('listitem')
  fireEvent.pointerEnter(item, { pointerType: 'mouse' })
  act(() => vi.advanceTimersByTime(10_000))
  expect(item).toBeInTheDocument()
  fireEvent.pointerLeave(item, { pointerType: 'mouse' })
  act(() => vi.advanceTimersByTime(3499))
  expect(item).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1))
  expect(useNotifications.getState().notifications).toEqual([])
})

it('defers presentation and announcements while hidden and announces only once', () => {
  vi.useFakeTimers()
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  notifyForSession({ variant: 'error', message: 'Failed' }, 0)
  render(<NotificationViewport />)
  expect(screen.queryByRole('region', { name: 'Notificări' })).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toBeEmptyDOMElement()
  act(() => vi.advanceTimersByTime(20_000))
  visibility.mockReturnValue('visible')
  fireEvent(document, new Event('visibilitychange'))
  expect(screen.getByRole('alert')).toHaveTextContent('Eroare. Failed')
  const announcement = screen.getByRole('alert').firstChild
  fireEvent(document, new Event('visibilitychange'))
  expect(screen.getByRole('alert').firstChild).toBe(announcement)
  act(() => vi.advanceTimersByTime(8000))
  expect(useNotifications.getState().notifications).toEqual([])
})

it('defers notifications while a native modal dialog is active', () => {
  const modal = document.createElement('dialog')
  const query = document.querySelector.bind(document)
  vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => selector === 'dialog:modal' ? modal : query(selector))
  notifyForSession({ variant: 'info', message: 'Saved' }, 0)
  render(<NotificationViewport />)
  expect(screen.queryByRole('region', { name: 'Notificări' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})
