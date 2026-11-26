import { useEffect, useRef, useState } from 'react'
import { placement, regionIds } from './screenLayout'
import { screenLayoutError } from '../../lib/screenPreset'
import type { ScreenLayout } from '../../lib/screenPreset'

/** The hidden video is the playback clock; only its pixels reach the preview canvas. */
export function useScreenPlayback(source: Blob | undefined, layout: ScreenLayout) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const [media, setMedia] = useState<{ source: Blob, duration: number, failed: boolean }>()
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const duration = media?.source === source && !media?.failed ? media?.duration ?? 0 : 0
  const unplayable = media?.source === source && media?.failed === true

  useEffect(() => {
    const video = videoRef.current
    if (!video || !source) return
    const url = URL.createObjectURL(source)
    function loaded() {
      if (!video) return
      const valid = Number.isFinite(video.duration) && video.duration > 0 && video.videoWidth > 0 && video.videoHeight > 0
      setMedia({ source: source!, duration: valid ? video.duration : 0, failed: !valid })
    }
    function failed() { setMedia({ source: source!, duration: 0, failed: true }) }
    function updateTime() { setTime(video!.currentTime) }
    function play() { setPlaying(true) }
    function pause() { setPlaying(false) }
    video.addEventListener('loadeddata', loaded)
    video.addEventListener('error', failed)
    video.addEventListener('timeupdate', updateTime)
    video.addEventListener('play', play)
    video.addEventListener('pause', pause)
    video.src = url
    video.load()
    setTime(0)
    setPlaying(false)
    return () => {
      video.removeEventListener('loadeddata', loaded)
      video.removeEventListener('error', failed)
      video.removeEventListener('timeupdate', updateTime)
      video.removeEventListener('play', play)
      video.removeEventListener('pause', pause)
      video.pause()
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
    }
  }, [source])

  useEffect(() => {
    const video = videoRef.current
    const context = canvasRef.current?.getContext('2d')
    if (!video || !context) return
    const validLayout = !screenLayoutError(layout)
    function draw() {
      if (!context || !video) return
      context.fillStyle = '#000'
      context.fillRect(0, 0, context.canvas.width, context.canvas.height)
      if (!validLayout || !source || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return
      for (const id of regionIds) {
        const region = layout.regions[id]
        const { sx, sy, sw, sh, dx, dy, dw, dh } = placement(video.videoWidth, video.videoHeight, region, region.fit)
        context.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh)
      }
    }
    function tick() {
      draw()
      if (!video?.paused && !video?.ended) frameRef.current = requestAnimationFrame(tick)
    }
    function start() {
      cancelAnimationFrame(frameRef.current)
      tick()
    }
    function stop() {
      cancelAnimationFrame(frameRef.current)
      draw()
    }
    video.addEventListener('loadeddata', draw)
    video.addEventListener('seeked', draw)
    video.addEventListener('play', start)
    video.addEventListener('pause', stop)
    video.addEventListener('ended', stop)
    start()
    return () => {
      cancelAnimationFrame(frameRef.current)
      video.removeEventListener('loadeddata', draw)
      video.removeEventListener('seeked', draw)
      video.removeEventListener('play', start)
      video.removeEventListener('pause', stop)
      video.removeEventListener('ended', stop)
    }
  }, [source, layout])

  return {
    videoRef, canvasRef, duration, unplayable, time, playing,
    ready: duration > 0,
    pause: () => videoRef.current?.pause(),
    play: () => {
      const video = videoRef.current
      if (!video || !duration) return
      if (video.ended) video.currentTime = 0
      void video.play().catch(() => setPlaying(false))
    },
    seek: (seconds: number) => {
      if (!videoRef.current || !duration) return
      videoRef.current.currentTime = Math.max(0, Math.min(seconds, duration))
      setTime(videoRef.current.currentTime)
    },
  }
}
