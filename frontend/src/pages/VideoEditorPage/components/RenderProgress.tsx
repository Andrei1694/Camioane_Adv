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
      <p className="request-error">Couldn't export {name}. {render.error}</p>
      <div className="upload-actions">
        <button type="button" className="ghost-button" onClick={onRetry}>Retry<span className="sr-only"> export of {name}</span></button>
        <button type="button" className="text-button" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  )

  const percent = Math.floor(render.progress * 100)
  return (
    <div className="upload-block" id={id}>
      <div className="upload-head">
        <p className="upload-title">Rendering {name}</p>
        <button type="button" className="text-button" onClick={onCancel}>Cancel<span className="sr-only"> export of {name}</span></button>
      </div>
      <div className="upload-track" role="progressbar" aria-label={`Rendering ${name}`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}% rendered`}>
        <div className="upload-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="upload-figure num">{percent}%<span className="unit"> rendered · Uploads to Files next</span></p>
    </div>
  )
}
