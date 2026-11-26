import { useId, useState } from 'react'
import type { useOutputWindow } from '../useOutputWindow'

export default function OutputPanel({ output }: { output: ReturnType<typeof useOutputWindow> }) {
  const id = useId()
  const [selected, setSelected] = useState('')
  const chosen = output.screens.find((screen) => `${screen.left}/${screen.top}` === selected)
  return <section className="display-panel" aria-labelledby={`${id}-title`}>
    <div className="display-section-heading">
      <h2 id={`${id}-title`}>Ecran extern</h2>
      <span className={`pill ${output.output ? 'pill-positive' : 'pill-neutral'}`}>{output.output ? 'Fereastră deschisă' : 'Fereastră închisă'}</span>
    </div>
    {output.supportsScreens && <div className="display-screen-picker">
      <div className="form-field">
        <label htmlFor={`${id}-screen`}>Ecran de redare</label>
        <select id={`${id}-screen`} value={chosen ? selected : ''} onChange={(event) => setSelected(event.currentTarget.value)} disabled={!!output.output}>
          <option value="">Mută manual fereastra</option>
          {output.screens.map((screen, index) => <option key={`${screen.left}/${screen.top}`} value={`${screen.left}/${screen.top}`}>
            {screen.label || `Ecran ${index + 1}`} · {Math.round(screen.width * screen.devicePixelRatio)} × {Math.round(screen.height * screen.devicePixelRatio)} px{screen.isPrimary ? ' · Principal' : ''}{screen.isInternal ? ' · Integrat' : ''}
          </option>)}
        </select>
      </div>
      <button type="button" disabled={output.discovering || !!output.output} onClick={() => void output.discoverScreens()}>
        {output.discovering ? 'Se caută ecranele…' : 'Detectează ecranele'}
      </button>
    </div>}
    <div className="display-actions">
      <button type="button" disabled={!!output.output} onClick={() => output.open(chosen)}>Deschide fereastra de redare</button>
      <button type="button" disabled={!output.output} onClick={output.close}>Închide fereastra</button>
    </div>
    <p className="display-note" role="status">{output.output && output.frame
      ? `${output.frame.fullscreen ? 'Ecran complet' : 'În fereastră'} · Cadru: ${output.frame.width} × ${output.frame.height} px`
      : 'Deschide fereastra, mut-o pe ecranul conectat și apasă „Ecran complet” în ea.'}</p>
    {output.error && <p className="request-error" role="alert">{output.error}</p>}
    {output.screenError && <p className="display-warning" role="alert">{output.screenError}</p>}
    <p className="display-note">Folosește ecranul conectat ca monitor extins. Browserul nu poate citi modurile HDMI oferite; rezoluția este aleasă în setările sistemului de operare.</p>
  </section>
}
