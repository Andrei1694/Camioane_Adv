import { useCurrentUser } from '../../auth/currentUser'
import AvatarEditor from '../../components/AvatarEditor'
import BillingEditor from '../../components/BillingEditor'
import { formatLocalDay, formatLocalTime } from '../../lib/format'
import { roleLabels, userStatusLabels } from '../../lib/user'
import './ProfilePage.css'

export default function ProfilePage() {
  const user = useCurrentUser()
  return (
    <section className="profile-page">
      <header>
        <h1>Profil</h1>
        <p className="page-description">Consultă informațiile contului și actualizează fotografia de profil și datele de facturare.</p>
      </header>
      <section className="profile-block" aria-labelledby="profile-picture-title">
        <h2 id="profile-picture-title">Fotografie de profil</h2>
        <AvatarEditor user={user} isSelf primary />
      </section>
      <section className="profile-block" aria-labelledby="profile-account-title">
        <h2 id="profile-account-title">Cont</h2>
        <dl className="review-checks">
          <div className="check"><dt>E-mail</dt><dd>{user.email}</dd></div>
          <div className="check"><dt>Rol</dt><dd>{user.role === 'ADMIN' ? 'Administrator' : roleLabels[user.role]}</dd></div>
          <div className="check"><dt>Nume</dt><dd>{user.displayName || '—'}</dd></div>
          <div className="check"><dt>Telefon</dt><dd>{user.phone || '—'}</dd></div>
          <div className="check"><dt>Stare</dt><dd>{userStatusLabels[user.status]}</dd></div>
          <div className="check"><dt>Creat</dt><dd><time dateTime={user.createdAt}>{formatLocalDay(user.createdAt)}</time></dd></div>
          <div className="check"><dt>Ultima autentificare</dt><dd>{user.lastLoginAt
            ? <time dateTime={user.lastLoginAt}>{formatLocalDay(user.lastLoginAt)}, {formatLocalTime(user.lastLoginAt)}</time>
            : 'Niciodată'}</dd></div>
        </dl>
        <p className="field-hint">Un administrator îți poate schimba numele, telefonul, adresa de e-mail, parola și rolul.</p>
      </section>
      <section className="profile-block" aria-labelledby="profile-billing-title">
        <h2 id="profile-billing-title">Date de facturare</h2>
        <BillingEditor user={user} isSelf />
      </section>
    </section>
  )
}
