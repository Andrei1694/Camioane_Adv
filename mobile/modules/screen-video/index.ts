import Constants from 'expo-constants'
import { requireOptionalNativeModule } from 'expo-modules-core'
import type { ScreenMedia } from '../../src/features/screen/types'

export const screenMedia = Constants.executionEnvironment === 'storeClient'
  ? null : requireOptionalNativeModule<ScreenMedia>('ScreenVideo')
