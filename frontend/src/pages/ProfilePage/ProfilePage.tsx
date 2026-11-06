import { useCurrentUser } from '../../auth/currentUser'
import AvatarEditor from '../../components/AvatarEditor'
import { roleLabels } from '../../lib/user'
import './ProfilePage.css'

export default function ProfilePage() {
  const user = useCurrentUser()
  return (
    <section className="profile-page">
      <header>
        <h1>Profil</h1>
        <p className="page-description">Fotografia apare lângă adresa ta de e-mail în bara laterală și în lista de utilizatori a administratorilor.</p>
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
        </dl>
        <p className="field-hint">Un administrator îți poate schimba adresa de e-mail, parola și rolul.</p>
      </section>
    </section>
  )
}
