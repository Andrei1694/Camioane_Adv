import { getDocumentAsync } from 'expo-document-picker'
import type { LocalVideo } from './types'

export function fromBlob(blob: Blob, name: string): LocalVideo {
  return { uri: URL.createObjectURL(blob), name, size: blob.size }
}
export async function deleteVideo(video: LocalVideo) { URL.revokeObjectURL(video.uri) }
export async function copyVideo(video: LocalVideo) { return fromBlob(await (await fetch(video.uri)).blob(), video.name) }
export function allocateVideo(name: string): LocalVideo { return { uri: '', name, size: 0 } }
export function completeVideo(video: LocalVideo) { return video }

export async function pickMp4(): Promise<LocalVideo | null> {
  const result = await getDocumentAsync({ type: 'video/mp4', multiple: false, base64: false })
  if (result.canceled) return null
  const asset = result.assets[0]
  const file = asset.file
  // The picker creates its own object URL even when returning a File.
  URL.revokeObjectURL(asset.uri)
  if (!file?.size || (file.type ? file.type !== 'video/mp4' : !/\.mp4$/i.test(file.name))) {
    throw new Error('Alege un fișier MP4 care nu este gol.')
  }
  return fromBlob(file, asset.name)
}
