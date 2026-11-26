import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { queryClient } from '../src/lib/queryClient'
import { signOut, useSession } from '../src/auth/session'
import { resetNotifications } from '../src/lib/notifications'

let unexpectedRequests: string[] = []

// jsdom has dialog elements but does not implement the native modal methods.
for (const method of ['showModal', 'close'] as const) {
  if (!HTMLDialogElement.prototype[method]) {
    Object.defineProperty(HTMLDialogElement.prototype, method, { configurable: true, writable: true, value: () => {} })
  }
}

beforeEach(() => {
  unexpectedRequests = []
  localStorage.clear()
  sessionStorage.clear()
  signOut()
  useSession.setState({ session: null, revision: 0, notice: '', message: '' })
  resetNotifications(0)
  queryClient.setDefaultOptions({
    queries: { retry: false, gcTime: Infinity, networkMode: 'always' },
    mutations: { retry: false, gcTime: 0, networkMode: 'always' },
  })
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
  vi.stubGlobal('fetch', vi.fn<typeof fetch>((input) => {
    unexpectedRequests.push(String(input))
    return Promise.reject(new Error('Unexpected fetch request'))
  }))
  vi.stubGlobal('XMLHttpRequest', class {
    constructor() {
      unexpectedRequests.push('XMLHttpRequest')
      throw new Error('Unexpected XMLHttpRequest')
    }
  })
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  })
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })))
  vi.stubGlobal('URL', Object.assign(class extends URL {}, {
    createObjectURL: vi.fn(() => 'blob:test-object'), revokeObjectURL: vi.fn(),
  }))
})

afterEach(async () => {
  cleanup()
  await queryClient.cancelQueries()
  queryClient.clear()
  signOut()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  localStorage.clear()
  sessionStorage.clear()
  expect(unexpectedRequests, 'Every request must have an explicit test response').toEqual([])
})
