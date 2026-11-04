import { useCurrentUser } from '../../auth/currentUser'
import AvatarEditor from '../../components/AvatarEditor'
import { roleLabels } from '../../lib/user'
import './ProfilePage.css'

export default function ProfilePage() {
  const user = useCurrentUser()
  return (
    <section className="profile-page">
      <header>
        <h1>Profile</h1>
        <p className="page-description">Your picture shows beside your email in the sidebar and in the administrators' Users list.</p>
      </header>
      <section className="profile-block" aria-labelledby="profile-picture-title">
        <h2 id="profile-picture-title">Profile picture</h2>
        <AvatarEditor user={user} isSelf primary />
      </section>
      <section className="profile-block" aria-labelledby="profile-account-title">
        <h2 id="profile-account-title">Account</h2>
        <dl className="review-checks">
          <div className="check"><dt>Email</dt><dd>{user.email}</dd></div>
          <div className="check"><dt>Role</dt><dd>{user.role === 'ADMIN' ? 'Administrator' : roleLabels[user.role]}</dd></div>
        </dl>
        <p className="field-hint">An administrator changes your email, password and role.</p>
      </section>
    </section>
  )
}
