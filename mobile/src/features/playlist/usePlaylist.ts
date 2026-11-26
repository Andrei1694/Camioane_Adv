import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { getDocumentAsync } from 'expo-document-picker'
import { hdmiPlayer } from '../../../modules/hdmi-player'
import { useCurrentUser } from '../../auth/currentUser'
import { useSession } from '../../auth/session'
import { api } from '../../lib/api'
import type { StoredFile } from '../../lib/file'
import { deleteVideo } from '../screen/videoFiles'
import { abortError, mediaError } from '../screen/types'
import type { LocalVideo } from '../screen/types'
import { createPlaylistStore } from './playlistStore'
import { useHdmiPlaylist } from './useHdmiPlaylist'
import type { PlaylistItem } from './types'

export function usePlaylist() {
  const user = useCurrentUser()
  const revision = useSession((state) => state.revision)
  const preview = useSession((state) => state.preview)
  const store = useMemo(() => createPlaylistStore(user.id, () => {
    if (useSession.getState().revision !== revision) throw abortError()
  }), [user.id, revision])
  const [items, setItems] = useState<PlaylistItem[] | null>(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('')
  const [progress, setProgress] = useState(0)
  const operation = useRef<AbortController | null>(null)
  const focused = useRef(false)
  const hdmi = useHdmiPlaylist(items, store)

  useEffect(() => {
    let alive = true
    void store.load().then((next) => { if (alive) setItems(next) }).catch((failure) => {
      if (alive) setError(mediaError(failure))
    })
    return () => { alive = false }
  }, [store])

  useFocusEffect(useCallback(() => {
    focused.current = true
    const cancel = () => { focused.current = false; operation.current?.abort() }
    const unsubscribe = useSession.subscribe((state) => { if (state.revision !== revision) cancel() })
    return () => { cancel(); unsubscribe() }
  }, [revision]))

  async function run(label: string, work: (signal: AbortSignal) => Promise<void>) {
    if (!hdmiPlayer || !items || !hdmi.ready || hdmi.busy || operation.current || !focused.current) return
    const controller = new AbortController()
    operation.current = controller
    setError('')
    setPhase(label)
    setProgress(0)
    try {
      await work(controller.signal)
    } catch (failure) {
      if (!controller.signal.aborted && useSession.getState().revision === revision) setError(mediaError(failure))
    } finally {
      // Refresh from disk even when an import partially succeeded or navigation cancelled it.
      if (useSession.getState().revision === revision) {
        try {
          const next = await store.load()
          if (focused.current) setItems(next)
        } catch (failure) { if (focused.current) setError(mediaError(failure)) }
      }
      if (operation.current === controller) {
        operation.current = null
        setPhase('')
      }
    }
  }

  const addDevice = () => run('Se adaugă din telefon…', async (signal) => {
    await hdmi.control('pause')
    signal.throwIfAborted()
    const result = await getDocumentAsync({ type: 'video/*', multiple: true, copyToCacheDirectory: true })
    if (result.canceled) return
    const copies: LocalVideo[] = result.assets.map((asset) => ({ uri: asset.uri, name: asset.name, size: asset.size ?? 0 }))
    try {
      for (let index = 0; index < copies.length; index += 1) {
        signal.throwIfAborted()
        const asset = result.assets[index]
        if (asset.mimeType ? asset.mimeType !== 'video/mp4' : !/\.mp4$/i.test(asset.name)) {
          throw new Error(`„${asset.name}” nu este un fișier MP4. Fișierele adăugate anterior au fost păstrate.`)
        }
        await store.addLocal(copies[index], 'device')
        setProgress((index + 1) / copies.length)
      }
    } finally {
      // Successful moves leave no cache file. Cancelled/unprocessed copies are removed too.
      for (const copy of copies) await deleteVideo(copy)
    }
  })

  const addServer = (file: StoredFile) => run('Se descarcă…', async (signal) => {
    if (preview) throw new Error('Fișierele de pe server nu sunt disponibile în contul de previzualizare.')
    if (file.mimeType !== 'video/mp4') throw new Error('Alege un fișier MP4.')
    await hdmi.control('pause')
    signal.throwIfAborted()
    const video = await api.downloadFile(file, { signal, onProgress: (fraction) => {
      if (!signal.aborted) setProgress(fraction)
    } })
    try {
      signal.throwIfAborted()
      await store.addLocal(video, 'server', file.id)
    } finally { await deleteVideo(video) }
  })

  const remove = (id: string) => run('Se elimină…', async (signal) => {
    const next = items!.filter((item) => item.id !== id)
    // Detachment is acknowledged by prepare before the store may delete the file.
    await hdmi.replace(next)
    signal.throwIfAborted()
    const saved = await store.remove(id)
    if (!signal.aborted) setItems(saved)
  })
  const move = (from: number, to: number) => run('Se schimbă ordinea…', async (signal) => {
    await hdmi.control('pause')
    signal.throwIfAborted()
    const saved = await store.move(from, to)
    if (!signal.aborted) setItems(saved)
  })
  return { items, hdmi, preview, phase, progress, error, busy: !!phase || hdmi.busy,
    addDevice, addServer, remove, move, cancel: () => operation.current?.abort() }
}
