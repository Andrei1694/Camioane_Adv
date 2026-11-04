import { Suspense, useEffect } from 'react'
import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Link, Outlet, RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import Authenticated, { HomeRedirect } from './auth/Authenticated'
import { useCurrentUser } from './auth/currentUser'
import { startSessionSync, useSession } from './auth/session'
import { queryClient } from './lib/queryClient'
import AppShell from './components/AppShell'
import LoginPage from './pages/LoginPage/LoginPage'
import UsersPage from './pages/UsersPage/UsersPage'
import './App.css'

// Reloads once when a deployment has replaced the page's chunk.
const RouteBuilderPage = lazyRouteComponent(() => import('./pages/RouteBuilderPage/RouteBuilderPage'))

function Layout() {
  const revision = useSession((state) => state.revision)
  useEffect(startSessionSync, [])
  return <Outlet key={revision} />
}

function LoginRoute() {
  const session = useSession((state) => state.session)
  return session ? <Authenticated><HomeRedirect /></Authenticated> : <AppShell><LoginPage /></AppShell>
}

function AccessDenied() {
  const user = useCurrentUser()
  return (
    <section>
      <h1>Administrator access required</h1>
      <p className="page-description">Your account does not have access to user management. Contact your administrator if you need access.</p>
      {user.role === 'ADMIN' && <p className="page-description"><Link to="/users">Retry user management</Link></p>}
    </section>
  )
}

const rootRoute = createRootRoute({
  component: Layout,
  notFoundComponent: () => <AppShell><section><h1>Page not found</h1><p className="page-description"><Link to="/">Return to the app</Link></p></section></AppShell>,
})
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <Authenticated><HomeRedirect /></Authenticated> })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginRoute })
const usersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/users', component: () => <Authenticated adminOnly><UsersPage /></Authenticated> })
const routeBuilderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/routes',
  component: () => <Authenticated adminOnly><Suspense fallback={<p role="status">Loading route builder…</p>}><RouteBuilderPage /></Suspense></Authenticated>,
})
const deniedRoute = createRoute({ getParentRoute: () => rootRoute, path: '/access-denied', component: () => <Authenticated><AccessDenied /></Authenticated> })
const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute, loginRoute, usersRoute, routeBuilderRoute, deniedRoute]) })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  return <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>
}
