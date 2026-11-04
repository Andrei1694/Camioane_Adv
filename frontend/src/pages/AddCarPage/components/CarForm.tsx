import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import type { User } from '../../../lib/user'
import { getModelError, getPlateError, normalizeModel, normalizePlate } from '../car'
import type { Car } from '../car'

interface CarFormProps {
  /** Cars already added, for the duplicate-plate check. */
  cars: readonly Car[]
  drivers: readonly User[]
  labelledBy: string
  onAdd: (car: Car) => void
}

interface FormErrors {
  plate?: string
  model?: string
}

export default function CarForm({ cars, drivers, labelledBy, onAdd }: CarFormProps) {
  const [plate, setPlate] = useState('')
  const [model, setModel] = useState('')
  const [driverId, setDriverId] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const plateInput = useRef<HTMLInputElement>(null)
  const modelInput = useRef<HTMLInputElement>(null)
  const id = useId()
  // A driver who loses the role or the account after being picked falls back to "No driver".
  const driver = drivers.find((user) => user.id === driverId)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const car: Car = { plate: normalizePlate(plate), model: normalizeModel(model), driverId: driver?.id ?? null }
    const nextErrors: FormErrors = { plate: getPlateError(car.plate, cars), model: getModelError(car.model) }
    setErrors(nextErrors)

    if (nextErrors.plate) {
      plateInput.current?.focus()
      return
    }

    if (nextErrors.model) {
      modelInput.current?.focus()
      return
    }

    onAdd(car)
    setPlate('')
    setModel('')
    setDriverId('')
    plateInput.current?.focus()
  }

  return (
    <form className="car-form" aria-labelledby={labelledBy} onSubmit={handleSubmit} noValidate>
      <div className="form-fields">
        <div className="form-field">
          <label htmlFor={`${id}-plate`}>Plate</label>
          <input
            ref={plateInput}
            id={`${id}-plate`}
            className="plate-input"
            name="plate"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            value={plate}
            aria-invalid={Boolean(errors.plate)}
            aria-describedby={errors.plate ? `${id}-plate-error` : `${id}-plate-hint`}
            onChange={(event) => {
              setPlate(event.target.value)
              setErrors((current) => ({ ...current, plate: undefined }))
            }}
          />
          {errors.plate
            ? <p className="field-error" id={`${id}-plate-error`} role="alert">{errors.plate}</p>
            : <p className="field-hint" id={`${id}-plate-hint`}>As on the number plate, for example B 101 CMN.</p>}
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-model`}>Make and model<span className="optional-label"> (optional)</span></label>
          <input
            ref={modelInput}
            id={`${id}-model`}
            name="model"
            type="text"
            autoComplete="off"
            value={model}
            aria-invalid={Boolean(errors.model)}
            aria-describedby={errors.model ? `${id}-model-error` : undefined}
            onChange={(event) => {
              setModel(event.target.value)
              setErrors((current) => ({ ...current, model: undefined }))
            }}
          />
          {errors.model && <p className="field-error" id={`${id}-model-error`} role="alert">{errors.model}</p>}
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-driver`}>Driver<span className="optional-label"> (optional)</span></label>
          <select id={`${id}-driver`} name="driver" value={driver?.id ?? ''} disabled={drivers.length === 0}
            aria-describedby={`${id}-driver-hint`}
            onChange={(event) => setDriverId(event.target.value)}>
            <option value="">No driver</option>
            {drivers.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
          </select>
          <p className="field-hint" id={`${id}-driver-hint`}>
            {drivers.length > 0 ? 'Accounts with the Driver role.'
              : <>No account has the Driver role yet. Give one that role on the <Link to="/users">Users</Link> page.</>}
          </p>
        </div>
      </div>
      <div className="form-actions">
        <button className="primary-button" type="submit">Add car</button>
      </div>
    </form>
  )
}
