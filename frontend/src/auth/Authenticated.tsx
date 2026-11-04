import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { api, errorMessage } from '../lib/api'
import { signOut, useSession } from './session'
import { UserContext } from './currentUser'
import { AdminAccessContext, adminAccessOptions, useAdminAccess } from './adminAccess'
import type { AdminAccess } from './adminAccess'
import type { User } from '../lib/user'
import AppShell from '../components/AppShell'

export function HomeRedirect() {
  const access = useAdminAccess()
  return <Navigate to={access.status === 'granted' ? '/dashboard' : '/access-denied'} replace />
}

function VerifiedAccount({ children, user, revision, adminOnly }: {
  children: ReactNode, user: User, revision: number, adminOnly: boolean,
}) {
  const result = useQuery({ ...adminAccessOptions(revision), enabled: user.role === 'ADMIN' })
  const status: AdminAccess['status'] = user.role !== 'ADMIN' ? 'denied'
    : result.isError ? 'unavailable'
    : result.data?.status === 'denied' ? 'denied'
    : !result.isFetchedAfterMount || result.isPending ? 'checking'
    : 'granted'
  const access: AdminAccess = {
    status,
    users: status === 'granted' && result.data?.status === 'granted' ? result.data.users : [],
    isFetching: result.isFetching,
    retry: () => { void result.refetch() },
  }

  if (adminOnly && status === 'denied') return <Navigate to="/access-denied" replace />

  return (
    <UserContext.Provider value={user}>
      <AdminAccessContext.Provider value={access}>
        <AppShell user={user} canManage={status === 'granted'}>
          {status === 'checking' ? <h1 role="status">Checking administrator access…</h1>
            : status === 'unavailable' ? (
              <section>
                <h1>Could not verify administrator access</h1>
                <p className="request-error" role="alert">{errorMessage(result.error)}</p>
                <p className="page-description">You are still signed in. Retry to open the fleet dashboard, user management and route builder.</p>
                <div className="form-actions">
                  <button type="button" disabled={result.isFetching} onClick={access.retry}>{result.isFetching ? 'Checking…' : 'Retry access check'}</button>
                  <button type="button" onClick={() => signOut()}>Sign out</button>
                </div>
              </section>
            ) : children}
        </AppShell>
      </AdminAccessContext.Provider>
    </UserContext.Provider>
  )
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
  if (current.isPending || (!current.isFetchedAfterMount && !current.isError)) return <AppShell><h1 role="status">Signing in…</h1></AppShell>
  if (!current.data || current.isError) return (
    <AppShell user={current.data}><section>
      <h1>Could not verify your session</h1>
      <p className="request-error" role="alert">{errorMessage(current.error)}</p>
      <div className="form-actions">
        <button type="button" disabled={current.isFetching} onClick={() => void current.refetch()}>Retry</button>
        <button type="button" onClick={() => signOut()}>Sign out</button>
      </div>
    </section></AppShell>
  )
  return (
    <VerifiedAccount user={current.data} revision={revision} adminOnly={adminOnly}>
      {children}
    </VerifiedAccount>
  )
}
