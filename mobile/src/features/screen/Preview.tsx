import { requireNativeViewManager } from 'expo-modules-core'
import { View } from 'react-native'
import type { ViewProps } from 'react-native'
import { screenMedia } from '../../../modules/screen-video/index'
import type { Resolution } from './screenLayout'

const NativePreview = screenMedia ? requireNativeViewManager<ViewProps & { sessionId: string }>('ScreenVideo') : null
export default function Preview({ sessionId, resolution }: { sessionId: string; resolution: Resolution }) {
  const aspectRatio = resolution.width / resolution.height
  return NativePreview
    ? <NativePreview sessionId={sessionId} style={{ width: '100%', aspectRatio }} accessibilityLabel="Previzualizarea celor trei regiuni" />
    : <View style={{ width: '100%', aspectRatio, backgroundColor: '#000' }} />
}
