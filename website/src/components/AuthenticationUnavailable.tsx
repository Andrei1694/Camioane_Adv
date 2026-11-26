import { Link } from '@tanstack/react-router'
import { signOut, useSession } from '../auth/session'
import AccountLayout from './AccountLayout'

export default function AuthenticationUnavailable() {
  const session = useSession((state) => state.session)
  return (
    <AccountLayout title="Autentificare indisponibilă" compact>
      <p className="account-lead" role="status">Serviciul de autentificare nu este disponibil momentan. Ne poți contacta pentru ajutor.</p>
      <div className="account-actions">
        <Link className="button button-primary" to="/" hash="contact">Contactează-ne</Link>
        {session && <button className="button" type="button" onClick={() => signOut()}>Deconectare</button>}
      </div>
    </AccountLayout>
  )
}
