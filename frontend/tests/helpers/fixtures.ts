import type { User } from '../../src/lib/user'
import type { Car } from '../../src/lib/car'
import type { StoredFile } from '../../src/lib/file'
import type { StoredCampaign } from '../../src/lib/campaign'
import type { SavedRoute } from '../../src/lib/route'
import type { CreditPurchase, CreditTransaction } from '../../src/lib/credit'

export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const stamp = '2026-11-10T10:00:00.000Z'
export const user = (overrides: Partial<User> = {}): User => ({
  id: id(1), email: 'admin@example.test', role: 'ADMIN', avatar: null, ...overrides,
})
export const car = (overrides: Partial<Car> = {}): Car => ({
  id: id(2), plate: 'B 01 TEST', makeModel: 'Test van', driverName: 'Test Driver',
  routeId: 'centru', status: 'active', version: 1, createdAt: stamp, updatedAt: stamp, ...overrides,
})
export const file = (overrides: Partial<StoredFile> = {}): StoredFile => ({
  id: id(3), ownerId: id(1), originalName: 'creative.png', mimeType: 'image/png', size: 1000,
  createdAt: stamp, downloadUrl: `/files/${overrides.id ?? id(3)}/download`, ...overrides,
})
export const campaign = (overrides: Partial<StoredCampaign> = {}): StoredCampaign => ({
  id: id(4), name: 'Test campaign', version: 1, createdAt: stamp, updatedAt: stamp,
  days: [{ date: '2026-11-12', intervals: [{ id: id(40), start: 600, end: 660 }] }], ...overrides,
})
export const route = (overrides: Partial<SavedRoute> = {}): SavedRoute => ({
  id: id(5), name: 'Test route', waypoints: [[26.1, 44.4], [26.2, 44.5]],
  version: 1, createdAt: stamp, updatedAt: stamp, ...overrides,
})
export const purchase = (overrides: Partial<CreditPurchase> = {}): CreditPurchase => ({
  id: id(6), userId: id(1), credits: 10, unitPriceMinor: 100, amountMinor: 1000,
  currency: 'RON', status: 'PENDING', reference: null, createdAt: stamp, settledAt: null, ...overrides,
})
export const transaction = (overrides: Partial<CreditTransaction> = {}): CreditTransaction => ({
  id: id(7), userId: id(1), amount: 10, balanceAfter: 110, type: 'ADJUSTMENT',
  purchaseId: null, note: 'Test adjustment', createdAt: stamp, ...overrides,
})
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
