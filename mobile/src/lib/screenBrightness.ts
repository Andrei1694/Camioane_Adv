import { getBrightnessAsync, restoreSystemBrightnessAsync, setBrightnessAsync } from 'expo-brightness'
import { Platform } from 'react-native'

export async function dimScreen(): Promise<() => Promise<void>> {
  let restore = restoreSystemBrightnessAsync
  if (Platform.OS === 'ios') {
    const brightness = await getBrightnessAsync()
    restore = () => setBrightnessAsync(brightness)
  }

  try {
    await setBrightnessAsync(0)
  } catch (error) {
    await restore().catch(() => {})
    throw error
  }
  return restore
}
