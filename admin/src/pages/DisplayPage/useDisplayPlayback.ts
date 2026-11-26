import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Size } from './placement'
import type { OutputWindow } from './useOutputWindow'

export type PlaybackState = 'idle' | 'loading' | 'ready' | 'playing' | 'buffering' | 'paused' | 'stopped' | 'error'
export interface PlaybackItem { id: string, name: string, blob: Blob }
interface Status {
  phase: PlaybackState
  index: number
  video: Size | null
  visibleSlot: number
  visible: boolean
  intent: boolean
  sizes: (Size | null)[]
  error: string
}
interface Player {
  items: PlaybackItem[]
  index: number
  slot: number
  intent: boolean
  phase: PlaybackState
  play: () => void
  pause: () => void
  stop: () => void
  skip: (direction: number) => void
  preload: () => void
}

const initialStatus: Status = { phase: 'idle', index: 0, video: null, visibleSlot: 0, visible: false, intent: false, sizes: [null, null], error: '' }

export function useDisplayPlayback(output: OutputWindow | null) {
  const first = useRef<HTMLVideoElement>(null)
  const second = useRef<HTMLVideoElement>(null)
  const player = useRef<Player | null>(null)
  const selection = useRef({ id: '', index: 0 })
  const [prepared, setPrepared] = useState<{ items: PlaybackItem[], startIndex: number }>({ items: [], startIndex: 0 })
  const [status, setStatus] = useState(initialStatus)
  const [pattern, setPattern] = useState(false)
  const [wakeWarning, setWakeWarning] = useState('')

  const prepare = useCallback((items: PlaybackItem[], startIndex?: number) => {
    const previous = player.current
    previous?.pause()
    const id = previous?.items[previous.index]?.id ?? selection.current.id
    const found = items.findIndex((item) => item.id === id)
    const index = startIndex ?? (found >= 0 ? found : Math.min(selection.current.index, Math.max(0, items.length - 1)))
    selection.current = { id: items[index]?.id ?? '', index }
    setPrepared({ items, startIndex: index })
    setPattern(false)
  }, [])

  useEffect(() => {
    const elements = [first.current, second.current]
    const { items } = prepared
    const startIndex = Math.max(0, Math.min(prepared.startIndex, items.length - 1))
    if (!output || !elements[0] || !elements[1] || !items.length) {
      setStatus({ ...initialStatus, phase: items.length ? 'ready' : 'idle', index: startIndex })
      setPattern(false)
      return
    }
    const videos = elements as [HTMLVideoElement, HTMLVideoElement]
    const urls = items.map((item) => URL.createObjectURL(item.blob))
    const assigned = [-1, -1]
    const lifetime = new AbortController()
    const requests = { version: 0 }

    function publish(phase: PlaybackState, extra: Partial<Status> = {}) {
      if (lifetime.signal.aborted) return
      current.phase = phase
      selection.current = { id: items[current.index].id, index: current.index }
      setStatus((previous) => ({ ...previous, phase, index: current.index, intent: current.intent, ...extra }))
    }

    function fail(index: number) {
      if (lifetime.signal.aborted) return
      current.intent = false
      requests.version += 1
      videos.forEach((video) => video.pause())
      setPattern(false)
      publish('error', { visible: false, error: `„${items[index].name}” nu poate fi redat. Verifică fișierul MP4 sau alege un alt videoclip.` })
    }

    function assign(slot: number, index: number) {
      if (assigned[slot] === index) return
      const video = videos[slot]
      video.pause()
      assigned[slot] = index
      video.muted = true
      video.loop = items.length === 1
      video.src = urls[index]
      video.load()
    }

    function metadata(slot: number) {
      const video = videos[slot]
      if (!video.videoWidth || !video.videoHeight) return
      const size = { width: video.videoWidth, height: video.videoHeight }
      if (lifetime.signal.aborted) return
      setStatus((previous) => ({ ...previous,
        video: slot === current.slot ? size : previous.video,
        sizes: previous.sizes.map((value, index) => index === slot ? size : value),
      }))
    }

    function play() {
      if (lifetime.signal.aborted || output!.window.closed) return
      current.intent = true
      const slot = current.slot
      const video = videos[slot]
      if (video.error) {
        assigned[slot] = -1
        assign(slot, current.index)
      }
      const attempt = ++requests.version
      publish('loading', { error: '' })
      void video.play().catch(() => {
        if (!lifetime.signal.aborted && current.intent && requests.version === attempt && current.slot === slot) fail(current.index)
      })
    }

    function pause() {
      current.intent = false
      requests.version += 1
      videos.forEach((video) => video.pause())
      if (current.phase !== 'error' && current.phase !== 'stopped') publish('paused')
    }

    function stop() {
      current.intent = false
      requests.version += 1
      videos.forEach((video) => video.pause())
      current.index = 0
      current.slot = 0
      assign(0, 0)
      videos[0].currentTime = 0
      setPattern(false)
      publish('stopped', { visible: false, visibleSlot: 0, error: '', video: null })
      metadata(0)
    }

    function skip(direction: number) {
      requests.version += 1
      videos[current.slot].pause()
      const index = (current.index + direction + items.length) % items.length
      const slot = 1 - current.slot
      current.index = index
      current.slot = slot
      assign(slot, index)
      videos[slot].currentTime = 0
      publish('loading', { error: '' })
      metadata(slot)
      if (current.intent) play()
      else {
        publish(videos[slot].readyState >= 2 ? 'ready' : 'loading', { visibleSlot: slot, visible: false })
      }
    }

    function preload() {
      if (lifetime.signal.aborted || items.length < 2) return
      assign(1 - current.slot, (current.index + 1) % items.length)
    }

    const current: Player = { items, index: startIndex, slot: 0, intent: false, phase: 'loading', play, pause, stop, skip, preload }
    player.current = current
    setStatus({ ...initialStatus, phase: 'loading', index: startIndex })

    const cleanups = videos.map((video, slot) => {
      function onMetadata() { metadata(slot) }
      function onReady() {
        if (slot !== current.slot || current.phase === 'error') return
        metadata(slot)
        if (!current.intent && current.phase === 'loading') publish('ready')
      }
      function onPlaying() {
        if (slot !== current.slot || !current.intent) { video.pause(); return }
        metadata(slot)
        publish('playing', { visibleSlot: slot, visible: true })
      }
      function onWaiting() {
        if (slot === current.slot && current.intent) publish('buffering')
      }
      function onPause() {
        // Delayed events from an earlier pause must not override a newer Play.
        if (slot === current.slot && video.paused && !video.ended && current.intent) {
          current.intent = false
          publish('paused')
        }
      }
      function onEnded() {
        if (slot === current.slot && current.intent) skip(1)
      }
      function onError() {
        // Report preloaded failures when that item becomes current.
        if (slot === current.slot && video.error) fail(current.index)
      }
      const handlers = { loadedmetadata: onMetadata, loadeddata: onReady, canplay: onReady, playing: onPlaying,
        waiting: onWaiting, pause: onPause, ended: onEnded, error: onError }
      for (const [name, handler] of Object.entries(handlers)) video.addEventListener(name, handler)
      return () => {
        for (const [name, handler] of Object.entries(handlers)) video.removeEventListener(name, handler)
      }
    })
    assign(0, startIndex)
    preload()

    return () => {
      lifetime.abort()
      current.intent = false
      if (player.current === current) player.current = null
      cleanups.forEach((cleanup) => cleanup())
      videos.forEach((video) => { video.pause(); video.removeAttribute('src'); video.load() })
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [output, prepared])

  // Refill the old slot only after React has made the new video visible.
  useLayoutEffect(() => {
    if (status.visible && status.visibleSlot === player.current?.slot) player.current.preload()
  }, [status.visible, status.visibleSlot, status.index])

  const active = status.intent
  useEffect(() => {
    if (!active || !output) return
    const popup = output.window
    const lifetime = new AbortController()
    const pending: { lock: WakeLockSentinel | null, requesting: boolean } = { lock: null, requesting: false }
    const warning = 'Ecranul nu a putut fi menținut treaz. Păstrează fereastra de redare vizibilă și verifică setările de repaus ale calculatorului.'
    async function acquire() {
      if (lifetime.signal.aborted || pending.requesting || pending.lock && !pending.lock.released) return
      pending.requesting = true
      try {
        if (!popup.navigator.wakeLock) throw new Error('Wake lock unavailable')
        const acquired = await popup.navigator.wakeLock.request('screen')
        if (lifetime.signal.aborted) { void acquired.release().catch(() => {}); return }
        pending.lock = acquired
        setWakeWarning('')
        acquired.addEventListener('release', () => { if (!lifetime.signal.aborted) setWakeWarning(warning) }, { once: true })
      } catch { if (!lifetime.signal.aborted) setWakeWarning(warning) }
      finally { pending.requesting = false }
    }
    function visible() { if (popup.document.visibilityState === 'visible') void acquire() }
    void acquire()
    popup.document.addEventListener('visibilitychange', visible)
    return () => {
      lifetime.abort()
      popup.document.removeEventListener('visibilitychange', visible)
      void pending.lock?.release().catch(() => {})
    }
  }, [active, output])

  function play() { player.current?.play() }
  function pause() { player.current?.pause() }
  function stop() {
    setPattern(false)
    if (player.current) player.current.stop()
    else setStatus({ ...initialStatus, phase: prepared.items.length ? 'stopped' : 'idle' })
  }
  function next() { player.current?.skip(1) }
  function previous() { player.current?.skip(-1) }

  return { ...status, items: prepared.items, first, second, active, pattern, setPattern, wakeWarning: active ? wakeWarning : '',
    prepare, play, pause, stop, next, previous }
}
