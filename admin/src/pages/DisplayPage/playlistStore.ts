export interface PlaylistItem {
  id: string
  name: string
  source: 'device' | 'server'
  fileId?: string
  size: number
  type: string
}

export interface PlaylistVideo extends PlaylistItem { blob: Blob }

const writes = new Map<string, Promise<unknown>>()
let persistenceRequested = false

function decode(value: unknown): PlaylistItem | null {
  if (typeof value !== 'object' || value === null) return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(item.id)
    || typeof item.name !== 'string' || !item.name
    || (item.source !== 'device' && item.source !== 'server')
    || (item.fileId !== undefined && typeof item.fileId !== 'string')
    || (item.source === 'server' && !item.fileId)
    || typeof item.size !== 'number' || !Number.isSafeInteger(item.size) || item.size <= 0
    || item.type !== 'video/mp4') return null
  return { id: item.id, name: item.name, source: item.source, fileId: item.fileId, size: item.size, type: item.type }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('camioane-display', 1)
    let blocked = false
    request.onupgradeneeded = () => {
      request.result.createObjectStore('playlists')
      request.result.createObjectStore('videos')
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => {
      blocked = true
      reject(new Error('Închide celelalte ferestre de redare și reîncearcă deschiderea playlistului.'))
    }
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return }
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
  })
}

/** All requests, including the manifest update, run inside this single transaction. */
async function transact(userId: string, signal: AbortSignal, change?: (items: PlaylistVideo[], videos: IDBObjectStore) => PlaylistVideo[]) {
  signal.throwIfAborted()
  const database = await openDatabase()
  try {
    signal.throwIfAborted()
    return await new Promise<PlaylistVideo[]>((resolve, reject) => {
      const transaction = database.transaction(['playlists', 'videos'], change ? 'readwrite' : 'readonly')
      const manifests = transaction.objectStore('playlists')
      const videos = transaction.objectStore('videos')
      let result: PlaylistVideo[] = []
      let failure: unknown
      function abort() {
        try { transaction.abort() } catch { /* A committed transaction cannot be cancelled. */ }
      }
      signal.addEventListener('abort', abort, { once: true })
      transaction.oncomplete = () => {
        signal.removeEventListener('abort', abort)
        resolve(result)
      }
      transaction.onabort = () => {
        signal.removeEventListener('abort', abort)
        reject(signal.aborted ? signal.reason : failure ?? transaction.error)
      }
      function fail(error: unknown) { failure = error; transaction.abort() }
      function finish(items: PlaylistVideo[]) {
        try {
          signal.throwIfAborted()
          result = change ? change(items, videos) : items
          if (change) manifests.put(result.map(({ blob: _blob, ...item }) => item), userId)
        } catch (error) { fail(error) }
      }
      const manifest = manifests.get(userId)
      manifest.onsuccess = () => {
        const value: unknown = manifest.result
        if (value !== undefined && !Array.isArray(value)) {
          fail(new Error('Playlistul salvat nu este valid.'))
          return
        }
        const seen = new Set<string>()
        const items = (value ?? []).flatMap((entry: unknown) => {
          const item = decode(entry)
          if (!item || seen.has(item.id)) return []
          seen.add(item.id)
          return [item]
        })
        if (!items.length) { finish([]); return }
        const loaded: (PlaylistVideo | null)[] = items.map(() => null)
        let pending = items.length
        items.forEach((item, index) => {
          const request = videos.get(`${userId}/${item.id}`)
          request.onsuccess = () => {
            const blob: unknown = request.result
            if (blob instanceof Blob && blob.size === item.size) loaded[index] = { ...item, blob }
            pending -= 1
            if (!pending) finish(loaded.filter((entry): entry is PlaylistVideo => entry !== null))
          }
        })
      }
    })
  } finally { database.close() }
}

export function playlistError(error: unknown) {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'Nu mai este spațiu în acest browser. Elimină videoclipuri din playlist și încearcă din nou.'
  }
  if (error instanceof Error && !(error instanceof DOMException) && error.name !== 'ReferenceError') return error.message
  return 'Playlistul nu a putut fi citit sau salvat în acest browser. Verifică permisiunile de stocare și reîncearcă.'
}

export function createPlaylistStore(userId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) throw new Error('Identificatorul contului nu este valid.')

  function enqueue<T>(operation: () => Promise<T>) {
    const next = (writes.get(userId) ?? Promise.resolve()).catch(() => {}).then(operation)
    writes.set(userId, next)
    void next.finally(() => { if (writes.get(userId) === next) writes.delete(userId) }).catch(() => {})
    return next
  }

  function load(signal: AbortSignal) { return enqueue(() => transact(userId, signal)) }

  function add(blob: Blob, name: string, source: PlaylistItem['source'], signal: AbortSignal, fileId?: string) {
    return enqueue(async () => {
      signal.throwIfAborted()
      if (!persistenceRequested) {
        persistenceRequested = true
        // A denied persistence request still permits normal IndexedDB storage.
        try { await navigator.storage?.persist?.() } catch { /* Best effort. */ }
      }
      const item = decode({ id: crypto.randomUUID(), name, source, fileId, size: blob.size, type: 'video/mp4' })
      if (!item) throw new Error('Alege un fișier MP4 care nu este gol.')
      return transact(userId, signal, (items, videos) => {
        videos.put(blob, `${userId}/${item.id}`)
        return [...items, { ...item, blob }]
      })
    })
  }

  function remove(id: string, signal: AbortSignal) {
    return enqueue(() => transact(userId, signal, (items, videos) => {
      if (items.some((item) => item.id === id)) videos.delete(`${userId}/${id}`)
      return items.filter((item) => item.id !== id)
    }))
  }

  function move(from: number, to: number, signal: AbortSignal) {
    return enqueue(() => transact(userId, signal, (items) => {
      if (!Number.isInteger(from) || !Number.isInteger(to) || !items[from] || !items[to]) return items
      const next = [...items]
      next.splice(to, 0, next.splice(from, 1)[0])
      return next
    }))
  }

  return { load, add, remove, move }
}
