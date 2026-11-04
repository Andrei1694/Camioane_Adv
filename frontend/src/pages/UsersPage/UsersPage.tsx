import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { useCurrentUser } from '../../auth/currentUser'
import { signOut, useSession } from '../../auth/session'
import { api, ApiError, errorMessage } from '../../lib/api'
import { queryClient } from '../../lib/queryClient'
import type { User, UserInput } from '../../lib/user'
import UserForm from './components/UserForm'

interface Editor {
  user?: User
}

export default function UsersPage() {
  const currentUser = useCurrentUser()
  const revision = useSession((state) => state.revision)
  const queryKey = ['users', revision] as const
  const usersQuery = useQuery({ queryKey, queryFn: ({ signal }) => api.users(signal) })
  const [editor, setEditor] = useState<Editor | null>(null)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [formFailure, setFormFailure] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const addButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const save = useMutation({
    mutationFn: ({ id, data }: { id?: string, data: UserInput }) => id ? api.updateUser(id, data) : api.createUser(data),
  })
  const remove = useMutation({ mutationFn: api.deleteUser })
  const users = usersQuery.data ?? []
  const busy = save.isPending || remove.isPending

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

  function handleForbidden(error: unknown) {
    if (error instanceof ApiError && error.status === 403) {
      setForbidden(true)
      void queryClient.invalidateQueries({ queryKey: ['me', revision] })
    }
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
      await queryClient.cancelQueries({ queryKey })
      if (revision !== useSession.getState().revision) return
      queryClient.setQueryData<User[]>(queryKey, (existing) => {
        const next = (existing ?? []).filter((user) => user.id !== result.id)
        return [...next, result].sort((a, b) => a.email.localeCompare(b.email))
      })
      setMessage(original ? 'User updated.' : 'User added.')
      closeEditor()
      void queryClient.invalidateQueries({ queryKey })
    } catch (error) {
      setFormFailure(errorMessage(error))
      handleForbidden(error)
      if (error instanceof ApiError && error.status === 404) void queryClient.invalidateQueries({ queryKey })
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
      await queryClient.cancelQueries({ queryKey })
      if (revision !== useSession.getState().revision) return
      queryClient.setQueryData<User[]>(queryKey, (existing) => existing?.filter((item) => item.id !== user.id) ?? [])
      setMessage('User deleted.')
      requestAnimationFrame(() => addButton.current?.focus())
      void queryClient.invalidateQueries({ queryKey })
    } catch (error) {
      setFailure(errorMessage(error))
      handleForbidden(error)
      if (error instanceof ApiError && error.status === 404) void queryClient.invalidateQueries({ queryKey })
    } finally {
      remove.reset()
    }
  }

  if (forbidden || (usersQuery.error instanceof ApiError && usersQuery.error.status === 403)) {
    return <Navigate to="/access-denied" replace />
  }

  return (
    <section>
      <header>
        <div className="page-heading">
          <h1>Users</h1>
          <button ref={addButton} className="primary-button" type="button"
            disabled={editor !== null || busy || usersQuery.isPending}
            onClick={(event) => openEditor(event.currentTarget)}>Add user</button>
        </div>
        <p className="page-description">Manage accounts and administrator access.</p>
      </header>
      <p className="status-message" role="status" aria-atomic="true">{message}</p>
      {failure && <p className="request-error" role="alert">{failure}</p>}
      {usersQuery.isError && (
        <div className="request-error" role="alert">
          <p>{errorMessage(usersQuery.error)}{usersQuery.data && ' Showing the last loaded accounts.'}</p>
          <button type="button" disabled={usersQuery.isFetching} onClick={() => void usersQuery.refetch()}>Retry</button>
        </div>
      )}
      {editor !== null && (
        <UserForm key={editor.user?.id ?? 'create'} user={editor.user} users={users}
          isSelf={editor.user?.id === currentUser.id} pending={save.isPending} error={formFailure}
          onSave={handleSave} onCancel={closeEditor} />
      )}
      {usersQuery.isPending ? <p className="loading-state" role="status">Loading users…</p> : (
        <table className="users-table" role="table" aria-label="Users">
          <caption>{usersQuery.data ? <>{users.length} {users.length === 1 ? 'user' : 'users'}</> : 'Users unavailable'}{usersQuery.isFetching ? ' · Refreshing…' : ''}</caption>
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
                <td className="email-cell" role="cell">{user.email}{user.id === currentUser.id && <span className="optional-label"> (you)</span>}</td>
                <td role="cell">{user.role === 'ADMIN' ? 'Admin' : 'User'}</td>
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
            {users.length === 0 && !usersQuery.isError && (
              <tr role="row"><td className="empty-state" colSpan={3} role="cell">No users yet. Add a user to get started.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  )
}
