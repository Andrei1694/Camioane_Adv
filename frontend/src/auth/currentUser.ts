import { createContext, useContext } from 'react'
import { queryClient } from '../lib/queryClient'
import type { User } from '../lib/user'
import { updateAdminUsers } from './adminAccess'
import { useSession } from './session'

export const UserContext = createContext<User | null>(null)

export function useCurrentUser() {
  const user = useContext(UserContext)
  if (!user) throw new Error('This view requires an authenticated user')
  return user
}

/**
 * Writes a user the API just returned into every cached copy: the signed-in account (which
 * feeds UserContext) and the administrator user list. Use it for changes that keep the session,
 * such as a new profile picture.
 */
export async function replaceCachedUser(revision: number, user: User) {
  if (revision !== useSession.getState().revision) return
  queryClient.setQueryData<User>(['me', revision], (current) => current?.id === user.id ? user : current)
  await updateAdminUsers(revision, (users) => users.map((existing) => existing.id === user.id ? user : existing))
}
