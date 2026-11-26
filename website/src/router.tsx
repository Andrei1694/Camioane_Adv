import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, createRoute, createRouter, Link, Navigate, Outlet, RouterProvider, useLocation } from '@tanstack/react-router'
import App from './App'
import AccountLayout from './components/AccountLayout'
import AccountPage from './pages/AccountPage/AccountPage'
import LoginPage from './pages/LoginPage/LoginPage'
import { startSessionSync, useSession } from './auth/session'
import { queryClient } from './lib/queryClient'

function RootLayout() {
  const revision = useSession((state) => state.revision)
  useEffect(startSessionSync, [])
  return <Outlet key={revision} />
}

function LandingPage() {
  useEffect(() => { document.title = 'Camioane App · Publicitate pe mașini cu ecrane LED' }, [])
  return <App />
}

function IndexRedirect() {
  const hash = useLocation({ select: (location) => location.hash })
  return <Navigate to="/" hash={hash} replace />
}

function NotFound() {
  return (
    <AccountLayout title="Pagina nu a fost găsită" compact>
      <p className="account-lead">Adresa accesată nu corespunde unei pagini disponibile.</p>
      <div className="account-actions"><Link className="button" to="/">Înapoi la pagina principală</Link></div>
    </AccountLayout>
  )
}

const rootRoute = createRootRoute({ component: RootLayout, notFoundComponent: NotFound })
const landingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: LandingPage })
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/index.html', component: IndexRedirect })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginPage })
const accountRoute = createRoute({ getParentRoute: () => rootRoute, path: '/account', component: AccountPage })
const router = createRouter({
  routeTree: rootRoute.addChildren([landingRoute, indexRoute, loginRoute, accountRoute]),
  trailingSlash: 'never',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function WebsiteRouter() {
  return <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>
}
