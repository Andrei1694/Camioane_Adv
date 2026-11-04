import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { TimelineState } from '@xzdarcy/react-timeline-editor'
import { layout, locate, totalLength } from './edit'
import type { Segment } from './edit'

// A segment ends a little early rather than show frames from past its cut.
const endTolerance = 0.02
// Two segments this close in the source play on without a seek between them.
const seamTolerance = 0.05

/**
 * Plays the edit in the preview. The video element is the clock: each frame maps its source time
 * to timeline time, and the end of a segment seeks to the start of the next. The timeline's own
 * engine never plays.
 */
export function usePlayback(timelineRef: RefObject<TimelineState | null>, segments: Segment[]) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timeRef = useRef(0)
  const indexRef = useRef(0)
  const frameRef = useRef(0)
  const segmentsRef = useRef(segments)

  const publish = useCallback((next: number) => {
    timeRef.current = next
    setTime(next)
    timelineRef.current?.setTime(next)
  }, [timelineRef])

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = 0
    setPlaying(false)
  }, [])

  const pause = useCallback(() => {
    stopLoop()
    videoRef.current?.pause()
  }, [stopLoop])

  /** Moves the playhead and shows the source frame under it. */
  const seek = useCallback((target: number) => {
    pause()
    const next = Math.min(Math.max(target, 0), totalLength(segmentsRef.current))
    const located = locate(segmentsRef.current, next)
    if (!located) return
    indexRef.current = located.index
    publish(next)
    const element = videoRef.current
    if (element && Math.abs(element.currentTime - located.sourceTime) > 0.001) element.currentTime = located.sourceTime
  }, [pause, publish])

  const play = useCallback(() => {
    const element = videoRef.current
    const total = totalLength(segmentsRef.current)
    if (!element || total === 0) return
    // From the end, play starts over.
    seek(timeRef.current >= total - endTolerance ? 0 : timeRef.current)
    setPlaying(true)
    element.play().catch(stopLoop)

    function step() {
      const video = videoRef.current
      const placed = layout(segmentsRef.current)
      const current = placed[indexRef.current]
      // Reaching the end of the source also pauses the element; only another pause stops playback.
      const ended = video?.ended ?? false
      if (!video || !current || (video.paused && !ended)) {
        stopLoop()
        return
      }
      if (ended || video.currentTime >= current.segment.sourceEnd - endTolerance) {
        const next = placed[indexRef.current + 1]
        if (!next) {
          video.pause()
          publish(current.end)
          stopLoop()
          return
        }
        indexRef.current += 1
        if (ended || Math.abs(video.currentTime - next.segment.sourceStart) > seamTolerance) video.currentTime = next.segment.sourceStart
        if (ended) video.play().catch(stopLoop)
        publish(next.start)
      } else {
        publish(Math.min(current.start + Math.max(0, video.currentTime - current.segment.sourceStart), current.end))
      }
      frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
  }, [publish, seek, stopLoop])

  // An edit changes what sits under the playhead, so playback stops and the preview shows the
  // frame at the same timeline time, or at the new end when the edit got shorter.
  useEffect(() => {
    segmentsRef.current = segments
    if (segments.length > 0) seek(timeRef.current)
  }, [segments, seek])

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  return { videoRef, time, playing, play, pause, seek }
}
