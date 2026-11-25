import { useEffect, useRef } from 'react'
import { attachCanvas } from './webMedia'

export default function Preview({ sessionId }: { sessionId: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (ref.current) return attachCanvas(sessionId, ref.current) }, [sessionId])
  return <canvas ref={ref} width={2304} height={512} role="img" aria-label="Previzualizarea celor trei regiuni"
    style={{ display: 'block', width: '100%', aspectRatio: '4.5', background: '#000' }} />
}
