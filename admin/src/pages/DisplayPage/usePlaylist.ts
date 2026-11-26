import { useEffect, useMemo, useRef, useState } from 'react'
import { useCurrentUser } from '../../auth/currentUser'
import { api, ApiError, errorMessage } from '../../lib/api'
import { declaredTypeError } from '../../lib/file'
import type { StoredFile } from '../../lib/file'
import { createPlaylistStore, playlistError } from './playlistStore'
import type { PlaylistVideo } from './playlistStore'

export function mp4Error(file: File) {
  return declaredTypeError(file)
    ?? ((file.type ? file.type !== 'video/mp4' : !/\.mp4$/i.test(file.name)) ? 'Alege un videoclip MP4.' : undefined)
}

export function usePlaylist() {
  const user = useCurrentUser()
  const store = useMemo(() => createPlaylistStore(user.id), [user.id])
  const [items, setItems] = useState<PlaylistVideo[] | null>(null)
  const [operation, setOperation] = useState('Se încarcă playlistul…')
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  const alive = useRef(false)

  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    pending.current = controller
    void store.load(controller.signal).then((next) => {
      if (!controller.signal.aborted) setItems(next)
    }).catch((failure) => {
      if (alive.current && pending.current === controller) {
        setError(controller.signal.aborted ? 'Încărcarea playlistului a fost anulată. Reîncearcă pentru a-l deschide.' : playlistError(failure))
      }
    }).finally(() => {
      if (pending.current === controller) { pending.current = null; setOperation('') }
    })
    return () => { alive.current = false; pending.current?.abort(); pending.current = null }
  }, [store])

  async function run(label: string, work: (signal: AbortSignal) => Promise<unknown>) {
    if (!alive.current || pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setOperation(label)
    setError('')
    try { await work(controller.signal) } catch (failure) {
      if (alive.current && !controller.signal.aborted) setError(failure instanceof ApiError ? errorMessage(failure) : playlistError(failure))
    } finally {
      // Re-read even after cancellation: earlier files in a multi-file add may be committed.
      if (alive.current) {
        const refresh = new AbortController()
        pending.current = refresh
        try {
          const next = await store.load(refresh.signal)
          if (alive.current && !refresh.signal.aborted) setItems(next)
        } catch (failure) {
          if (alive.current && !refresh.signal.aborted) setError(playlistError(failure))
        }
        if (pending.current === refresh) { pending.current = null; setOperation('') }
      }
    }
  }

  function addLocal(files: File[]) {
    return run('Se adaugă din calculator…', async (signal) => {
      for (const file of files) {
        signal.throwIfAborted()
        const invalid = mp4Error(file)
        if (invalid) throw new Error(`„${file.name}”: ${invalid} Fișierele adăugate anterior au fost păstrate.`)
        await store.add(file, file.name, 'device', signal)
      }
    })
  }

  function addServer(file: StoredFile) {
    return run('Se descarcă…', async (signal) => {
      if (file.mimeType !== 'video/mp4') throw new Error('Alege un fișier MP4.')
      const blob = await api.downloadFile(file, signal)
      signal.throwIfAborted()
      setOperation('Se salvează în playlist…')
      await store.add(blob, file.originalName, 'server', signal, file.id)
    })
  }

  function remove(id: string) { return run('Se elimină…', (signal) => store.remove(id, signal)) }
  function move(from: number, to: number) { return run('Se schimbă ordinea…', (signal) => store.move(from, to, signal)) }
  function retry() { return run('Se încarcă playlistul…', (signal) => store.load(signal)) }
  function cancel() { pending.current?.abort() }

  return { items, operation, error, busy: !!operation, addLocal, addServer, remove, move, retry, cancel }
}
