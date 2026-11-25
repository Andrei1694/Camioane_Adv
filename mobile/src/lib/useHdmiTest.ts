import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { Platform } from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { hdmiPlayer } from '../../modules/hdmi-player'
import type { HdmiStatus } from '../../modules/hdmi-player'
import { useSession } from '../auth/session'
import { deleteVideoCopy, loadSampleVideo, pickVideo } from './hdmiFiles'
import type { HdmiVideo, SampleVideo } from './hdmiFiles'
import { takeHdmiResult } from '../features/screen/hdmiResults'

const initialStatus: HdmiStatus = { sessionId: '', display: null, playback: 'idle', error: null }
const cacheWarning = 'A temporary video could not be removed. Your phone can clear it from the app cache.'
const releaseWarning = 'The previous HDMI test could not finish cleanup. A temporary video may remain in the app cache.'
let nextSession = 0
let nextWakeLock = 0
let pendingCleanupWarning = ''

interface PlaybackSession {
  id: string
  alive: boolean
  ready: boolean
  busy: boolean
  status: HdmiStatus
  file: HdmiVideo | null
  files: Set<HdmiVideo>
}

async function releaseSession(player: NonNullable<typeof hdmiPlayer>, id: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await player.release(id)
      return true
    } catch {
      // Native retains failed teardown resources so the second call can retry.
    }
  }
  return false
}

function preparationDetachedFiles(failure: unknown) {
  return typeof failure === 'object' && failure !== null && 'code' in failure
    && (failure.code === 'ERR_HDMI_PREPARE_FAILED' || failure.code === 'ERR_HDMI_CANCELLED')
}

