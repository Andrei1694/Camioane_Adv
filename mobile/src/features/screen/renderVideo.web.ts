import { fromBlob } from './videoFiles.web'
import type { Composition, LocalVideo } from './types'

export async function renderVideo(_id: string, source: LocalVideo, name: string, composition: Composition,
  signal: AbortSignal, onProgress: (fraction: number) => void) {
  const { renderScreen } = await import('./renderScreen.web')
  const blob = await (await fetch(source.uri, { signal })).blob()
  const output = await renderScreen(blob, composition, { signal, onProgress })
  signal.throwIfAborted()
  return fromBlob(output, name)
}
