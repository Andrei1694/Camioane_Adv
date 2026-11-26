import { useId, useState } from 'react'
import { clippedEdges, defaultPlacement, fitScale, formatScale } from '../placement'
import type { Placement, Size } from '../placement'

function NumericField({ label, value, min, max, integer = false, onApply }: {
  label: string, value: number, min: number, max: number, integer?: boolean, onApply: (value: number) => void
}) {
  const id = useId()
  const [text, setText] = useState(String(Number(value.toFixed(6))))
  const [previous, setPrevious] = useState(value)
  const [error, setError] = useState('')
  if (previous !== value) {
    setPrevious(value)
    setText(String(Number(value.toFixed(6))))
    setError('')
  }
  function apply() {
    const next = text.trim() ? Number(text.replace(',', '.')) : NaN
    if (!Number.isFinite(next) || next < min || next > max || integer && !Number.isInteger(next)) {
      setError(`Introdu ${integer ? 'un număr întreg' : 'un număr'} între ${min} și ${max}.`)
      return
    }
    setError('')
    onApply(next)
  }
  return <div className="form-field">
    <label htmlFor={id}>{label}</label>
    <div className="display-number-input">
      <input id={id} type="number" min={min} max={max} step={integer ? 1 : 'any'} value={text}
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => setText(event.currentTarget.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); apply() } }} />
      <button type="button" onClick={apply} aria-label={`Aplică ${label}`}>Aplică</button>
    </div>
    {error && <p className="field-error" id={`${id}-error`} role="alert">{error}</p>}
  </div>
}

const steps = [-64, -8, -1, 1, 8, 64]

export default function PlacementPanel({ placement, frame, video, pattern, open, error, onChange, onPattern }: {
  placement: Placement, frame: Size | null, video: Size | null, pattern: boolean, open: boolean, error: string
  onChange: (placement: Placement) => void, onPattern: (enabled: boolean) => void
}) {
  const id = useId()
  const widthScale = fitScale(frame, video, 'width')
  const heightScale = fitScale(frame, video, 'height')
  const clipped = clippedEdges(frame, video, placement)
  const truckModeTooSmall = video?.width === 2304 && video.height === 512 && frame && (frame.width < 2304 || frame.height < 512)
  return <section className="display-panel" aria-labelledby={`${id}-title`}>
    <div className="display-section-heading"><h2 id={`${id}-title`}>Poziționare HDMI</h2><span className="num">{formatScale(placement.scale)}</span></div>
    <div className="display-dimensions">
      <p>Cadru: <span className="num">{frame ? `${frame.width} × ${frame.height} px` : 'Fereastră închisă'}</span></p>
      <p>Video: <span className="num">{video ? `${video.width} × ${video.height} px` : 'Se așteaptă dimensiunea'}</span></p>
    </div>
    <p className="display-note">Salvată în acest browser pentru test și playlist. La 100%, un pixel video ocupă un pixel al cadrului. Marginile din afara cadrului sunt tăiate.</p>
    <div className="display-placement-fields">
      {(['x', 'y'] as const).map((axis) => <div className="display-offset" key={axis}>
        <NumericField label={`${axis.toUpperCase()} (px)`} value={placement[axis]} min={-4096} max={4096} integer
          onApply={(value) => onChange({ ...placement, [axis]: value })} />
        <div className="display-steps">
          {steps.map((step) => <button key={step} type="button" className="ghost-button"
            aria-label={`${axis.toUpperCase()} ${step > 0 ? 'plus' : 'minus'} ${Math.abs(step)} pixeli`}
            disabled={placement[axis] + step < -4096 || placement[axis] + step > 4096}
            onClick={() => onChange({ ...placement, [axis]: placement[axis] + step })}>{step > 0 ? '+' : '−'}{Math.abs(step)}</button>)}
        </div>
      </div>)}
      <NumericField label="Scară (%)" value={placement.scale * 100} min={10} max={400}
        onApply={(value) => onChange({ ...placement, scale: value / 100 })} />
    </div>
    <div className="display-actions">
      <button type="button" onClick={() => onChange({ ...placement, scale: 1 })}>100%</button>
      <button type="button" disabled={widthScale === null} onClick={() => { if (widthScale !== null) onChange({ ...placement, scale: widthScale }) }}>Potrivește lățimea</button>
      <button type="button" disabled={heightScale === null} onClick={() => { if (heightScale !== null) onChange({ ...placement, scale: heightScale }) }}>Potrivește înălțimea</button>
      <button type="button" onClick={() => onChange({ ...defaultPlacement })}>Resetează la 1:1 în 0,0</button>
    </div>
    <p className="display-note">Scară permisă: 10–400%. Potrivirea folosește dimensiunile cadrului și ale videoclipului și păstrează X/Y.</p>
    <label className="display-toggle"><input type="checkbox" checked={pattern} disabled={!open} onChange={(event) => onPattern(event.currentTarget.checked)} /> Grilă de calibrare</label>
    <p className="display-note">Grila înlocuiește imaginea cu coordonate fixe ale cadrului. Citește coordonatele din colțurile panourilor, apoi dezactiveaz-o pentru a verifica poziționarea. Oprește șterge și grila.</p>
    {!!clipped.length && <p className="display-warning" role="status">{clipped.map((edge) => `${edge.pixels} px tăiați ${edge.edge}`).join(' / ')}. {truckModeTooSmall
      ? 'Este necesar un cadru HDMI de cel puțin 2304 × 512 px pentru întregul canvas al camionului la 1:1.'
      : 'Ajustează X/Y sau scara pentru a aduce videoclipul în cadru.'}</p>}
    {error && <p className="request-error" role="alert">{error}</p>}
  </section>
}
