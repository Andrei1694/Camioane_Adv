import { useEffect, useId, useRef } from 'react'
import './DeleteConfirmationDialog.css'

export default function DeleteConfirmationDialog({ title, description, deleteLabel, pending, error, missing, onCancel, onDelete }: {
  title: string, description: string, deleteLabel: string,
  pending: boolean, error: string, missing: boolean, onCancel: () => void, onDelete: () => void,
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
    cancel.current?.focus()
  }, [])

  return (
    <dialog ref={dialog} className="dialog delete-confirmation-dialog" aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`} aria-busy={pending} onClose={onCancel}
      onCancel={(event) => { if (pending) event.preventDefault() }}
      onClick={(event) => {
        if (pending || event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close()
      }}>
      <div className="dialog-head"><h2 id={`${id}-title`}>{title}</h2></div>
      <p className="dialog-sub" id={`${id}-description`}>{description}</p>
      {error && <p className="request-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button ref={cancel} type="button" disabled={pending} onClick={() => dialog.current?.close()}>{missing ? 'Închide' : 'Anulează'}</button>
        <button className="danger" type="button" disabled={pending || missing} onClick={onDelete}>{pending ? 'Se șterge…' : deleteLabel}</button>
      </div>
    </dialog>
  )
}
