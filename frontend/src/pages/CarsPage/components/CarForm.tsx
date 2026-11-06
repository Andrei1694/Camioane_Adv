import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { carRoutes, carStatuses, isCarRouteId, isCarStatus, maxCarPlateLength, maxCarTextLength, normalizeCar } from '../../../lib/car'
import type { Car, CarInput } from '../../../lib/car'
import { carErrors, carStatusLabels } from '../car'
import type { CarErrors } from '../car'

export default function CarForm({ car, cars, pending, reloading, error, missing, canReload, onReload, onSave, onCancel }: {
  car?: Car, cars: readonly Car[], onSave: (input: CarInput) => void, onCancel: () => void,
  pending: boolean, reloading: boolean, error: string, missing: boolean, canReload: boolean, onReload: () => void,
}) {
  const [input, setInput] = useState<CarInput>(() => ({
    plate: car?.plate ?? '', makeModel: car?.makeModel ?? '', driverName: car?.driverName ?? '',
    routeId: car?.routeId ?? null, status: car?.status ?? 'active',
  }))
  const [errors, setErrors] = useState<CarErrors>({})
  const plateInput = useRef<HTMLInputElement>(null)
  const modelInput = useRef<HTMLInputElement>(null)
  const driverInput = useRef<HTMLInputElement>(null)
  const failure = useRef<HTMLParagraphElement>(null)
  const id = useId()
  const busy = pending || reloading

  useEffect(() => { plateInput.current?.focus() }, [])
  useEffect(() => { if (error) failure.current?.focus() }, [error])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || missing) return
    const normalized = normalizeCar(input)
    const nextErrors = carErrors(normalized, cars, car?.id)
    setErrors(nextErrors)
    if (nextErrors.plate) plateInput.current?.focus()
    else if (nextErrors.makeModel) modelInput.current?.focus()
    else if (nextErrors.driverName) driverInput.current?.focus()
    else onSave(normalized)
  }

  return (
    <form className="user-form car-form" aria-labelledby={`${id}-title`} aria-busy={busy} onSubmit={submit} noValidate>
      <h2 id={`${id}-title`}>{car ? 'Editează mașina' : 'Adaugă o mașină'}</h2>
      {error && <p ref={failure} className="request-error" role="alert" tabIndex={-1}>{error}</p>}
      <div className="form-fields">
        <div className="form-field">
          <label htmlFor={`${id}-plate`}>Număr de înmatriculare</label>
          <input ref={plateInput} id={`${id}-plate`} name="plate" required autoComplete="off" spellCheck={false} disabled={busy} maxLength={maxCarPlateLength}
            autoCapitalize="characters" value={input.plate} aria-invalid={Boolean(errors.plate)}
            aria-describedby={errors.plate ? `${id}-plate-error` : undefined}
            onChange={(event) => {
              setInput({ ...input, plate: event.target.value })
              setErrors({ ...errors, plate: undefined })
            }} />
          {errors.plate && <p className="field-error" id={`${id}-plate-error`} role="alert">{errors.plate}</p>}
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-model`}>Marcă/model</label>
          <input ref={modelInput} id={`${id}-model`} name="makeModel" required value={input.makeModel} disabled={busy} maxLength={maxCarTextLength}
            aria-invalid={Boolean(errors.makeModel)} aria-describedby={errors.makeModel ? `${id}-model-error` : undefined}
            onChange={(event) => {
              setInput({ ...input, makeModel: event.target.value })
              setErrors({ ...errors, makeModel: undefined })
            }} />
          {errors.makeModel && <p className="field-error" id={`${id}-model-error`} role="alert">{errors.makeModel}</p>}
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-driver`}>Numele șoferului<span className="optional-label"> (opțional)</span></label>
          <input ref={driverInput} id={`${id}-driver`} name="driverName" autoComplete="off" value={input.driverName} disabled={busy} maxLength={maxCarTextLength}
            aria-invalid={Boolean(errors.driverName)} aria-describedby={errors.driverName ? `${id}-driver-error` : undefined}
            onChange={(event) => {
              setInput({ ...input, driverName: event.target.value })
              setErrors({ ...errors, driverName: undefined })
            }} />
          {errors.driverName && <p className="field-error" id={`${id}-driver-error`} role="alert">{errors.driverName}</p>}
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-route`}>Traseu<span className="optional-label"> (opțional)</span></label>
          <select id={`${id}-route`} name="routeId" value={input.routeId ?? ''} disabled={busy}
            onChange={(event) => {
              const value = event.target.value
              setInput({ ...input, routeId: isCarRouteId(value) ? value : null })
            }}>
            <option value="">Neatribuit</option>
            {carRoutes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-status`}>Stare</label>
          <select id={`${id}-status`} name="status" value={input.status} aria-describedby={`${id}-status-hint`} disabled={busy}
            onChange={(event) => {
              const value = event.target.value
              if (isCarStatus(value)) setInput({ ...input, status: value })
            }}>
            {carStatuses.map((status) => <option key={status} value={status}>{carStatusLabels[status]}</option>)}
          </select>
          <p className="field-hint" id={`${id}-status-hint`}>Stare administrativă, nu conectivitate în timp real.</p>
        </div>
      </div>
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={busy || missing}>{pending ? 'Se salvează…' : car ? 'Salvează modificările' : 'Salvează mașina'}</button>
        {canReload && !missing && <button type="button" disabled={busy} onClick={onReload}>{reloading ? 'Se reîncarcă…' : 'Reîncarcă mașina'}</button>}
        <button type="button" disabled={busy} onClick={onCancel}>{missing ? 'Închide' : 'Anulează'}</button>
      </div>
      {canReload && !missing && <p className="field-hint">Reîncărcarea mașinii înlocuiește valorile introduse cu ultimele date salvate.</p>}
    </form>
  )
}
