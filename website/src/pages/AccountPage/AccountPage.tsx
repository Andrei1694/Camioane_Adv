import { useQuery } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import AccountLayout from '../../components/AccountLayout'
import AuthenticationUnavailable from '../../components/AuthenticationUnavailable'
import { authErrorMessage } from '../../auth/errorMessage'
import { signOut, useSession } from '../../auth/session'
import { api, isApiConfigured } from '../../lib/api'
import { roleLabels } from '../../lib/user'

export default function AccountPage() {
  const session = useSession((state) => state.session)
  const revision = useSession((state) => state.revision)
  const configured = isApiConfigured()
  const account = useQuery({
    queryKey: ['account', revision],
    queryFn: ({ signal }) => api.me(signal),
    enabled: session !== null && configured,
    gcTime: 0,
  })

  if (!session) return <Navigate to="/login" replace />
  if (!configured) return <AuthenticationUnavailable />

  if (account.isPending || (!account.isFetchedAfterMount && !account.isError)) return (
    <AccountLayout title="Contul meu">
      <p className="account-lead" role="status">Se verifică sesiunea…</p>
      <div className="account-actions"><button className="button" type="button" onClick={() => signOut()}>Deconectare</button></div>
    </AccountLayout>
  )

  if (account.isError || !account.data) return (
    <AccountLayout title="Contul meu">
      <p className="account-lead">Datele contului nu au putut fi verificate.</p>
      <p className="account-notice" role="alert">{authErrorMessage(account.error)}</p>
      <div className="account-actions">
        <button className="button button-primary" type="button" disabled={account.isFetching}
          onClick={() => void account.refetch()}>{account.isFetching ? 'Se verifică…' : 'Reîncearcă'}</button>
        <button className="button" type="button" onClick={() => signOut()}>Deconectare</button>
      </div>
    </AccountLayout>
  )

  const user = account.data
  return (
    <AccountLayout title="Contul meu">
      <p className="account-lead">Datele contului tău. Pentru modificări, contactează administratorul.</p>
      <dl className="account-details">
        <div><dt>Nume</dt><dd>{user.displayName || 'Necompletat'}</dd></div>
        <div><dt>E-mail</dt><dd>{user.email}</dd></div>
        <div><dt>Telefon</dt><dd>{user.phone || 'Necompletat'}</dd></div>
        <div><dt>Rol</dt><dd>{roleLabels[user.role]}</dd></div>
      </dl>
      <div className="account-actions"><button className="button" type="button" onClick={() => signOut()}>Deconectare</button></div>
    </AccountLayout>
  )
}