export function useHdmiTest(initialSample: SampleVideo = 'flower', resultId?: string) {
  const [status, setStatus] = useState(initialStatus)
  const [file, setFile] = useState<HdmiVideo | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [cleanupWarning, setCleanupWarning] = useState('')
  const [wakeWarning, setWakeWarning] = useState<{ sessionId: string; message: string } | null>(null)
  const session = useRef<PlaybackSession | null>(null)

  const removeFile = useCallback((video: HdmiVideo, current: PlaybackSession) => {
    if (!current.files.has(video)) return
    try {
      deleteVideoCopy(video)
      current.files.delete(video)
    } catch {
      if (current.alive && session.current === current) setCleanupWarning(cacheWarning)
      else pendingCleanupWarning = cacheWarning
    }
  }, [])

  const selectVideo = useCallback(async (current: PlaybackSession, loadVideo: () => Promise<HdmiVideo | null>) => {
    const player = hdmiPlayer
    if (!player || !current.alive || !current.ready || current.busy) return
    current.busy = true
    setBusy(true)
    setError('')
    let picked: HdmiVideo | null = null
    let previous: HdmiVideo | null = null
    try {
      await player.pause(current.id).catch(() => {
        if (current.alive) setError('Playback could not be paused. Stop the test if video is still playing.')
      })
      if (!current.alive) return
      picked = await loadVideo()
      if (!picked) return
      current.files.add(picked)
      if (!current.alive) {
        // This copy never reached native, even if disposal already finished.
        removeFile(picked, current)
        return
      }
      previous = current.file
      current.file = null
      setFile(null)
      setError('')
      current.status = { ...current.status, playback: 'loading', error: null }
      setStatus(current.status)
      setWakeWarning(null)
      await player.prepare(current.id, picked.uri)
      if (!current.alive) return // Disposal owns every file passed to native.
      if (current.status.playback === 'error') {
        // A decoder can fail immediately after readiness, before this continuation.
        removeFile(picked, current)
      } else {
        current.file = picked
        setFile(picked)
      }
      if (previous) removeFile(previous, current)
    } catch (failure) {
      if (!current.alive) return
      if (picked && preparationDetachedFiles(failure)) {
        removeFile(picked, current)
        if (previous) removeFile(previous, current)
      } else if (picked) {
        // An unexpected bridge/teardown failure does not confirm file detachment.
        // Keep these copies until disposal acknowledges release.
        current.ready = false
        setReady(false)
        setError('The video could not be opened or released. Leave this screen and try again.')
        return
      }
      setError('The video could not be opened. Check that it is downloaded and that your phone has free storage, then choose it again.')
    } finally {
      current.busy = false
      if (current.alive) setBusy(false)
    }
  }, [removeFile])

  useFocusEffect(useCallback(() => {
    const player = hdmiPlayer
    if (!player) return
    const current: PlaybackSession = {
      id: `hdmi-${Date.now()}-${++nextSession}`, alive: true, ready: false, busy: false,
      status: initialStatus, file: null, files: new Set(),
    }
    session.current = current
    setStatus(initialStatus)
    setFile(null)
    setError('')
    setCleanupWarning(pendingCleanupWarning)
    pendingCleanupWarning = ''
    setWakeWarning(null)
    setBusy(false)
    setReady(false)
    const listener = player.addListener('onStatus', (next) => {
      if (!current.alive || next.sessionId !== current.id) return
      current.status = next
      setStatus(next)
      if (next.playback !== 'playing' && next.playback !== 'buffering') setWakeWarning(null)
      // Native emits a terminal media error only after detaching its readers.
      // Preparation failures are cleaned up by selectVideo after its promise settles.
      if (next.playback === 'error' && current.file) {
        const failed = current.file
        current.file = null
        setFile(null)
        removeFile(failed, current)
      }
    })
    const starting = Platform.OS === 'ios'
      ? player.start(current.id, useSession.getState().session?.expiresAt ?? null)
      : player.start(current.id)
    const startup = starting.then((next) => {
      if (!current.alive) return
      current.ready = true
      current.status = next
      setReady(true)
      setStatus(next)
      // Do not await preparation here: disposal must be able to cancel it.
      void selectVideo(current, () => resultId ? takeHdmiResult(resultId) : loadSampleVideo(initialSample))
    }).catch(() => {
      if (current.alive) setError('HDMI playback could not start. Leave this screen and try again.')
    })
    const revision = useSession.getState().revision
    const unsubscribe = useSession.subscribe((state) => {
      if (state.revision !== revision) dispose()
    })

    function dispose() {
      if (!current.alive) return
      current.alive = false
      current.ready = false
      listener.remove()
      unsubscribe()
      if (session.current === current) {
        session.current = null
        setStatus(initialStatus)
        setReady(false)
        setBusy(false)
        setFile(null)
      }
      // Wait only for startup. Release must cancel pending preparation itself.
      void startup.then(async () => {
        if (!await releaseSession(player!, current.id)) {
          pendingCleanupWarning = releaseWarning
          return
        }
        current.files.forEach((video) => removeFile(video, current))
        current.file = null
      })
    }

    return dispose
  }, [initialSample, resultId, removeFile, selectVideo]))

  // Every activation has its own tag: a late completion after pause or navigation
  // cannot disable the wake lock of a resumed or newly opened session.
  const keepingAwake = status.playback === 'playing' || status.playback === 'buffering'
  useEffect(() => {
    const current = session.current
    if (!keepingAwake || !current?.alive || current.id !== status.sessionId) return
    const tag = `${current.id}-wake-${++nextWakeLock}`
    const activation = new AbortController()
    void activateKeepAwakeAsync(tag).then(() => {
      if (activation.signal.aborted || !current.alive) void deactivateKeepAwake(tag).catch(() => {})
    }).catch(() => {
      if (!activation.signal.aborted && current.alive) {
        setWakeWarning({ sessionId: current.id, message: Platform.OS === 'ios'
          ? 'The phone could not be kept awake. HDMI playback can continue with the screen locked.'
          : 'The phone could not be kept awake. Keep its screen on during this test.' })
      }
    })
    return () => {
      activation.abort()
      void deactivateKeepAwake(tag).catch(() => {})
    }
  }, [keepingAwake, status.sessionId])

  async function chooseVideo() {
    const current = session.current
    if (current) await selectVideo(current, pickVideo)
  }

  async function control(action: 'play' | 'pause' | 'stop') {
    const player = hdmiPlayer
    const current = session.current
    if (!player || !current?.alive || !current.ready || current.busy || !current.file) return
    current.busy = true
    setBusy(true)
    setError('')
    try {
      await player[action](current.id)
    } catch {
      if (current.alive) setError('Playback could not be updated. Check the HDMI connection and try again.')
    } finally {
      current.busy = false
      if (current.alive) setBusy(false)
    }
  }

  const activeWakeWarning = keepingAwake && wakeWarning?.sessionId === status.sessionId
    ? wakeWarning.message : ''
  return { status, file, busy, ready, error: status.error || error || cleanupWarning || activeWakeWarning, chooseVideo, control }
}
