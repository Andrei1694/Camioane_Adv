import { useEffect } from 'react'
import { createRootRoute, createRoute, createRouter, Link, Outlet, RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import Authenticated, { HomeRedirect } from './auth/Authenticated'
import { useCurrentUser } from './auth/currentUser'
import { startSessionSync, useSession } from './auth/session'
import { queryClient } from './lib/queryClient'
import LoginPage from './pages/LoginPage/LoginPage'
import UsersPage from './pages/UsersPage/UsersPage'
import './App.css'

function Layout() {
  const notice = useSession((state) => state.notice)
  const revision = useSession((state) => state.revision)
  useEffect(startSessionSync, [])
  return (
    <main className="users-page">
      <p className="product-name">Camioane App</p>
      {notice && <p className="storage-notice" role="alert">{notice}</p>}
      <Outlet key={revision} />
    </main>
  )
}

function LoginRoute() {
  const session = useSession((state) => state.session)
  return session ? <Authenticated><HomeRedirect /></Authenticated> : <LoginPage />
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
  notFoundComponent: () => <section><h1>Page not found</h1><p className="page-description"><Link to="/">Return to the app</Link></p></section>,
})
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <Authenticated><HomeRedirect /></Authenticated> })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginRoute })
const usersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/users', component: () => <Authenticated adminOnly><UsersPage /></Authenticated> })
const deniedRoute = createRoute({ getParentRoute: () => rootRoute, path: '/access-denied', component: () => <Authenticated><AccessDenied /></Authenticated> })
const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute, loginRoute, usersRoute, deniedRoute]) })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  return <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>
}
