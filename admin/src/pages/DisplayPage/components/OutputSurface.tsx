import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Placement } from '../placement'
import type { useDisplayPlayback } from '../useDisplayPlayback'
import type { OutputFrame, OutputWindow } from '../useOutputWindow'

function CalibrationGrid({ frame }: { frame: OutputFrame }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const { width, height } = frame
    context.fillStyle = '#000'
    context.fillRect(0, 0, width, height)
    const accents = ['#00ffff', '#ffff00', '#ff00ff', '#00ff00']
    for (const vertical of [true, false]) {
      for (let position = 0; position < (vertical ? width : height); position += 64) {
        context.strokeStyle = position % 512 === 0 ? accents[position / 512 % accents.length]
          : position % 128 === 0 ? '#b3b3b3' : '#4d4d4d'
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(vertical ? position + 0.5 : 0, vertical ? 0 : position + 0.5)
        context.lineTo(vertical ? position + 0.5 : width, vertical ? height : position + 0.5)
        context.stroke()
      }
    }
    context.font = '12px monospace'
    context.textBaseline = 'top'
    for (let y = 0; y < height; y += 128) {
      for (let x = 0; x < width; x += 128) {
        const label = `${x},${y}`
        const labelWidth = context.measureText(label).width
        const left = Math.max(2, Math.min(x + 4, width - labelWidth - 2))
        const top = Math.max(2, Math.min(y + 4, height - 16))
        context.fillStyle = '#000'
        context.fillRect(left, top, labelWidth, 14)
        context.fillStyle = '#fff'
        context.fillText(label, left, top)
      }
    }
    context.strokeStyle = '#fff'
    context.lineWidth = 2
    context.strokeRect(1, 1, width - 2, height - 2)
  }, [frame])
  return <canvas ref={canvas} width={frame.width} height={frame.height}
    style={{ width: frame.width / frame.dpr, height: frame.height / frame.dpr, zIndex: 2 }}
    aria-label="Grilă de calibrare cu coordonate în pixeli" role="img" />
}

export default function OutputSurface({ output, frame, placement, playback }: {
  output: OutputWindow
  frame: OutputFrame | null
  placement: Placement
  playback: ReturnType<typeof useDisplayPlayback>
}) {
  const [error, setError] = useState('')
  const dpr = frame?.dpr ?? output.window.devicePixelRatio ?? 1

  async function fullscreen() {
    setError('')
    try { await output.window.document.documentElement.requestFullscreen() }
    catch { setError('Ecranul complet nu este disponibil. Încearcă din nou sau maximizează fereastra.') }
  }

  return createPortal(<>
    {[playback.first, playback.second].map((ref, slot) => <video key={slot} ref={ref} muted playsInline preload="auto"
      aria-label="Videoclip pe ecranul extern" aria-hidden={playback.visibleSlot !== slot || !playback.visible || playback.pattern}
      style={{
        left: placement.x / dpr, top: placement.y / dpr,
        width: (playback.sizes[slot]?.width ?? 0) * placement.scale / dpr,
        height: (playback.sizes[slot]?.height ?? 0) * placement.scale / dpr,
        visibility: playback.visibleSlot === slot && playback.visible && !playback.pattern ? 'visible' : 'hidden',
      }} />)}
    {playback.pattern && frame && <CalibrationGrid frame={frame} />}
    {!frame?.fullscreen && <div className="fullscreen-control">
      <button type="button" onClick={() => void fullscreen()}>Ecran complet</button>
      {error && <p role="alert">{error}</p>}
    </div>}
  </>, output.container)
}
