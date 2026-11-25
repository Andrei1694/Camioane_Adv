import type { placement } from './screenLayout'

export interface LocalVideo { uri: string; name: string; size: number }
export interface MediaInfo { width: number; height: number; duration: number }
export interface Composition {
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  regions: ReturnType<typeof placement>[]
}
export interface PlaybackEvent { id: string; time: number; playing: boolean; error?: string }
export interface ProgressEvent { id: string; progress: number }
export interface ScreenMedia {
  open(id: string, uri: string): Promise<MediaInfo>
  layout(id: string, composition: string): Promise<void>
  play(id: string): Promise<void>
  pause(id: string): Promise<void>
  seek(id: string, seconds: number): Promise<void>
  release(id: string): Promise<void>
  render(id: string, uri: string, output: string, composition: string): Promise<void>
  cancel(id: string): Promise<void>
  addListener(event: 'onPlayback', listener: (value: PlaybackEvent) => void): { remove(): void }
  addListener(event: 'onProgress', listener: (value: ProgressEvent) => void): { remove(): void }
}

export function abortError() {
  const error = new Error('Operația a fost anulată.')
  error.name = 'AbortError'
  return error
}

export function mediaError(error: unknown) {
  return error instanceof Error ? error.message : 'Videoclipul nu a putut fi procesat. Încearcă din nou.'
}
