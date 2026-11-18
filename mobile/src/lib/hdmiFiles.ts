import { Asset } from 'expo-asset'
import { getDocumentAsync } from 'expo-document-picker'
import { File } from 'expo-file-system'

export interface HdmiVideo { uri: string; name: string; source: 'sample' | 'imported' }

export async function loadSampleVideo(): Promise<HdmiVideo> {
  const asset = await Asset.fromModule(require('../../assets/flower.mp4')).downloadAsync()
  if (!asset.localUri) throw new Error('The included sample could not be loaded.')
  return { uri: asset.localUri, name: 'flower.mp4', source: 'sample' }
}

export async function pickVideo(): Promise<HdmiVideo | null> {
  const result = await getDocumentAsync({ type: 'video/*', multiple: false, copyToCacheDirectory: true })
  if (result.canceled) return null
  const asset = result.assets[0]
  return { uri: asset.uri, name: asset.name, source: 'imported' }
}

/** Imported files are picker copies; the shared sample must survive session cleanup. */
export function deleteVideoCopy(video: HdmiVideo) {
  if (video.source === 'sample') return
  const file = new File(video.uri)
  if (file.exists) file.delete()
}
