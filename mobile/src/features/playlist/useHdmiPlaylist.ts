import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { hdmiPlayer } from '../../../modules/hdmi-player'
import type { HdmiStatus } from '../../../modules/hdmi-player'
import { useSession } from '../../auth/session'
import type { PlaylistItem, PlaylistStore } from './types'
import { defaultPlacement } from '../hdmi-placement/placement'
import { useHdmiPlacement } from '../hdmi-placement/useHdmiPlacement'

const initialStatus: HdmiStatus = { sessionId: '', display: null, playback: 'idle', error: null, index: null, count: 0,
  video: null, placement: defaultPlacement, modes: [], pattern: false }
let nextSession = 0
let nextWake = 0
let cleanupWarning = ''
interface Session {
  id: string
  alive: boolean
  ready: boolean
  busy: boolean
  items: PlaylistItem[] | null
  status: HdmiStatus
}
function detached(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error.code === 'ERR_HDMI_PREPARE_FAILED' || error.code === 'ERR_HDMI_CANCELLED')
}

export function useHdmiPlaylist(items: PlaylistItem[] | null, store: PlaylistStore) {
  const { applySaved, error: placementError } = useHdmiPlacement('ro')
  const [status, setStatus] = useState(initialStatus)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [failedName, setFailedName] = useState('')
  const [wakeWarning, setWakeWarning] = useState('')
  const session = useRef<Session | null>(null)
  const latestItems = useRef(items)
  useEffect(() => { latestItems.current = items }, [items])

  const prepare = useCallback(async (current: Session, next: PlaylistItem[]) => {
    if (!hdmiPlayer || !current.alive || !current.ready || current.busy) throw new Error('Așteaptă pregătirea HDMI.')
    if (current.items === next) return
    const currentId = current.items?.[current.status.index ?? 0]?.id
    const found = next.findIndex((item) => item.id === currentId)
    const startIndex = found >= 0 ? found : Math.min(current.status.index ?? 0, Math.max(0, next.length - 1))
    current.items = next
    current.busy = true
    setBusy(true)
    setError('')
    setFailedName('')
    try {
      await hdmiPlayer.prepare(current.id, next.map(store.uri), startIndex)
    } catch (failure) {
      if (!detached(failure)) {
        current.ready = false
        if (current.alive) {
          setReady(false)
          setError('Videoclipurile nu au putut fi eliberate. Ieși din playlist și încearcă din nou.')
        }
        throw failure
      }
      // Native has detached ALL readers. Removal is safe even if another item failed.
    } finally {
      current.busy = false
      if (current.alive) setBusy(false)
    }
  }, [store])

  useFocusEffect(useCallback(() => {
    const player = hdmiPlayer
    if (!player) return
    const current: Session = {
      id: `playlist-${Date.now()}-${++nextSession}`, alive: true, ready: false, busy: false, items: null, status: initialStatus,
    }
    session.current = current
    setStatus(initialStatus)
    setReady(false)
    setBusy(false)
    setFailedName('')
    setError(cleanupWarning)
    cleanupWarning = ''
    const listener = player.addListener('onStatus', (next) => {
      if (!current.alive || next.sessionId !== current.id) return
      current.status = next
      setStatus(next)
      setFailedName(next.error && next.index !== null ? current.items?.[next.index]?.name ?? '' : '')
    })
    const revision = useSession.getState().revision
    const startup = player.start(current.id, useSession.getState().session?.expiresAt ?? null).then(async (next) => {
      if (!current.alive) return
      current.status = next
      setStatus(next)
      await applySaved(current.id, () => current.alive)
      if (!current.alive) return
      current.ready = true
      setReady(true)
      if (latestItems.current) void prepare(current, latestItems.current).catch(() => {})
    }).catch(() => {
      if (current.alive) setError('HDMI nu a putut porni. Ieși din playlist și încearcă din nou.')
    })
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
        setReady(false)
        setBusy(false)
        setStatus(initialStatus)
      }
      // Do not wait for preparation: release cancels it. Permanent files stay on disk.
      void startup.then(async () => {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try { await player!.release(current.id); return } catch { /* Retry retained native resources. */ }
        }
        cleanupWarning = 'Redarea HDMI nu a putut fi închisă complet. Redeschide playlistul.'
      })
    }
    return dispose
  }, [prepare, applySaved]))

  useEffect(() => {
    const current = session.current
    if (items && current?.alive && current.ready && !current.busy && current.items !== items) {
      void prepare(current, items).catch(() => {})
    }
  }, [items, ready, prepare])

  const active = status.playback === 'playing' || status.playback === 'buffering'
  useEffect(() => {
    const current = session.current
    if (!active || !current?.alive || status.sessionId !== current.id) return
    const tag = `${current.id}-wake-${++nextWake}`
    const activation = new AbortController()
    setWakeWarning('')
    void activateKeepAwakeAsync(tag).then(() => {
      if (activation.signal.aborted || !current.alive) void deactivateKeepAwake(tag).catch(() => {})
    }).catch(() => {
      if (!activation.signal.aborted && current.alive) setWakeWarning('Telefonul nu a putut fi menținut treaz. Păstrează ecranul aprins pentru HDMI.')
    })
    return () => { activation.abort(); void deactivateKeepAwake(tag).catch(() => {}) }
  }, [active, status.sessionId])

  async function replace(next: PlaylistItem[]) {
    const current = session.current
    if (!current?.alive) throw new Error('Sesiunea HDMI s-a încheiat.')
    await prepare(current, next)
    if (!current.alive) throw new Error('Sesiunea HDMI s-a încheiat.')
  }
  async function control(action: 'play' | 'pause' | 'stop' | 'next' | 'previous') {
    const current = session.current
    if (!hdmiPlayer || !current?.alive || !current.ready || current.busy || !current.items?.length) return
    current.busy = true
    setBusy(true)
    setError('')
    try {
      if (action === 'next' || action === 'previous') {
        const count = current.items.length
        const index = ((current.status.index ?? 0) + (action === 'next' ? 1 : -1) + count) % count
        await hdmiPlayer.skip(current.id, index)
      } else await hdmiPlayer[action](current.id)
    } catch {
      if (current.alive) setError('Redarea nu a putut fi actualizată. Verifică legătura HDMI.')
    } finally {
      current.busy = false
      if (current.alive) setBusy(false)
    }
  }
  return { status, ready, busy, active, failedName, replace, control,
    error: status.error || error || placementError || (active ? wakeWarning : '') }
}
