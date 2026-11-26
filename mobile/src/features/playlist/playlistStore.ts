import { Directory, File, Paths } from 'expo-file-system'
import type { PlaylistItem, PlaylistStore } from './types'

// Shared across hook instances, including navigation and rapid account changes.
const writes = new Map<string, Promise<unknown>>()
let nextFile = 0

function decode(value: unknown): PlaylistItem | null {
  if (typeof value !== 'object' || value === null) return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(item.id)
    || typeof item.name !== 'string' || !item.name
    || (item.source !== 'device' && item.source !== 'server')
    || (item.fileId !== undefined && typeof item.fileId !== 'string')
    || (item.source === 'server' && !item.fileId)
    || typeof item.size !== 'number' || !Number.isSafeInteger(item.size) || item.size <= 0
    || item.file !== `videos/${item.id}.mp4`) return null
  return { id: item.id, name: item.name, source: item.source, fileId: item.fileId, size: item.size, file: item.file }
}

export function createPlaylistStore(userId: string, assertActive: () => void): PlaylistStore {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) throw new Error('Identificatorul contului nu este valid.')
  const key = userId
  const root = new Directory(Paths.document, 'hdmi-playlist', key)
  const videos = new Directory(root, 'videos')
  const manifest = new File(root, 'playlist.json')
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(() => {
      assertActive()
      return operation()
    })
    writes.set(key, next)
    void next.finally(() => { if (writes.get(key) === next) writes.delete(key) }).catch(() => {})
    return next
  }
  async function read() {
    if (!manifest.exists) return []
    const value: unknown = JSON.parse(await manifest.text())
    if (!Array.isArray(value)) throw new Error('Playlistul salvat nu este valid.')
    const seen = new Set<string>()
    return value.flatMap((entry) => {
      const item = decode(entry)
      if (!item || seen.has(item.id) || !new File(root, item.file).exists) return []
      seen.add(item.id)
      return [item]
    })
  }
  async function save(items: PlaylistItem[]) {
    assertActive()
    root.create({ intermediates: true, idempotent: true })
    const temporary = new File(root, 'playlist.next.json')
    await temporary.write(JSON.stringify(items))
    assertActive()
    await temporary.move(manifest, { overwrite: true })
    return items
  }
  return {
    load: () => enqueue(read),
    uri: (item) => new File(root, item.file).uri,
    addLocal: (video, source, fileId) => enqueue(async () => {
      const items = await read()
      assertActive()
      const original = new File(video.uri)
      if (!original.exists || !original.size) throw new Error('Alege un fișier MP4 care nu este gol.')
      const id = `${Date.now()}-${++nextFile}-${Math.random().toString(36).slice(2)}`
      const item: PlaylistItem = { id, name: video.name, source, fileId, size: original.size, file: `videos/${id}.mp4` }
      videos.create({ intermediates: true, idempotent: true })
      const destination = new File(root, item.file)
      await original.move(destination)
      try { return await save([...items, item]) } catch (error) {
        // This new file has never been handed to native playback.
        if (destination.exists) destination.delete()
        throw error
      }
    }),
    remove: (id) => enqueue(async () => {
      const items = await read()
      const item = items.find((entry) => entry.id === id)
      const next = await save(items.filter((entry) => entry.id !== id))
      if (item) {
        const file = new File(root, item.file)
        if (file.exists) file.delete()
      }
      return next
    }),
    move: (from, to) => enqueue(async () => {
      const items = await read()
      if (!Number.isInteger(from) || !Number.isInteger(to) || !items[from] || !items[to]) return items
      const next = [...items]
      next.splice(to, 0, next.splice(from, 1)[0])
      return save(next)
    }),
  }
}
