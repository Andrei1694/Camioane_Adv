import { useEffect, useId, useRef } from 'react'
import type { Car } from '../../../lib/car'

export default function DeleteCarDialog({ car, pending, error, missing, onCancel, onDelete }: {
  car: Car, onCancel: () => void, onDelete: () => void,
  pending: boolean, error: string, missing: boolean,
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
    cancel.current?.focus()
  }, [])

  return (
    <dialog ref={dialog} className="dialog car-delete-dialog" aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`} aria-busy={pending} onClose={onCancel}
      onCancel={(event) => { if (pending) event.preventDefault() }}
      onClick={(event) => {
        if (pending || event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close()
      }}>
      <div className="dialog-head"><h2 id={`${id}-title`}>Ștergi mașina {car.plate}?</h2></div>
      <p className="dialog-sub" id={`${id}-description`}>
        Mașina va fi ștearsă definitiv din inventarul comun al flotei.
      </p>
      {error && <p className="request-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button ref={cancel} type="button" disabled={pending} onClick={() => dialog.current?.close()}>{missing ? 'Închide' : 'Anulează'}</button>
        <button className="danger" type="button" disabled={pending || missing} onClick={onDelete}>{pending ? 'Se șterge…' : 'Șterge mașina'}</button>
      </div>
    </dialog>
  )
}
