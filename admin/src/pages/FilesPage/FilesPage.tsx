import { useEffect, useId, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker } from '@tanstack/react-router'
import { useSession } from '../../auth/session'
import { api, ApiError, errorMessage, isRetryableUpload } from '../../lib/api'
import { useNotify } from '../../lib/useNotify'
import { acceptedFileTypes, declaredTypeError } from '../../lib/file'
import type { StoredFile } from '../../lib/file'
import { formatByteSize } from '../../lib/format'
import FilePreviewDialog from './components/FilePreviewDialog'
import FilesTable from './components/FilesTable'
import type { FilesView } from './components/FilesTable'
import UploadProgress from '../../components/UploadProgress'
import type { Upload } from '../../components/UploadProgress'
import { saveBlob } from './saveFile'
import './FilesPage.css'

// The API's default page size; it allows 1–100.
const pageSize = 50

export default function FilesPage() {
  const revision = useSession((state) => state.revision)
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const notify = useNotify()
  const [upload, setUpload] = useState<Upload | null>(null)
  const [downloading, setDownloading] = useState<ReadonlySet<string>>(new Set())
  const [preview, setPreview] = useState<StoredFile | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const uploadButton = useRef<HTMLButtonElement>(null)
  const uploadAbort = useRef<AbortController | null>(null)
  const uploadId = useId()

  const page = useQuery({
    queryKey: ['files', revision, offset],
    queryFn: ({ signal }) => api.files({ limit: pageSize, offset }, signal),
    placeholderData: keepPreviousData,
  })
  const remove = useMutation({ mutationFn: api.deleteFile })
  const uploading = upload !== null && upload.phase !== 'failed'

  useBlocker({
    shouldBlockFn: () => !window.confirm('Încărcarea este în curs. Părăsești pagina și o anulezi?'),
    enableBeforeUnload: uploading,
    disabled: !uploading,
  })

  // Leaving the page cancels an upload still in flight.
  useEffect(() => () => uploadAbort.current?.abort(), [])

  function refreshFiles() {
    void queryClient.invalidateQueries({ queryKey: ['files', revision] })
  }

  async function startUpload(file: File) {
    const early = declaredTypeError(file)
    if (early) {
      setUpload({ file, phase: 'failed', error: early, retryable: false })
      return
    }
    const controller = new AbortController()
    uploadAbort.current = controller
    setUpload({ file, phase: 'sending', sent: 0 })
    try {
      const stored = await api.uploadFile(file, {
        signal: controller.signal,
        onProgress: (sent) => setUpload((current) => current?.file === file && current.phase === 'sending' ? { ...current, sent } : current),
        onSent: () => setUpload((current) => current?.file === file && current.phase === 'sending' ? { file, phase: 'saving', sent: file.size } : current),
      })
      if (revision !== useSession.getState().revision) return
      setUpload(null)
      notify({ variant: 'success', message: `Încărcat ${stored.originalName} (${formatByteSize(stored.size)}).` })
      setOffset(0)
    } catch (error) {
      if (revision !== useSession.getState().revision) return
      if (controller.signal.aborted) {
        setUpload(null)
        if (controller.signal.reason === 'user') notify({ variant: 'info', message: `Încărcarea fișierului ${file.name} a fost anulată.` })
      } else {
        setUpload({ file, phase: 'failed', error: errorMessage(error), retryable: isRetryableUpload(error) })
      }
    } finally {
      if (uploadAbort.current === controller) uploadAbort.current = null
      // A cancelled or failed request may still have been stored before its response was lost.
      refreshFiles()
    }
  }

  async function handleDownload(file: StoredFile) {
    setDownloading((ids) => new Set(ids).add(file.id))
    try {
      const blob = await api.downloadFile(file)
      if (revision !== useSession.getState().revision) return
      saveBlob(blob, file.originalName)
    } catch (error) {
      if (revision !== useSession.getState().revision) return
      notify({ variant: 'error', message: `Nu s-a putut descărca ${file.originalName}. ${errorMessage(error)}` })
      if (error instanceof ApiError && error.status === 404) refreshFiles()
    } finally {
      setDownloading((ids) => {
        const next = new Set(ids)
        next.delete(file.id)
        return next
      })
    }
  }

  async function handleDelete(file: StoredFile) {
    if (remove.isPending || !window.confirm(`Ștergi fișierul ${file.originalName}? Fișierul va fi șters definitiv, iar acțiunea nu poate fi anulată.`)) return
    try {
      await remove.mutateAsync(file.id)
      if (revision !== useSession.getState().revision) return
      // Deleting the last row of a later page steps back to the page before it.
      if (page.data?.files.length === 1 && offset > 0) setOffset(Math.max(0, offset - pageSize))
      notify({ variant: 'success', message: `S-a șters ${file.originalName}.` })
      requestAnimationFrame(() => uploadButton.current?.focus())
    } catch (error) {
      if (revision !== useSession.getState().revision) return
      notify({ variant: 'error', message: `Nu s-a putut șterge ${file.originalName}. ${errorMessage(error)}` })
    } finally {
      remove.reset()
      refreshFiles()
    }
  }

  const view: FilesView = page.data
    ? { status: 'ready', files: page.data.files, total: page.data.total, refreshing: page.isFetching }
    : page.isError ? { status: 'error', error: errorMessage(page.error), retrying: page.isFetching }
    : { status: 'loading' }

  return (
    <section className="files-page">
      <header>
        <div className="page-heading">
          <h1>Fișiere</h1>
          <button ref={uploadButton} className="primary-button" type="button" disabled={uploading}
            aria-describedby={uploading ? uploadId : undefined} onClick={() => picker.current?.click()}>
            Încarcă un fișier
          </button>
          <input ref={picker} type="file" accept={acceptedFileTypes.join(',')} hidden tabIndex={-1}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) void startUpload(file)
            }} />
        </div>
        <p className="page-description">Toate imaginile și videoclipurile încărcate în Camioane App, începând cu cele mai recente. Încarcă JPEG, PNG, WebP sau MP4.</p>
      </header>
      {upload && (
        <UploadProgress id={uploadId} upload={upload}
          onCancel={() => uploadAbort.current?.abort('user')}
          onRetry={() => void startUpload(upload.file)}
          onDismiss={() => setUpload(null)} />
      )}
      <FilesTable view={view} offset={offset} pageSize={pageSize} downloading={downloading}
        deleting={remove.isPending ? remove.variables : undefined}
        onRetry={() => void page.refetch()} onPage={setOffset} onPreview={setPreview}
        onDownload={(file) => void handleDownload(file)} onDelete={(file) => void handleDelete(file)} />
      {preview && <FilePreviewDialog key={preview.id} file={preview} onClose={() => setPreview(null)} />}
    </section>
  )
}
