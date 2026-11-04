import { useAdminAccess } from '../auth/adminAccess'
import { useCurrentUser } from '../auth/currentUser'

/** The owner's email from the admin user list, "Deleted user" once the account is gone, or a dash. */
export default function OwnerLabel({ ownerId }: { ownerId: string | null }) {
  const access = useAdminAccess()
  const currentUser = useCurrentUser()
  if (ownerId === null) return <span className="missing">Deleted user</span>
  const owner = access.users.find((user) => user.id === ownerId)
  if (!owner) return <span className="missing" title="Owner not in the user list">—<span className="sr-only">Unknown owner</span></span>
  return (
    <span className="owner-email">
      {owner.email}{owner.id === currentUser.id && <span className="unit"> (you)</span>}
    </span>
  )
}
