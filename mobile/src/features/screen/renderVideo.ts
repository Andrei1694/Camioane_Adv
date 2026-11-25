import { screenMedia } from '../../../modules/screen-video/index'
import { allocateVideo, completeVideo, deleteVideo } from './videoFiles'
import { abortError } from './types'
import type { Composition, LocalVideo } from './types'

export async function renderVideo(id: string, source: LocalVideo, name: string, composition: Composition,
  signal: AbortSignal, onProgress: (fraction: number) => void) {
  if (!screenMedia) throw new Error('Conversia necesită o versiune nouă a aplicației instalate.')
  const output = allocateVideo(name)
  const subscription = screenMedia.addListener('onProgress', (event) => { if (event.id === id && !signal.aborted) onProgress(event.progress) })
  const cancel = () => { void screenMedia?.cancel(id).catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    if (signal.aborted) throw abortError()
    await screenMedia.render(id, source.uri, output.uri, JSON.stringify(composition))
    if (signal.aborted) throw abortError()
    return completeVideo(output)
  } catch (error) {
    // render settles only after its media readers/writer are detached.
    await deleteVideo(output)
    throw error
  } finally {
    subscription.remove()
    signal.removeEventListener('abort', cancel)
  }
}
