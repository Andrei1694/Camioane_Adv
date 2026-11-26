import { Suspense, useEffect } from 'react'
import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Link, Navigate, Outlet, RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import Authenticated, { AdminOnly, HomeRedirect } from './auth/Authenticated'
import { recheckAccount, useCurrentUser } from './auth/currentUser'
import { useAdminAccess } from './auth/adminAccess'
import { startSessionSync, useSession } from './auth/session'
import { queryClient } from './lib/queryClient'
import AppShell from './components/AppShell'
import NotificationViewport from './components/NotificationViewport'
import CampaignPage from './pages/CampaignPage/CampaignPage'
import CarsPage from './pages/CarsPage/CarsPage'
import ConfigVariablesPage from './pages/ConfigVariablesPage/ConfigVariablesPage'
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
const DisplayPage = lazyRouteComponent(() => import('./pages/DisplayPage/DisplayPage'))
const ScreenVideoPage = lazyRouteComponent(() => import('./pages/ScreenVideoPage/ScreenVideoPage'))

function Layout() {
  const revision = useSession((state) => state.revision)
  useEffect(startSessionSync, [])
  return <><Outlet key={revision} /><NotificationViewport /></>
}

function LoginRoute() {
  const session = useSession((state) => state.session)
  return session ? <Navigate to="/" replace /> : <AppShell><LoginPage /></AppShell>
}

function AuthenticatedLayout() {
  return <Authenticated><Outlet /></Authenticated>
}

function AdminLayout() {
  return <AdminOnly><Outlet /></AdminOnly>
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
        : 'Contul tău nu are acces de administrator.'} Panoul de control, campaniile, mașinile, fișierele, creditele, variabilele de configurare, gestionarea utilizatorilor și planificatorul de trasee necesită acces activ de administrator. Contactează administratorul dacă ai nevoie de acces.</p>
      {user.role !== 'ADMIN' && <p className="page-description">Poți folosi <Link to="/display">Redare pe ecran</Link> pentru videoclipurile și playlistul tău.</p>}
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
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginRoute })
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  component: AuthenticatedLayout,
  onStay: recheckAccount,
})
const adminRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  id: 'admin',
  component: AdminLayout,
})
const indexRoute = createRoute({ getParentRoute: () => authenticatedRoute, path: '/', component: HomeRedirect })
const dashboardRoute = createRoute({ getParentRoute: () => adminRoute, path: '/dashboard', component: DashboardPage })
const campaignRoute = createRoute({ getParentRoute: () => adminRoute, path: '/campaign', component: CampaignPage })
const carsRoute = createRoute({ getParentRoute: () => adminRoute, path: '/cars', component: CarsPage })
const configVariablesRoute = createRoute({ getParentRoute: () => adminRoute, path: '/config-variables', component: ConfigVariablesPage })
const filesRoute = createRoute({ getParentRoute: () => adminRoute, path: '/files', component: FilesPage })
const videoEditorRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/files/$fileId/edit',
  component: () => <Suspense fallback={<p role="status">Se încarcă editorul video…</p>}><VideoEditorPage /></Suspense>,
})
const creditsRoute = createRoute({ getParentRoute: () => adminRoute, path: '/credits', component: CreditsPage })
const screenVideoRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/screen',
  component: () => <Suspense fallback={<p role="status">Se încarcă pagina pentru ecranul camionului…</p>}><ScreenVideoPage /></Suspense>,
})
const fileScreenVideoRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/files/$fileId/screen',
  component: () => <Suspense fallback={<p role="status">Se încarcă pagina pentru ecranul camionului…</p>}><ScreenVideoPage /></Suspense>,
})
const displayRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/display',
  component: () => <Suspense fallback={<p role="status">Se încarcă redarea pe ecran…</p>}><DisplayPage /></Suspense>,
})
const fileDisplayRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/files/$fileId/display',
  component: () => <Suspense fallback={<p role="status">Se încarcă redarea pe ecran…</p>}><DisplayPage /></Suspense>,
})
const usersRoute = createRoute({ getParentRoute: () => adminRoute, path: '/users', component: UsersPage })
const routeBuilderRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/routes',
  component: () => <Suspense fallback={<p role="status">Se încarcă planificatorul de trasee…</p>}><RouteBuilderPage /></Suspense>,
})
const profileRoute = createRoute({ getParentRoute: () => authenticatedRoute, path: '/profile', component: ProfilePage })
const deniedRoute = createRoute({ getParentRoute: () => authenticatedRoute, path: '/access-denied', component: AccessDenied })
const router = createRouter({
  routeTree: rootRoute.addChildren([
    loginRoute,
    authenticatedRoute.addChildren([
      indexRoute, profileRoute, displayRoute, fileDisplayRoute, deniedRoute,
      adminRoute.addChildren([
        dashboardRoute, campaignRoute, carsRoute, configVariablesRoute, filesRoute,
        videoEditorRoute, creditsRoute, screenVideoRoute, fileScreenVideoRoute,
        usersRoute, routeBuilderRoute,
      ]),
    ]),
  ]),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  return <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>
}
