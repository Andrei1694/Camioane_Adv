import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import Brand from './Brand'
import SiteFooter from './SiteFooter'
import { useSession } from '../auth/session'
import '../App.css'
import './AccountLayout.css'

export default function AccountLayout({ title, children, compact = false }: {
  title: string, children: ReactNode, compact?: boolean,
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const notice = useSession((state) => state.notice)

  useEffect(() => {
    heading.current?.focus()
    document.title = title + ' · Camioane App'
  }, [title])

  return (
    <div className="account-layout">
      <a className="skip-link" href="#main">Sari la conținut</a>
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label="Camioane App — pagina principală"><Brand /></Link>
          <nav aria-label="Cont și contact">
            <ul className="site-nav">
              <li><Link className="button" to="/" hash="contact">Contact</Link></li>
              <li><Link className="button" to="/account">Contul meu</Link></li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className={'account-main' + (compact ? ' account-main-compact' : '')}>
        <h1 ref={heading} tabIndex={-1}>{title}</h1>
        {notice && <p className="account-notice" role="status">{notice}</p>}
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
