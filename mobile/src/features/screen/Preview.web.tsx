import { useEffect, useRef } from 'react'
import { attachCanvas } from './webMedia'
import type { Resolution } from './screenLayout'

export default function Preview({ sessionId, resolution }: { sessionId: string; resolution: Resolution }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (ref.current) return attachCanvas(sessionId, ref.current) }, [sessionId])
  return <canvas ref={ref} width={resolution.width} height={resolution.height} role="img" aria-label="Previzualizarea celor trei regiuni"
    style={{ display: 'block', width: '100%', aspectRatio: `${resolution.width} / ${resolution.height}`, background: '#000' }} />
}
