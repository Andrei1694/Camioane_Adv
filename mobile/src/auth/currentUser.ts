import { createContext, useContext } from 'react'
import type { User } from '../lib/user'

export const UserContext = createContext<User | null>(null)

export function useCurrentUser() {
  const user = useContext(UserContext)
  if (!user) throw new Error('This screen requires an authenticated user')
  return user
}
