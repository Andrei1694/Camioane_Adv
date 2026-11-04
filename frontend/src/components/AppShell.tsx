import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { signOut, useSession } from '../auth/session'
import { roleLabels } from '../lib/user'
import type { User } from '../lib/user'
import './AppShell.css'

// The app icon (a car carrying a rooftop LED screen) redrawn small enough for the sidebar.
function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="5" y="2" width="22" height="13" rx="2.5" fill="#12263a" />
      <rect x="7" y="4" width="18" height="9" rx="1.2" fill="#00c9e8" />
      <path d="M9 6.5h4v4H9zm5 0h4v4h-4zm5 0h4v4h-4zM11 15h2v3h-2zm8 0h2v3h-2z" fill="#12263a" />
      <path d="M3 26.5v-3.6c0-1.4 1-2.4 2.4-2.6l3-.4 3.1-3.3c.5-.5 1.1-.8 1.8-.8h6.6c.8 0 1.5.4 2 1l2.6 3.1 1.6.2c1.4.2 2.4 1.4 2.4 2.8v3.6z" fill="#12263a" />
      <path d="m10.4 20.2 2.4-2.6h3v2.6zm7.2-2.6h2.9l2.2 2.6h-5.1z" fill="#fff" />
      <rect x="4.6" y="22.6" width="3.2" height="1.4" rx=".7" fill="#00c9e8" />
      <circle cx="9.5" cy="26.5" r="3" fill="#12263a" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="22.5" cy="26.5" r="3" fill="#12263a" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return <Link to="/" className="sidebar-brand" onClick={onNavigate}><BrandMark />Camioane App</Link>
}

function SidebarContent({ user, canManage, onNavigate }: { user: User, canManage: boolean, onNavigate?: () => void }) {
  return (
    <>
      <nav className="sidebar-nav" aria-label="Main navigation">
        <p className="sidebar-label">Workspace</p>
        {canManage && (
          <Link to="/dashboard" className="sidebar-link" activeOptions={{ exact: true }} onClick={onNavigate}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M3.5 16a8.5 8.5 0 0 1 17 0" />
              <path d="m12 16 4.5-4.5" />
              <path d="M4 20h16" />
            </svg>
            Dashboard
          </Link>
        )}
        {canManage && (
          <Link to="/routes" className="sidebar-link" activeOptions={{ exact: true }} onClick={onNavigate}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="6" cy="6" r="3" />
              <circle cx="18" cy="18" r="3" />
              <path d="M9 6h7a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h4M6 9v3m12 0v3" />
            </svg>
            Route builder
          </Link>
        )}
        {canManage && (
          <Link to="/files" className="sidebar-link" activeOptions={{ exact: true }} onClick={onNavigate}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
              <path d="M14 3v5h5M9 13h6m-6 4h4" />
            </svg>
            Files
          </Link>
        )}
        {canManage ? (
          <Link to="/users" className="sidebar-link" activeOptions={{ exact: true }} onClick={onNavigate}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="9" cy="8" r="3" />
              <path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-4-5.66" />
            </svg>
            Users
          </Link>
        ) : (
          <Link to="/access-denied" className="sidebar-link" activeOptions={{ exact: true }} onClick={onNavigate}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
              <path d="M12 8v5m0 3h.01" />
            </svg>
            Account access
          </Link>
        )}
      </nav>
      <div className="sidebar-account">
        <p className="sidebar-label">Signed in as</p>
        <p className="sidebar-email">{user.email}</p>
        <p className="sidebar-role">{user.role === 'ADMIN' ? 'Administrator' : roleLabels[user.role]}</p>
        <button className="sidebar-signout" type="button" onClick={() => signOut()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5M21 12H9" />
          </svg>
          Sign out
        </button>
      </div>
    </>
  )
}

export default function AppShell({ children, user, canManage = false }: { children: ReactNode, user?: User, canManage?: boolean }) {
  const notice = useSession((state) => state.notice)
  const mobileNavigation = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)')
    function closeOnDesktop() {
      if (desktop.matches) mobileNavigation.current?.close()
    }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  if (!user) return (
    <main className="users-page">
      <p className="product-name">Camioane App</p>
      {notice && <p className="storage-notice" role="alert">{notice}</p>}
      {children}
    </main>
  )

  function closeNavigation() {
    mobileNavigation.current?.close()
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="app-sidebar" aria-label="Sidebar">
        <Brand />
        <SidebarContent user={user} canManage={canManage} />
      </aside>
      <header className="mobile-header">
        <Brand />
        <button className="navigation-toggle" type="button" aria-label="Open navigation"
          aria-haspopup="dialog" aria-controls="mobile-navigation"
          onClick={() => mobileNavigation.current?.showModal()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>
      <dialog ref={mobileNavigation} id="mobile-navigation" className="mobile-navigation" aria-label="Navigation"
        onClick={(event) => {
          if (event.target !== event.currentTarget) return
          const bounds = event.currentTarget.getBoundingClientRect()
          if (event.clientX < bounds.left || event.clientX > bounds.right
            || event.clientY < bounds.top || event.clientY > bounds.bottom) closeNavigation()
        }}>
        <div className="mobile-navigation-heading">
          <Brand onNavigate={closeNavigation} />
          <button className="navigation-toggle" type="button" aria-label="Close navigation" onClick={closeNavigation}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </div>
        <SidebarContent user={user} canManage={canManage} onNavigate={closeNavigation} />
      </dialog>
      <main className="app-main" id="main-content" tabIndex={-1}>
        <div className="app-content">
          {notice && <p className="storage-notice" role="alert">{notice}</p>}
          {children}
        </div>
      </main>
    </div>
  )
}
