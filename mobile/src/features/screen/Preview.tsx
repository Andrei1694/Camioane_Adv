import { requireNativeViewManager } from 'expo-modules-core'
import { View } from 'react-native'
import type { ViewProps } from 'react-native'
import { screenMedia } from '../../../modules/screen-video/index'

const NativePreview = screenMedia ? requireNativeViewManager<ViewProps & { sessionId: string }>('ScreenVideo') : null
export default function Preview({ sessionId }: { sessionId: string }) {
  return NativePreview
    ? <NativePreview sessionId={sessionId} style={{ width: '100%', aspectRatio: 4.5 }} accessibilityLabel="Previzualizarea celor trei regiuni" />
    : <View style={{ width: '100%', aspectRatio: 4.5, backgroundColor: '#000' }} />
}
