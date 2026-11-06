export type Render =
  | { phase: 'rendering', progress: number }
  | { phase: 'failed', error: string }

/** The render step of an export, in the upload box's frame; the upload step follows in UploadProgress. */
export default function RenderProgress({ id, name, render, onCancel, onRetry, onDismiss }: {
  id: string
  name: string
  render: Render
  onCancel: () => void
  onRetry: () => void
  onDismiss: () => void
}) {
  if (render.phase === 'failed') return (
    <div className="upload-block" id={id} role="alert">
      <p className="request-error">Nu s-a putut exporta {name}. {render.error}</p>
      <div className="upload-actions">
        <button type="button" className="ghost-button" onClick={onRetry}>Reîncearcă<span className="sr-only"> exportul fișierului {name}</span></button>
        <button type="button" className="text-button" onClick={onDismiss}>Închide</button>
      </div>
    </div>
  )

  const percent = Math.floor(render.progress * 100)
  return (
    <div className="upload-block" id={id}>
      <div className="upload-head">
        <p className="upload-title">Se procesează {name}</p>
        <button type="button" className="text-button" onClick={onCancel}>Anulează<span className="sr-only"> exportul fișierului {name}</span></button>
      </div>
      <div className="upload-track" role="progressbar" aria-label={`Se procesează ${name}`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}% procesat`}>
        <div className="upload-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="upload-figure num">{percent}%<span className="unit"> procesat · Urmează încărcarea în Fișiere</span></p>
    </div>
  )
}
