import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useCurrentUser } from '../../auth/currentUser'
import { handleAdminError, refreshAdminAccess, updateAdminUsers, useAdminAccess } from '../../auth/adminAccess'
import { signOut, useSession } from '../../auth/session'
import { api, ApiError, errorMessage } from '../../lib/api'
import { useNotify } from '../../lib/useNotify'
import { roleLabels } from '../../lib/user'
import { plural } from '../../lib/format'
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
  const notify = useNotify()
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
    setFormFailure('')
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
        signOut('Contul tău a fost actualizat. Autentifică-te din nou.')
        return
      }
      const updated = await updateAdminUsers(revision, (existing) => {
        const next = existing.filter((user) => user.id !== result.id)
        return [...next, result].sort((a, b) => a.email.localeCompare(b.email))
      })
      if (!updated || revision !== useSession.getState().revision) return
      notify({ variant: 'success', message: original ? 'Utilizatorul a fost actualizat.' : 'Utilizatorul a fost adăugat.' })
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
    if (busy || !window.confirm('Ștergi contul ' + user.email + '? Contul va fi șters definitiv și își va pierde accesul.')) return
    try {
      await remove.mutateAsync(user.id)
      if (revision !== useSession.getState().revision) return
      const updated = await updateAdminUsers(revision, (existing) => existing.filter((item) => item.id !== user.id))
      if (!updated || revision !== useSession.getState().revision) return
      notify({ variant: 'success', message: 'Utilizatorul a fost șters.' })
      requestAnimationFrame(() => addButton.current?.focus())
    } catch (error) {
      if (revision !== useSession.getState().revision) return
      notify({ variant: 'error', message: `Nu s-a putut șterge ${user.email}. ${errorMessage(error)}` })
      if (error instanceof ApiError && error.status === 404) refreshAdminAccess(revision)
    } finally {
      remove.reset()
    }
  }

  return (
    <section>
      <header>
        <div className="page-heading">
          <h1>Utilizatori</h1>
          <button ref={addButton} className="primary-button" type="button"
            disabled={editor !== null || busy}
            onClick={(event) => openEditor(event.currentTarget)}>Adaugă un utilizator</button>
        </div>
        <p className="page-description">Gestionează conturile și atribuie rolurile de administrator, operator, șofer și utilizator.</p>
      </header>
      {editor !== null && (
        <UserForm key={editor.user?.id ?? 'create'} user={editing} users={users}
          isSelf={editor.user?.id === currentUser.id} pending={save.isPending} error={formFailure}
          onSave={handleSave} onCancel={closeEditor} />
      )}
      <table className="users-table" role="table" aria-label="Utilizatori">
        <caption>{plural(users.length, 'utilizator', 'utilizatori')}{access.isFetching ? ' · Se actualizează…' : ''}</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">E-mail</th>
            <th className="role-column" scope="col" role="columnheader">Rol</th>
            <th className="actions-column" scope="col" role="columnheader">Acțiuni</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {users.map((user) => (
            <tr key={user.id} role="row">
              <td className="email-cell" role="cell">
                <span className="user-identity">
                  <Avatar user={user} size={32} />
                  <span>{user.email}{user.id === currentUser.id && <span className="optional-label"> (tu)</span>}</span>
                </span>
              </td>
              <td role="cell">{roleLabels[user.role]}</td>
              <td role="cell">
                <div className="row-actions">
                  <button type="button" aria-label={'Editează ' + user.email} disabled={editor !== null || busy}
                    onClick={(event) => openEditor(event.currentTarget, user)}>Editează</button>
                  <button className="delete-button" type="button" aria-label={'Șterge ' + user.email}
                    title={user.id === currentUser.id ? 'Nu îți poți șterge propriul cont' : undefined}
                    disabled={editor !== null || busy || user.id === currentUser.id}
                    onClick={() => void handleDelete(user)}>{remove.isPending && remove.variables === user.id ? 'Se șterge…' : 'Șterge'}</button>
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr role="row"><td className="empty-state" colSpan={3} role="cell">Nu există încă utilizatori. Adaugă un utilizator pentru a începe.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
