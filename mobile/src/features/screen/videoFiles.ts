import { getDocumentAsync } from 'expo-document-picker'
import { Directory, File, Paths } from 'expo-file-system'
import type { LocalVideo } from './types'

let nextFile = 0
export function allocateVideo(name: string): LocalVideo {
  const directory = new Directory(Paths.cache, `screen-${Date.now()}-${++nextFile}`)
  directory.create()
  const safeName = Array.from(name, (character) => character.charCodeAt(0) < 32 || /[\\/]/.test(character) ? '_' : character).join('')
  const file = new File(directory, safeName.slice(-180) || 'video.mp4')
  return { uri: file.uri, name, size: 0 }
}

export function completeVideo(video: LocalVideo): LocalVideo {
  const file = new File(video.uri)
  if (!file.exists || !file.size) throw new Error('Videoclipul rezultat este gol.')
  return { ...video, size: file.size }
}

export async function deleteVideo(video: LocalVideo) {
  const file = new File(video.uri)
  if (file.exists) file.delete()
  // Only our private, single-file directories are removed, never a picker/provider directory.
  const parent = file.parentDirectory
  if (parent.uri.startsWith(Paths.cache.uri) && /\/screen-\d+-\d+\/$/.test(parent.uri) && parent.exists) parent.delete()
}

export async function copyVideo(video: LocalVideo): Promise<LocalVideo> {
  const copy = allocateVideo(video.name)
  try {
    await new File(video.uri).copy(new File(copy.uri))
    return completeVideo(copy)
  } catch (error) {
    await deleteVideo(copy)
    throw error
  }
}

export async function pickMp4(): Promise<LocalVideo | null> {
  const result = await getDocumentAsync({ type: 'video/mp4', multiple: false, copyToCacheDirectory: true })
  if (result.canceled) return null
  const asset = result.assets[0]
  const video = { uri: asset.uri, name: asset.name, size: asset.size ?? new File(asset.uri).size }
  if (!video.size || (asset.mimeType ? asset.mimeType !== 'video/mp4' : !/\.mp4$/i.test(asset.name))) {
    await deleteVideo(video)
    throw new Error('Alege un fișier MP4 care nu este gol.')
  }
  return video
}
