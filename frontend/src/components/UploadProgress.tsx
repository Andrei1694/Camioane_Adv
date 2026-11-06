import { byteSize, byteSizeIn } from '../lib/format'
import './UploadProgress.css'

export type Upload =
  | { file: File, phase: 'sending' | 'saving', sent: number }
  | { file: File, phase: 'failed', error: string, retryable: boolean }

export default function UploadProgress({ id, upload, onCancel, onRetry, onDismiss }: {
  id: string
  upload: Upload
  onCancel: () => void
  onRetry: () => void
  onDismiss: () => void
}) {
  const name = upload.file.name

  if (upload.phase === 'failed') return (
    <div className="upload-block" id={id} role="alert">
      <p className="request-error">Nu s-a putut încărca {name}. {upload.error}</p>
      <div className="upload-actions">
        {upload.retryable && <button type="button" className="ghost-button" onClick={onRetry}>Reîncearcă<span className="sr-only"> încărcarea fișierului {name}</span></button>}
        <button type="button" className="text-button" onClick={onDismiss}>Închide</button>
      </div>
    </div>
  )

  // The bar and the figure both measure the file's own bytes, in the unit of its size.
  const total = byteSize(upload.file.size)
  const percent = upload.file.size === 0 ? 100 : Math.floor((upload.sent / upload.file.size) * 100)
  const sent = byteSizeIn(upload.sent, total.unit)
  const figure = `${sent} din ${total.value} ${total.unit}`
  const saving = upload.phase === 'saving'

  return (
    <div className="upload-block" id={id}>
      <div className="upload-head">
        <p className="upload-title">Se încarcă {name}</p>
        <button type="button" className="text-button" onClick={onCancel}>Anulează<span className="sr-only"> încărcarea fișierului {name}</span></button>
      </div>
      <div className="upload-track" role="progressbar" aria-label={`Se încarcă ${name}`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
        aria-valuetext={saving ? `${figure} trimiși, se verifică și se salvează` : `${figure}, ${percent}%`}>
        <div className="upload-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="upload-figure num">
        {sent}<span className="unit"> din {total.value} {total.unit} · {saving ? 'Se verifică și se salvează…' : `${percent}%`}</span>
      </p>
    </div>
  )
}
