import { Suspense, useEffect } from 'react'
import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Link, Navigate, Outlet, RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import Authenticated, { HomeRedirect } from './auth/Authenticated'
import { useCurrentUser } from './auth/currentUser'
import { useAdminAccess } from './auth/adminAccess'
import { startSessionSync, useSession } from './auth/session'
import { queryClient } from './lib/queryClient'
import AppShell from './components/AppShell'
import NotificationViewport from './components/NotificationViewport'
import CampaignPage from './pages/CampaignPage/CampaignPage'
import CarsPage from './pages/CarsPage/CarsPage'
import CreditsPage from './pages/CreditsPage/CreditsPage'
import DashboardPage from './pages/DashboardPage/DashboardPage'
import FilesPage from './pages/FilesPage/FilesPage'
import LoginPage from './pages/LoginPage/LoginPage'
import ProfilePage from './pages/ProfilePage/ProfilePage'
import UsersPage from './pages/UsersPage/UsersPage'
import './App.css'

// Reloads once when a deployment has replaced the page's chunk.
const RouteBuilderPage = lazyRouteComponent(() => import('./pages/RouteBuilderPage/RouteBuilderPage'))
const VideoEditorPage = lazyRouteComponent(() => import('./pages/VideoEditorPage/VideoEditorPage'))

function Layout() {
  const revision = useSession((state) => state.revision)
  useEffect(startSessionSync, [])
  return <><Outlet key={revision} /><NotificationViewport /></>
}

function LoginRoute() {
  const session = useSession((state) => state.session)
  return session ? <Authenticated><HomeRedirect /></Authenticated> : <AppShell><LoginPage /></AppShell>
}

function AccessDenied() {
  const user = useCurrentUser()
  const access = useAdminAccess()
  if (access.status === 'granted') return <Navigate to="/dashboard" replace />
  return (
    <section>
      <h1>Este necesar accesul de administrator</h1>
      <p className="page-description">{user.role === 'ADMIN'
        ? 'Accesul tău de administrator nu este disponibil momentan. Rolul poate fi inactiv, încă neactivat sau expirat.'
        : 'Contul tău nu are acces de administrator.'} Panoul de control, campaniile, mașinile, fișierele, creditele, gestionarea utilizatorilor și planificatorul de trasee necesită acces activ de administrator. Contactează administratorul dacă ai nevoie de acces.</p>
      {user.role === 'ADMIN' && <button type="button" disabled={access.isFetching} onClick={access.retry}>
        {access.isFetching ? 'Se verifică…' : 'Reverifică accesul'}
      </button>}
    </section>
  )
}

const rootRoute = createRootRoute({
  component: Layout,
  notFoundComponent: () => <AppShell><section><h1>Pagina nu a fost găsită</h1><p className="page-description"><Link to="/">Înapoi la aplicație</Link></p></section></AppShell>,
})
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <Authenticated><HomeRedirect /></Authenticated> })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginRoute })
const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/dashboard', component: () => <Authenticated adminOnly><DashboardPage /></Authenticated> })
const campaignRoute = createRoute({ getParentRoute: () => rootRoute, path: '/campaign', component: () => <Authenticated adminOnly><CampaignPage /></Authenticated> })
const carsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cars', component: () => <Authenticated adminOnly><CarsPage /></Authenticated> })
const filesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/files', component: () => <Authenticated adminOnly><FilesPage /></Authenticated> })
const videoEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/files/$fileId/edit',
  component: () => <Authenticated adminOnly><Suspense fallback={<p role="status">Se încarcă editorul video…</p>}><VideoEditorPage /></Suspense></Authenticated>,
})
const creditsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/credits', component: () => <Authenticated adminOnly><CreditsPage /></Authenticated> })
const usersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/users', component: () => <Authenticated adminOnly><UsersPage /></Authenticated> })
const routeBuilderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/routes',
  component: () => <Authenticated adminOnly><Suspense fallback={<p role="status">Se încarcă planificatorul de trasee…</p>}><RouteBuilderPage /></Suspense></Authenticated>,
})
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/profile', component: () => <Authenticated><ProfilePage /></Authenticated> })
const deniedRoute = createRoute({ getParentRoute: () => rootRoute, path: '/access-denied', component: () => <Authenticated><AccessDenied /></Authenticated> })
const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute, loginRoute, dashboardRoute, campaignRoute, carsRoute, filesRoute, videoEditorRoute, creditsRoute, usersRoute, routeBuilderRoute, profileRoute, deniedRoute]) })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  return <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>
}
