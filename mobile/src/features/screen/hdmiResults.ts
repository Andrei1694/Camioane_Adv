import { useSession } from '../../auth/session'
import { copyVideo, deleteVideo } from './videoFiles'
import type { LocalVideo } from './types'
import type { HdmiVideo } from '../../lib/hdmiFiles'

const results = new Map<string, { video: LocalVideo; revision: number; timer: ReturnType<typeof setTimeout> }>()
let nextResult = 0
function discard(id: string) {
  const entry = results.get(id)
  if (!entry) return
  results.delete(id)
  clearTimeout(entry.timer)
  void deleteVideo(entry.video).catch(() => {})
}
useSession.subscribe((state) => {
  for (const [id, entry] of results) if (entry.revision !== state.revision) discard(id)
})

export async function prepareHdmiResult(video: LocalVideo) {
  const revision = useSession.getState().revision
  const copy = await copyVideo(video)
  if (revision !== useSession.getState().revision) { await deleteVideo(copy); throw new Error('Sesiunea s-a încheiat.') }
  const id = `result-${Date.now()}-${++nextResult}`
  results.set(id, { video: copy, revision, timer: setTimeout(() => discard(id), 60_000) })
  return id
}

export async function takeHdmiResult(id: string): Promise<HdmiVideo> {
  const entry = results.get(id)
  if (!entry || entry.revision !== useSession.getState().revision) throw new Error('Videoclipul nu mai este disponibil. Redeschide-l din editor.')
  results.delete(id)
  clearTimeout(entry.timer)
  return { ...entry.video, source: 'imported' }
}
