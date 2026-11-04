import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { signOut, useSession } from '../auth/session'
import type { User } from '../lib/user'
import './AppShell.css'

function SidebarContent({ user, onNavigate }: { user: User, onNavigate?: () => void }) {
  return (
    <>
      <nav className="sidebar-nav" aria-label="Main navigation">
        <p className="sidebar-label">Workspace</p>
        {user.role === 'ADMIN' && (
          <Link to="/routes" className="sidebar-link" activeOptions={{ exact: true }} onClick={onNavigate}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="6" cy="6" r="3" />
              <circle cx="18" cy="18" r="3" />
              <path d="M9 6h7a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h4M6 9v3m12 0v3" />
            </svg>
            Route builder
          </Link>
        )}
        {user.role === 'ADMIN' ? (
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
        <p className="sidebar-role">{user.role === 'ADMIN' ? 'Administrator' : 'User'}</p>
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

export default function AppShell({ children, user }: { children: ReactNode, user?: User }) {
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
        <Link to="/" className="sidebar-brand">Camioane App</Link>
        <SidebarContent user={user} />
      </aside>
      <header className="mobile-header">
        <Link to="/" className="sidebar-brand">Camioane App</Link>
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
          <Link to="/" className="sidebar-brand" onClick={closeNavigation}>Camioane App</Link>
          <button className="navigation-toggle" type="button" aria-label="Close navigation" onClick={closeNavigation}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </div>
        <SidebarContent user={user} onNavigate={closeNavigation} />
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
