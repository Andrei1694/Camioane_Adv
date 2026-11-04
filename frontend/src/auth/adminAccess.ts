import { createContext, useContext } from 'react'
import { queryOptions } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import { queryClient } from '../lib/queryClient'
import type { User } from '../lib/user'
import { useSession } from './session'

type AdminAccessResult = { status: 'granted', users: User[] } | { status: 'denied' }

export interface AdminAccess {
  status: 'checking' | 'granted' | 'denied' | 'unavailable'
  users: readonly User[]
  isFetching: boolean
  retry: () => void
}

export const AdminAccessContext = createContext<AdminAccess | null>(null)

export function useAdminAccess() {
  const access = useContext(AdminAccessContext)
  if (!access) throw new Error('This view requires a verified account')
  return access
}

function adminAccessKey(revision: number) {
  return ['admin-access', revision] as const
}

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403
}

export function adminAccessOptions(revision: number) {
  return queryOptions({
    queryKey: adminAccessKey(revision),
    queryFn: async ({ signal }): Promise<AdminAccessResult> => {
      try {
        return { status: 'granted', users: await api.users(signal) }
      } catch (error) {
        // A denial replaces the entire result, including any previously loaded users.
        if (isForbidden(error)) return { status: 'denied' }
        throw error
      }
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  })
}

export async function handleAdminError(error: unknown, revision: number) {
  if (!isForbidden(error) || revision !== useSession.getState().revision) return
  const queryKey = adminAccessKey(revision)
  // Abort a concurrent read before recording denial so its late result cannot grant access.
  await queryClient.cancelQueries({ queryKey, exact: true })
  if (revision !== useSession.getState().revision) return
  queryClient.setQueryData<AdminAccessResult>(queryKey, { status: 'denied' })
}

export async function updateAdminUsers(revision: number, update: (users: User[]) => User[]) {
  if (revision !== useSession.getState().revision) return false
  const queryKey = adminAccessKey(revision)
  await queryClient.cancelQueries({ queryKey, exact: true })
  if (revision !== useSession.getState().revision) return false
  const current = queryClient.getQueryState<AdminAccessResult>(queryKey)
  // A late successful mutation must never undo a subsequent denial or failed check.
  if (current?.status !== 'success' || current.data?.status !== 'granted') return false
  const next: AdminAccessResult = { status: 'granted', users: update(current.data.users) }
  queryClient.setQueryData<AdminAccessResult>(queryKey, next)
  void queryClient.invalidateQueries({ queryKey, exact: true })
  return true
}

export function refreshAdminAccess(revision: number) {
  if (revision !== useSession.getState().revision) return
  void queryClient.invalidateQueries({ queryKey: adminAccessKey(revision), exact: true })
}
