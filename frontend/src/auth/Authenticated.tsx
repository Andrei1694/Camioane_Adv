import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { api, errorMessage } from '../lib/api'
import { signOut, useSession } from './session'
import { UserContext, useCurrentUser } from './currentUser'

export function HomeRedirect() {
  const user = useCurrentUser()
  return <Navigate to={user.role === 'ADMIN' ? '/users' : '/access-denied'} replace />
}

export default function Authenticated({ children, adminOnly = false }: { children: ReactNode, adminOnly?: boolean }) {
  const session = useSession((state) => state.session)
  const revision = useSession((state) => state.revision)
  const current = useQuery({
    queryKey: ['me', revision],
    queryFn: ({ signal }) => api.me(signal),
    enabled: session !== null,
  })

  if (!session) return <Navigate to="/login" replace />
  if (current.isPending) return <h1 role="status">Signing in…</h1>
  if (!current.data) return (
    <section>
      <h1>Could not verify your session</h1>
      <p className="request-error" role="alert">{errorMessage(current.error)}</p>
      <div className="form-actions">
        <button type="button" disabled={current.isFetching} onClick={() => void current.refetch()}>Retry</button>
        <button type="button" onClick={() => signOut()}>Sign out</button>
      </div>
    </section>
  )
  if (adminOnly && current.data.role !== 'ADMIN') return <Navigate to="/access-denied" replace />

  return (
    <UserContext.Provider value={current.data}>
      <div className="session-bar">
        <p>Signed in as <span>{current.data.email}</span></p>
        <button type="button" onClick={() => signOut()}>Sign out</button>
      </div>
      {current.isError && <div className="request-error" role="alert">
        <p>{errorMessage(current.error)} Your last verified session is still open.</p>
        <button type="button" disabled={current.isFetching} onClick={() => void current.refetch()}>Retry session check</button>
      </div>}
      {children}
    </UserContext.Provider>
  )
}
