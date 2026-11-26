import { useEffect, useId, useRef, useState } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { handleAdminError, refreshAdminAccess } from '../auth/adminAccess'
import { replaceCachedUser } from '../auth/currentUser'
import { useSession } from '../auth/session'
import { api, ApiError, errorMessage, isRetryableUpload } from '../lib/api'
import { queryClient } from '../lib/queryClient'
import { useNotify } from '../lib/useNotify'
import { avatarFileError, avatarMaxLabel, avatarTypes } from '../lib/user'
import type { User } from '../lib/user'
import Avatar from './Avatar'
import UploadProgress from './UploadProgress'
import type { Upload } from './UploadProgress'
import './AvatarEditor.css'

/**
 * Sets, replaces or removes one user's profile picture. Each change saves on its own, straight
 * away: the API takes the picture separately from the account's other fields.
 */
export default function AvatarEditor({ user, isSelf, primary = false }: {
  user: User
  isSelf: boolean
  /** The screen's one primary action is the upload (the Profile page), not a form's Save. */
  primary?: boolean
}) {
  const revision = useSession((state) => state.revision)
  const [upload, setUpload] = useState<Upload | null>(null)
  const [removing, setRemoving] = useState(false)
  const notify = useNotify()
  const picker = useRef<HTMLInputElement>(null)
  const uploadButton = useRef<HTMLButtonElement>(null)
  const uploadAbort = useRef<AbortController | null>(null)
  const id = useId()
  const uploading = upload !== null && upload.phase !== 'failed'
  const busy = uploading || removing
  const owner = `pentru ${user.email}`

  useBlocker({
    shouldBlockFn: () => !window.confirm('Încărcarea fotografiei de profil este în curs. Părăsești pagina și anulezi încărcarea?'),
    enableBeforeUnload: uploading,
    disabled: !uploading,
  })

  // Leaving the page or closing the form cancels an upload still in flight.
  useEffect(() => () => uploadAbort.current?.abort(), [])

  function current() {
    return revision === useSession.getState().revision
  }

  // A 403 means administrator access lapsed; a 404 means the account is gone.
  function afterFailure(error: unknown) {
    void handleAdminError(error, revision)
    if (error instanceof ApiError && error.status === 404) refreshAdminAccess(revision)
  }

  async function startUpload(file: File) {
    const early = avatarFileError(file)
    if (early) {
      setUpload({ file, phase: 'failed', error: early, retryable: false })
      return
    }
    const controller = new AbortController()
    uploadAbort.current = controller
    setUpload({ file, phase: 'sending', sent: 0 })
    let saved = false
    try {
      const updated = await api.uploadAvatar(user.id, file, {
        signal: controller.signal,
        onProgress: (sent) => setUpload((upload) => upload?.file === file && upload.phase === 'sending' ? { ...upload, sent } : upload),
        onSent: () => setUpload((upload) => upload?.file === file && upload.phase === 'sending' ? { file, phase: 'saving', sent: file.size } : upload),
      })
      saved = true
      if (!current()) return
      await replaceCachedUser(revision, updated)
      if (!current()) return
      setUpload(null)
      notify({ variant: 'success', message: isSelf ? 'Fotografia ta de profil a fost actualizată.' : `Fotografia de profil ${owner} a fost actualizată.` })
    } catch (error) {
      if (!current()) return
      if (controller.signal.aborted) {
        setUpload(null)
        if (controller.signal.reason === 'user') notify({ variant: 'info', message: `Încărcarea fișierului ${file.name} a fost anulată.` })
      } else {
        setUpload({ file, phase: 'failed', error: errorMessage(error), retryable: isRetryableUpload(error) })
        afterFailure(error)
      }
    } finally {
      if (uploadAbort.current === controller) uploadAbort.current = null
      // A cancelled or failed request may still have been saved before its response was lost.
      if (!saved && current()) {
        void queryClient.invalidateQueries({ queryKey: ['me', revision], exact: true })
        refreshAdminAccess(revision)
      }
    }
  }

  async function handleRemove() {
    if (busy || !window.confirm(isSelf ? 'Elimini fotografia ta de profil?' : `Elimini fotografia de profil ${owner}?`)) return
    setUpload(null)
    setRemoving(true)
    try {
      await api.deleteAvatar(user.id)
      if (!current()) return
      await replaceCachedUser(revision, { ...user, avatar: null })
      if (!current()) return
      notify({ variant: 'success', message: isSelf ? 'Fotografia ta de profil a fost eliminată.' : `Fotografia de profil ${owner} a fost eliminată.` })
      // The Remove button goes away with the picture, so focus moves to the upload button.
      requestAnimationFrame(() => uploadButton.current?.focus())
    } catch (error) {
      if (!current()) return
      notify({ variant: 'error', message: `Fotografia nu a putut fi eliminată. ${errorMessage(error)}` })
      afterFailure(error)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="avatar-editor">
      <div className="avatar-editor-row">
        <Avatar user={user} size={96}
          label={user.avatar ? isSelf ? 'Fotografia ta de profil' : `Fotografia de profil ${owner}` : isSelf ? 'Nu ai o fotografie de profil' : `${user.email} nu are o fotografie de profil`} />
        <div className="avatar-editor-controls">
          <div className="avatar-editor-actions">
            <button ref={uploadButton} className={primary ? 'primary-button' : undefined} type="button" disabled={busy}
              aria-describedby={uploading ? `${id}-upload` : `${id}-hint`} onClick={() => picker.current?.click()}>
              {user.avatar ? 'Schimbă fotografia' : 'Încarcă o fotografie'}
            </button>
            <input ref={picker} type="file" accept={avatarTypes.join(',')} hidden tabIndex={-1}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file) void startUpload(file)
              }} />
            {user.avatar && (
              <button className="text-button danger" type="button" disabled={busy} onClick={() => void handleRemove()}>
                {removing ? 'Se elimină…' : 'Elimină fotografia'}
              </button>
            )}
          </div>
          <p className="field-hint" id={`${id}-hint`}>JPEG, PNG sau WebP de cel mult {avatarMaxLabel}. Fotografia este decupată într-un pătrat centrat.</p>
        </div>
      </div>
      {upload && (
        <UploadProgress id={`${id}-upload`} upload={upload}
          onCancel={() => uploadAbort.current?.abort('user')}
          onRetry={() => void startUpload(upload.file)}
          onDismiss={() => setUpload(null)} />
      )}
    </div>
  )
}
