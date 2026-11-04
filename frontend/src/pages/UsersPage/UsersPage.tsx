import { useRef, useState } from 'react'
import UserForm from './components/UserForm'
import { loadUsers, saveUsers } from './userStorage'
import type { User } from './user'

interface Editor {
  user?: User
}

export default function UsersPage() {
  const [data, setData] = useState(loadUsers)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [message, setMessage] = useState('')
  const addButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const users = [...data.users].sort((a, b) => a.email.localeCompare(b.email))

  function openEditor(button: HTMLButtonElement, user?: User) {
    returnFocus.current = button
    setMessage('')
    setEditor({ user })
  }

  function closeEditor() {
    setEditor(null)
    requestAnimationFrame(() => {
      const target = returnFocus.current
      if (target?.isConnected) target.focus()
      else addButton.current?.focus()
    })
  }

  function updateUsers(nextUsers: User[]) {
    const notice = saveUsers(nextUsers)
    setData({ users: nextUsers, notice })
  }

  function handleSave(user: User) {
    const original = editor?.user
    const nextUsers = original
      ? data.users.map((existing) => existing.email === original.email ? user : existing)
      : [...data.users, user]

    updateUsers(nextUsers)
    setMessage(original ? 'User updated.' : 'User added.')
    closeEditor()
  }

  function handleDelete(user: User) {
    if (!window.confirm(`Delete ${user.email}? This removes the user from this browser's demo list.`)) return

    updateUsers(data.users.filter((existing) => existing.email !== user.email))
    setMessage('User deleted.')
    requestAnimationFrame(() => addButton.current?.focus())
  }

  return (
    <main className="users-page">
      <p className="product-name">Camioane App</p>
      <header>
        <div className="page-heading">
          <h1>Users</h1>
          <button
            ref={addButton}
            className="primary-button"
            type="button"
            disabled={editor !== null}
            onClick={(event) => openEditor(event.currentTarget)}
          >
            Add user
          </button>
        </div>
        <p className="demo-note">{data.notice ? 'Demo — browser storage needs attention' : 'Demo — saved in this browser'}</p>
      </header>

      {data.notice && <p className="storage-notice" role="alert">{data.notice}</p>}
      <p className="status-message" role="status" aria-atomic="true">{message}</p>

      {editor !== null && (
        <UserForm
          key={editor.user?.email ?? 'create'}
          user={editor.user}
          users={data.users}
          onSave={handleSave}
          onCancel={closeEditor}
        />
      )}

      <table className="users-table" role="table" aria-label="Users">
        <caption>{users.length} {users.length === 1 ? 'user' : 'users'}</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">Email</th>
            <th className="actions-column" scope="col" role="columnheader">Actions</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {users.map((user) => (
            <tr key={user.email} role="row">
              <td className="email-cell" role="cell">{user.email}</td>
              <td role="cell">
                <div className="row-actions">
                  <button
                    type="button"
                    aria-label={`Edit ${user.email}`}
                    disabled={editor !== null}
                    onClick={(event) => openEditor(event.currentTarget, user)}
                  >
                    Edit
                  </button>
                  <button
                    className="delete-button"
                    type="button"
                    aria-label={`Delete ${user.email}`}
                    disabled={editor !== null}
                    onClick={() => handleDelete(user)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr role="row">
              <td className="empty-state" colSpan={2} role="cell">No users yet. Add a user to get started.</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  )
}
