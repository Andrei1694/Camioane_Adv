import Constants from 'expo-constants'
import { requireOptionalNativeModule } from 'expo-modules-core'
import type { HdmiPlayer } from './src/types'

// Do not try to load a custom module in Expo Go; importing a route must never crash it.
export const hdmiPlayer = Constants.executionEnvironment === 'storeClient'
  ? null
  : requireOptionalNativeModule<HdmiPlayer>('HdmiPlayer')

export const unavailableMessage = 'HDMI playback needs a Camioane development build installed on an Android phone or iPhone. It is not available in Expo Go.'
export type { HdmiStatus, PlaybackState } from './src/types'
