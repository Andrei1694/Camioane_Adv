import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useCurrentUser } from '../../auth/currentUser'
import { handleAdminError, refreshAdminAccess, updateAdminUsers, useAdminAccess } from '../../auth/adminAccess'
import { signOut, useSession } from '../../auth/session'
import { api, ApiError, errorMessage } from '../../lib/api'
import { roleLabels } from '../../lib/user'
import type { User, UserInput } from '../../lib/user'
import Avatar from '../../components/Avatar'
import UserForm from './components/UserForm'

interface Editor {
  user?: User
}

export default function UsersPage() {
  const currentUser = useCurrentUser()
  const revision = useSession((state) => state.revision)
  const access = useAdminAccess()
  const [editor, setEditor] = useState<Editor | null>(null)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [formFailure, setFormFailure] = useState('')
  const addButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const save = useMutation({
    mutationFn: ({ id, data }: { id?: string, data: UserInput }) => id ? api.updateUser(id, data) : api.createUser(data),
    onError: (error) => handleAdminError(error, revision),
  })
  const remove = useMutation({ mutationFn: api.deleteUser, onError: (error) => handleAdminError(error, revision) })
  const users = access.users
  const busy = save.isPending || remove.isPending
  // The latest copy of the account being edited, so a picture change shows in the open form.
  const editing = editor?.user && (users.find((user) => user.id === editor.user?.id) ?? editor.user)

  function openEditor(button: HTMLButtonElement, user?: User) {
    returnFocus.current = button
    setMessage('')
    setFormFailure('')
    setFailure('')
    setEditor({ user })
  }

  function closeEditor() {
    setEditor(null)
    setFormFailure('')
    requestAnimationFrame(() => {
      const target = returnFocus.current
      if (target?.isConnected) target.focus()
      else addButton.current?.focus()
    })
  }

  async function handleSave(data: UserInput) {
    if (busy) return
    const original = editor?.user
    setFormFailure('')
    try {
      const result = await save.mutateAsync({ id: original?.id, data })
      if (revision !== useSession.getState().revision) return
      if (original?.id === currentUser.id && (result.email !== currentUser.email || data.password !== undefined)) {
        signOut('Your account was updated. Please sign in again.')
        return
      }
      const updated = await updateAdminUsers(revision, (existing) => {
        const next = existing.filter((user) => user.id !== result.id)
        return [...next, result].sort((a, b) => a.email.localeCompare(b.email))
      })
      if (!updated || revision !== useSession.getState().revision) return
      setMessage(original ? 'User updated.' : 'User added.')
      closeEditor()
    } catch (error) {
      if (revision !== useSession.getState().revision) return
      setFormFailure(errorMessage(error))
      if (error instanceof ApiError && error.status === 404) refreshAdminAccess(revision)
    } finally {
      save.reset()
    }
  }

  async function handleDelete(user: User) {
    if (busy || !window.confirm('Delete ' + user.email + '? This permanently deletes the account and ends its access.')) return
    setFailure('')
    setMessage('')
    try {
      await remove.mutateAsync(user.id)
      if (revision !== useSession.getState().revision) return
      const updated = await updateAdminUsers(revision, (existing) => existing.filter((item) => item.id !== user.id))
      if (!updated || revision !== useSession.getState().revision) return
      setMessage('User deleted.')
      requestAnimationFrame(() => addButton.current?.focus())
    } catch (error) {
      if (revision !== useSession.getState().revision) return
      setFailure(errorMessage(error))
      if (error instanceof ApiError && error.status === 404) refreshAdminAccess(revision)
    } finally {
      remove.reset()
    }
  }

  return (
    <section>
      <header>
        <div className="page-heading">
          <h1>Users</h1>
          <button ref={addButton} className="primary-button" type="button"
            disabled={editor !== null || busy}
            onClick={(event) => openEditor(event.currentTarget)}>Add user</button>
        </div>
        <p className="page-description">Manage accounts and assign Admin, Operator, Driver, and User roles.</p>
      </header>
      <p className="status-message" role="status" aria-atomic="true">{message}</p>
      {failure && <p className="request-error" role="alert">{failure}</p>}
      {editor !== null && (
        <UserForm key={editor.user?.id ?? 'create'} user={editing} users={users}
          isSelf={editor.user?.id === currentUser.id} pending={save.isPending} error={formFailure}
          onSave={handleSave} onCancel={closeEditor} />
      )}
      <table className="users-table" role="table" aria-label="Users">
        <caption>{users.length} {users.length === 1 ? 'user' : 'users'}{access.isFetching ? ' · Refreshing…' : ''}</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">Email</th>
            <th className="role-column" scope="col" role="columnheader">Role</th>
            <th className="actions-column" scope="col" role="columnheader">Actions</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {users.map((user) => (
            <tr key={user.id} role="row">
              <td className="email-cell" role="cell">
                <span className="user-identity">
                  <Avatar user={user} size={32} />
                  <span>{user.email}{user.id === currentUser.id && <span className="optional-label"> (you)</span>}</span>
                </span>
              </td>
              <td role="cell">{roleLabels[user.role]}</td>
              <td role="cell">
                <div className="row-actions">
                  <button type="button" aria-label={'Edit ' + user.email} disabled={editor !== null || busy}
                    onClick={(event) => openEditor(event.currentTarget, user)}>Edit</button>
                  <button className="delete-button" type="button" aria-label={'Delete ' + user.email}
                    title={user.id === currentUser.id ? 'You cannot delete your own account' : undefined}
                    disabled={editor !== null || busy || user.id === currentUser.id}
                    onClick={() => void handleDelete(user)}>{remove.isPending && remove.variables === user.id ? 'Deleting…' : 'Delete'}</button>
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr role="row"><td className="empty-state" colSpan={3} role="cell">No users yet. Add a user to get started.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
