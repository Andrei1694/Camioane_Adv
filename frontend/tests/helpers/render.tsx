/* oxlint-disable react/only-export-components -- Test providers and helpers are not Fast Refresh entry points. */
import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { UserContext } from '../../src/auth/currentUser'
import { AdminAccessContext, adminAccessOptions } from '../../src/auth/adminAccess'
import type { AdminAccess } from '../../src/auth/adminAccess'
import { signIn, useSession } from '../../src/auth/session'
import { queryClient } from '../../src/lib/queryClient'
import type { User } from '../../src/lib/user'
import { user } from './fixtures'

export function authenticate(account = user(), users = [account]) {
  signIn('test-token', 3600)
  const revision = useSession.getState().revision
  queryClient.setQueryData(['me', revision], account)
  queryClient.setQueryData([...adminAccessOptions(revision).queryKey], { status: 'granted', users })
  return revision
}

export function Providers({ children, account = user(), users = [account], access }: {
  children: ReactNode, account?: User, users?: User[], access?: Partial<AdminAccess>,
}) {
  return <QueryClientProvider client={queryClient}>
    <UserContext.Provider value={account}>
      <AdminAccessContext.Provider value={{ status: 'granted', users, isFetching: false, retry: () => {}, ...access }}>
        {children}
      </AdminAccessContext.Provider>
    </UserContext.Provider>
  </QueryClientProvider>
}

export async function renderPage(content: ReactNode, options: {
  account?: User, users?: User[], access?: Partial<AdminAccess>, path?: string,
} = {}) {
  const path = options.path ?? '/'
  const root = createRootRoute()
  const page = createRoute({ getParentRoute: () => root, path, component: () => <>{content}</> })
  const destinations = ['/login', '/access-denied', '/dashboard', '/profile', '/files', '/users']
    .filter((destination) => destination !== path)
    .map((destination) => createRoute({
      getParentRoute: () => root, path: destination,
      component: () => <h1>{destination}</h1>,
    }))
  const router = createRouter({
    routeTree: root.addChildren([page, ...destinations]),
    history: createMemoryHistory({ initialEntries: [path.replace('$fileId', '00000000-0000-4000-8000-000000000003')] }),
    defaultPendingMinMs: 0,
  })
  await router.load()
  return { ...render(<Providers {...options}><RouterProvider router={router} /></Providers>), router }
}
