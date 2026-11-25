import type { Composition, MediaInfo, PlaybackEvent, ProgressEvent, ScreenMedia } from './types'

interface Session {
  video: HTMLVideoElement
  canvas?: HTMLCanvasElement
  composition?: Composition
  frame: number
  dispose: () => void
}
const sessions = new Map<string, Session>()
const playbackListeners = new Set<(event: PlaybackEvent) => void>()

function draw(session: Session) {
  const { canvas, video, composition } = session
  const context = canvas?.getContext('2d')
  if (!context || !canvas) return
  context.fillStyle = '#000'
  context.fillRect(0, 0, canvas.width, canvas.height)
  if (!composition || video.readyState < 2) return
  for (const r of composition.regions) context.drawImage(video, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh)
}

function addListener(event: 'onPlayback', listener: (value: PlaybackEvent) => void): { remove(): void }
function addListener(event: 'onProgress', listener: (value: ProgressEvent) => void): { remove(): void }
function addListener(event: string, listener: ((value: PlaybackEvent) => void) | ((value: ProgressEvent) => void)) {
  if (event !== 'onPlayback') return { remove() {} }
  const callback = listener as (value: PlaybackEvent) => void
  playbackListeners.add(callback)
  return { remove: () => { playbackListeners.delete(callback) } }
}

export const screenMedia: ScreenMedia = {
  open(id, uri) {
    return new Promise<MediaInfo>((resolve, reject) => {
      const video = document.createElement('video')
      video.playsInline = true
      video.preload = 'auto'
      let settled = false
      const fail = () => {
        const error = 'Acest browser nu poate reda videoclipul MP4.'
        if (!settled) { settled = true; reject(new Error(error)) }
        for (const listener of playbackListeners) listener({ id, time: 0, playing: false, error })
      }
      const emit = () => {
        for (const listener of playbackListeners) listener({ id, time: video.currentTime, playing: !video.paused && !video.ended })
        draw(session)
      }
      const tick = () => { emit(); if (!video.paused && !video.ended) session.frame = requestAnimationFrame(tick) }
      const start = () => { cancelAnimationFrame(session.frame); tick() }
      const loaded = () => {
        if (settled) return
        if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration) || video.duration <= 0) { fail(); return }
        settled = true
        resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration })
      }
      const timeout = setTimeout(fail, 30_000)
      const session: Session = { video, frame: 0, dispose() {
        clearTimeout(timeout)
        cancelAnimationFrame(session.frame)
        video.removeEventListener('loadeddata', loaded)
        video.removeEventListener('error', fail)
        video.removeEventListener('play', start)
        video.removeEventListener('pause', emit)
        video.removeEventListener('seeked', emit)
        video.removeEventListener('ended', emit)
        video.pause()
        video.removeAttribute('src')
        video.load()
        if (!settled) { settled = true; reject(new Error('Previzualizarea a fost închisă.')) }
      } }
      sessions.set(id, session)
      video.addEventListener('loadeddata', () => clearTimeout(timeout), { once: true })
      video.addEventListener('loadeddata', loaded)
      video.addEventListener('error', fail)
      video.addEventListener('play', start)
      video.addEventListener('pause', emit)
      video.addEventListener('seeked', emit)
      video.addEventListener('ended', emit)
      video.src = uri
      video.load()
    })
  },
  async layout(id, value) { const session = sessions.get(id); if (session) { session.composition = JSON.parse(value) as Composition; draw(session) } },
  async play(id) { const video = sessions.get(id)?.video; if (video) { if (video.ended) video.currentTime = 0; await video.play() } },
  async pause(id) { sessions.get(id)?.video.pause() },
  async seek(id, seconds) { const session = sessions.get(id); if (session) session.video.currentTime = Math.max(0, Math.min(seconds, session.video.duration)) },
  async release(id) { sessions.get(id)?.dispose(); sessions.delete(id) },
  async render() { throw new Error('Folosește convertorul web.') },
  async cancel() {},
  addListener,
}

export function attachCanvas(id: string, canvas: HTMLCanvasElement) {
  const session = sessions.get(id)
  if (!session) return () => {}
  session.canvas = canvas
  draw(session)
  return () => { if (session.canvas === canvas) session.canvas = undefined }
}
