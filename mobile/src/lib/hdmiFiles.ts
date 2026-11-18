import { Asset } from 'expo-asset'
import { getDocumentAsync } from 'expo-document-picker'
import { File } from 'expo-file-system'

export type SampleVideo = 'flower' | 'truck-screen'
export interface HdmiVideo { uri: string; name: string; source: 'sample' | 'imported'; sample?: SampleVideo }

export async function loadSampleVideo(sample: SampleVideo = 'flower'): Promise<HdmiVideo> {
  const module = sample === 'truck-screen' ? require('../../assets/truck_screen.mp4') : require('../../assets/flower.mp4')
  const asset = await Asset.fromModule(module).downloadAsync()
  if (!asset.localUri) throw new Error('The included sample could not be loaded.')
  return { uri: asset.localUri, name: sample === 'truck-screen' ? 'sample-10s (ecran camion).mp4' : 'flower.mp4', source: 'sample', sample }
}

export async function pickVideo(): Promise<HdmiVideo | null> {
  const result = await getDocumentAsync({ type: 'video/*', multiple: false, copyToCacheDirectory: true })
  if (result.canceled) return null
  const asset = result.assets[0]
  return { uri: asset.uri, name: asset.name, source: 'imported' }
}

/** Imported files are picker copies; bundled samples must survive session cleanup. */
export function deleteVideoCopy(video: HdmiVideo) {
  if (video.source === 'sample') return
  const file = new File(video.uri)
  if (file.exists) file.delete()
}
