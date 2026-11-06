import { useAdminAccess } from '../auth/adminAccess'
import { useCurrentUser } from '../auth/currentUser'

/** The owner's email from the admin user list, "Deleted user" once the account is gone, or a dash. */
export default function OwnerLabel({ ownerId }: { ownerId: string | null }) {
  const access = useAdminAccess()
  const currentUser = useCurrentUser()
  if (ownerId === null) return <span className="missing">Utilizator șters</span>
  const owner = access.users.find((user) => user.id === ownerId)
  if (!owner) return <span className="missing" title="Proprietarul nu apare în lista de utilizatori">—<span className="sr-only">Proprietar necunoscut</span></span>
  return (
    <span className="owner-email">
      {owner.email}{owner.id === currentUser.id && <span className="unit"> (tu)</span>}
    </span>
  )
}
