import { useCallback, useEffect, useRef, useState } from 'react'
import type { Size } from './placement'

export interface DisplayScreen extends Screen, EventTarget {
  left: number
  top: number
  devicePixelRatio: number
  label: string
  isPrimary: boolean
  isInternal: boolean
}

interface ScreenDetails extends EventTarget { screens: DisplayScreen[] }
type ManagedWindow = Window & { getScreenDetails?: () => Promise<ScreenDetails> }
export interface OutputWindow {
  window: Window
  container: HTMLElement
}
export interface OutputFrame extends Size { dpr: number, fullscreen: boolean }

const surfaceStyle = `
  html, body, #display-root { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #000; color: #fff; }
  :fullscreen { cursor: none; }
  video, canvas { position: absolute; pointer-events: none; }
  video { object-fit: fill; max-width: none; }
  canvas { inset: 0; }
  .fullscreen-control { position: fixed; top: 16px; right: 16px; z-index: 3; font: 16px system-ui, sans-serif; }
  .fullscreen-control button { min-height: 44px; padding: 8px 16px; background: #fff; color: #12263a; border: 1px solid #b8b8b8; border-radius: 6px; cursor: pointer; }
  .fullscreen-control button:focus-visible { outline: 2px solid #00c9e8; outline-offset: 3px; }
  .fullscreen-control p { max-width: 320px; background: #000; }
`

export function useOutputWindow() {
  const [output, setOutput] = useState<OutputWindow | null>(null)
  const [frame, setFrame] = useState<OutputFrame | null>(null)
  const [screens, setScreens] = useState<DisplayScreen[]>([])
  const [details, setDetails] = useState<ScreenDetails | null>(null)
  const [error, setError] = useState('')
  const [screenError, setScreenError] = useState('')
  const [discovering, setDiscovering] = useState(false)
  const owned = useRef<Window | null>(null)
  const alive = useRef(false)
  const supportsScreens = typeof (window as ManagedWindow).getScreenDetails === 'function'

  const close = useCallback(() => {
    const popup = owned.current
    owned.current = null
    popup?.close()
    setOutput(null)
    setFrame(null)
  }, [])

  useEffect(() => {
    alive.current = true
    window.addEventListener('pagehide', close)
    return () => {
      alive.current = false
      window.removeEventListener('pagehide', close)
      owned.current?.close()
      owned.current = null
    }
  }, [close])

  useEffect(() => {
    if (!details) return
    let observed: DisplayScreen[] = []
    function refresh() { setScreens([...details!.screens]) }
    function subscribe() {
      observed.forEach((screen) => screen.removeEventListener('change', refresh))
      observed = [...details!.screens]
      observed.forEach((screen) => screen.addEventListener('change', refresh))
      refresh()
    }
    subscribe()
    details.addEventListener('screenschange', subscribe)
    return () => {
      details.removeEventListener('screenschange', subscribe)
      observed.forEach((screen) => screen.removeEventListener('change', refresh))
    }
  }, [details])

  useEffect(() => {
    if (!output) return
    const popup = output.window
    function update() {
      if (popup.closed) { close(); return }
      const dpr = popup.devicePixelRatio || 1
      const next = {
        width: Math.round(popup.innerWidth * dpr), height: Math.round(popup.innerHeight * dpr),
        dpr, fullscreen: !!popup.document.fullscreenElement,
      }
      setFrame((previous) => previous?.width === next.width && previous.height === next.height
        && previous.dpr === next.dpr && previous.fullscreen === next.fullscreen ? previous : next)
    }
    update()
    popup.addEventListener('pagehide', close)
    popup.addEventListener('resize', update)
    popup.document.addEventListener('fullscreenchange', update)
    // Moving between screens can change DPR without changing the CSS window size.
    const timer = window.setInterval(update, 500)
    return () => {
      window.clearInterval(timer)
      popup.removeEventListener('pagehide', close)
      popup.removeEventListener('resize', update)
      popup.document.removeEventListener('fullscreenchange', update)
    }
  }, [output, close])

  async function discoverScreens() {
    if (!supportsScreens || discovering) return
    setDiscovering(true)
    setScreenError('')
    try {
      const found = await (window as ManagedWindow).getScreenDetails!()
      if (alive.current) setDetails(found)
    } catch {
      if (alive.current) setScreenError('Ecranele nu pot fi enumerate. Permite accesul la ecrane sau mută manual fereastra de redare.')
    } finally { if (alive.current) setDiscovering(false) }
  }

  function open(screen?: DisplayScreen) {
    if (owned.current && !owned.current.closed) { owned.current.focus(); return }
    setError('')
    const features = screen
      ? `popup,left=${screen.left},top=${screen.top},width=${screen.availWidth},height=${screen.availHeight}`
      : 'popup,width=960,height=540'
    try {
      const popup = window.open('', 'camioane-display', features)
      if (!popup) {
        setError('Browserul a blocat fereastra de redare. Permite ferestrele pop-up pentru această pagină și încearcă din nou.')
        return
      }
      owned.current = popup
      const document = popup.document
      document.documentElement.lang = 'ro'
      const style = document.createElement('style')
      style.textContent = surfaceStyle
      document.head.replaceChildren(style)
      document.title = 'Redare pe ecran · Camioane App'
      const container = document.createElement('div')
      container.id = 'display-root'
      document.body.replaceChildren(container)
      setOutput({ window: popup, container })
    } catch {
      close()
      setError('Fereastra de redare nu a putut fi pregătită. Închide fereastra și încearcă din nou.')
    }
  }

  return { output, frame, screens, supportsScreens, discovering, error, screenError, discoverScreens, open, close }
}
