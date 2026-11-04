import { useId, useState } from 'react'
import type { Coordinate } from '../route'
import { isCoordinate } from '../route'

interface StopFormProps {
  coordinates?: Coordinate
  disabled: boolean
  onSubmit: (point: Coordinate) => void
  onCancel?: () => void
}

export default function StopForm({ coordinates, disabled, onSubmit, onCancel }: StopFormProps) {
  const id = useId()
  const [latitude, setLatitude] = useState(coordinates?.[1].toString() ?? '')
  const [longitude, setLongitude] = useState(coordinates?.[0].toString() ?? '')
  const [error, setError] = useState('')

  return (
    <form className="stop-form" onSubmit={(event) => {
      event.preventDefault()
      if (disabled) return
      const point: Coordinate = [Number(longitude), Number(latitude)]
      if (!latitude.trim() || !longitude.trim() || !isCoordinate(point)) {
        setError('Enter a latitude between −85.051129 and 85.051129 and a longitude between −180 and 180.')
        return
      }
      setError('')
      onSubmit(point)
      if (!coordinates) {
        setLatitude('')
        setLongitude('')
      }
    }}>
      <div className="stop-coordinate-fields">
        <div className="form-field">
          <label htmlFor={`${id}-latitude`}>Latitude</label>
          <input id={`${id}-latitude`} type="number" inputMode="decimal" min="-85.051129" max="85.051129" step="any"
            placeholder="44.4268" required value={latitude} disabled={disabled}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => setLatitude(event.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-longitude`}>Longitude</label>
          <input id={`${id}-longitude`} type="number" inputMode="decimal" min="-180" max="180" step="any"
            placeholder="26.1025" required value={longitude} disabled={disabled}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => setLongitude(event.target.value)} />
        </div>
      </div>
      {error && <p className="field-error" id={`${id}-error`} role="alert">{error}</p>}
      <div className="stop-form-actions">
        <button type="submit" disabled={disabled}>{coordinates ? 'Apply coordinates' : 'Add stop'}</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
