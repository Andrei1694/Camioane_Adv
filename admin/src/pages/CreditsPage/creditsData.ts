import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useSession } from '../../auth/session'
import { api, errorMessage } from '../../lib/api'
import type { CreditPurchase } from '../../lib/credit'
import type { User } from '../../lib/user'

// The API's default page size for lists that page in the footer; it allows 1–100.
export const pageSize = 50
// The API's largest page, for reading the whole pending queue.
const scanPageSize = 100

/** Every credits query sits under this key, so one invalidation refreshes the page after an action. */
export const creditsKey = (revision: number) => ['credits', revision] as const

/**
 * Every pending purchase, oldest first: the order an admin checks payments in. The API lists newest
 * first and at most 100 at a time, so this reads page after page until it has them all.
 */
export async function pendingPurchases(signal: AbortSignal): Promise<CreditPurchase[]> {
  const found = new Map<string, CreditPurchase>()
  for (let offset = 0; ; offset += scanPageSize) {
    const page = await api.creditPurchases({ limit: scanPageSize, offset, status: 'PENDING' }, signal)
    for (const purchase of page.purchases) found.set(purchase.id, purchase)
    if (page.purchases.length === 0 || offset + scanPageSize >= page.total) break
  }
  return [...found.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.id < b.id ? -1 : 1))
}

/** One account's balance. The review dialog, the adjust dialog and the history filter share the cache entry. */
export function useBalance(userId: string | null) {
  const revision = useSession((state) => state.revision)
  return useQuery({
    queryKey: [...creditsKey(revision), 'balance', userId],
    queryFn: ({ signal }) => api.creditBalance(userId ?? undefined, signal),
    enabled: userId !== null,
  })
}

/** The account's email for sentences and titles; the table cells use OwnerLabel instead. */
export function accountName(users: readonly User[], userId: string | null) {
  if (userId === null) return 'un utilizator șters'
  return users.find((user) => user.id === userId)?.email ?? 'un cont care nu apare în lista de utilizatori'
}

export type ListView<T> =
  | { status: 'loading' }
  | { status: 'error', error: string, retrying: boolean }
  | { status: 'ready', rows: T[], total: number, refreshing: boolean }

export function listView<D, T>(query: UseQueryResult<D>, read: (data: D) => { rows: T[], total: number }): ListView<T> {
  if (query.data) return { status: 'ready', ...read(query.data), refreshing: query.isFetching }
  if (query.isError) return { status: 'error', error: errorMessage(query.error), retrying: query.isFetching }
  return { status: 'loading' }
}
