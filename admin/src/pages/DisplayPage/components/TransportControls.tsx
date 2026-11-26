import { useId } from 'react'
import type { PlaybackState, useDisplayPlayback } from '../useDisplayPlayback'

const labels: Record<PlaybackState, string> = {
  idle: 'Adaugă videoclipuri pentru a începe.', loading: 'Se pregătește redarea…', ready: 'Pregătit · Apasă Redă',
  playing: 'Redare pe ecran · În buclă · Fără sunet', buffering: 'Se încarcă…', paused: 'Pauză · Apasă Redă',
  stopped: 'Oprit · Ieșirea este neagră', error: 'Un videoclip nu poate fi redat.',
}

export default function TransportControls({ playback, playlist, open, busy }: {
  playback: ReturnType<typeof useDisplayPlayback>
  playlist: boolean
  open: boolean
  busy: boolean
}) {
  const id = useId()
  const disabled = !open || !playback.items.length || busy
  const current = playback.items[playback.index]
  return <section className="display-panel display-transport" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Redare</h2>
    <div className="display-actions">
      <button type="button" className="primary-button" disabled={disabled} aria-describedby={`${id}-status`}
        onClick={playback.active ? playback.pause : playback.play}>{playback.active ? 'Pauză' : 'Redă'}</button>
      <button type="button" disabled={!open} onClick={playback.stop}>Oprește</button>
      {playlist && <>
        <button type="button" disabled={disabled} onClick={playback.previous}>Anterior</button>
        <button type="button" disabled={disabled} onClick={playback.next}>Următor</button>
      </>}
    </div>
    <p id={`${id}-status`} role="status">{labels[playback.phase]}{!open ? ' · Deschide fereastra de redare.' : ''}</p>
    {playlist && current && <p className="display-current"><span className="num">{playback.index + 1} / {playback.items.length}</span> · {current.name}</p>}
    {playback.error && <p className="request-error" role="alert">{playback.error}</p>}
    {playback.wakeWarning && <p className="display-warning" role="status">{playback.wakeWarning}</p>}
  </section>
}
