import { useId } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { ScreenLayout } from '../../../lib/screenPreset'
import { regionIds, regionLabels } from '../screenLayout'

const dimensions = [['width', 'Lățime'], ['height', 'Înălțime']] as const
const coordinates = [['x', 'X'], ['y', 'Y'], ...dimensions] as const
const inputValue = (value: number) => Number.isFinite(value) ? value : ''

export default function LayoutFields({ layout, onChange, disabled, error, errorId }: {
  layout: ScreenLayout
  onChange: Dispatch<SetStateAction<ScreenLayout>>
  disabled: boolean
  error: string
  errorId: string
}) {
  const ids = useId()
  return <section className="screen-geometry" aria-labelledby={`${ids}-title`}>
    <h2 id={`${ids}-title`}>Geometria ecranului</h2>
    <fieldset className="screen-canvas-fields" disabled={disabled} aria-describedby={error ? errorId : `${ids}-hint`}>
      <legend>Pânză</legend>
      <div className="screen-number-fields">
        {dimensions.map(([key, label]) => <div className="form-field" key={key}>
          <label htmlFor={`${ids}-canvas-${key}`}>{label} pânză (px)</label>
          <input id={`${ids}-canvas-${key}`} type="number" min={16} max={4096} step={2}
            value={inputValue(layout.canvas[key])} required aria-describedby={error ? errorId : `${ids}-hint`}
            aria-invalid={!Number.isSafeInteger(layout.canvas[key]) || layout.canvas[key] < 16
              || layout.canvas[key] > 4096 || layout.canvas[key] % 2 !== 0}
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber
              onChange((current) => ({ ...current, canvas: { ...current.canvas, [key]: value } }))
            }} />
        </div>)}
      </div>
      <p className="screen-note" id={`${ids}-hint`}>Dimensiuni pare între 16 și 4096 px. Regiunile trebuie să încapă în pânză; suprapunerile sunt permise.</p>
    </fieldset>
    <div className="screen-regions">
      {regionIds.map((id) => {
        const region = layout.regions[id]
        return <fieldset key={id} disabled={disabled} aria-describedby={error ? errorId : undefined}>
          <legend>{regionLabels[id]}</legend>
          <div className="screen-number-fields">
            {coordinates.map(([key, label]) => {
              const position = key === 'x' || key === 'y'
              const outside = key === 'x' || key === 'width'
                ? region.x + region.width > layout.canvas.width : region.y + region.height > layout.canvas.height
              const invalid = !Number.isSafeInteger(region[key]) || region[key] < (position ? 0 : 1)
                || region[key] > (position ? 4095 : 4096) || outside
              return <div className="form-field" key={key}>
                <label htmlFor={`${ids}-${id}-${key}`}>{label} (px)</label>
                <input id={`${ids}-${id}-${key}`} type="number" min={position ? 0 : 1}
                  max={position ? 4095 : 4096} step={1} required value={inputValue(region[key])}
                  aria-invalid={invalid} aria-describedby={error ? errorId : undefined}
                  onChange={(event) => {
                    const value = event.currentTarget.valueAsNumber
                    onChange((current) => ({ ...current, regions: { ...current.regions, [id]: { ...current.regions[id], [key]: value } } }))
                  }} />
              </div>
            })}
          </div>
          <label className="screen-fit"><input type="radio" name={`${ids}-${id}`} value="cover" checked={region.fit === 'cover'}
            onChange={() => onChange((current) => ({ ...current, regions: { ...current.regions, [id]: { ...current.regions[id], fit: 'cover' } } }))} />Decupează pentru umplere</label>
          <label className="screen-fit"><input type="radio" name={`${ids}-${id}`} value="contain" checked={region.fit === 'contain'}
            onChange={() => onChange((current) => ({ ...current, regions: { ...current.regions, [id]: { ...current.regions[id], fit: 'contain' } } }))} />Încadrează cu bandă neagră</label>
        </fieldset>
      })}
    </div>
    {error && <p className="field-error" id={errorId} role="alert">{error}</p>}
  </section>
}
