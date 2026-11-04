import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { QueryClientProvider } from '@tanstack/react-query'
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular'
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium'
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold'
import { hydrateSession, startSessionSync, useSession } from '../auth/session'
import { queryClient } from '../lib/queryClient'
import { colors } from '../lib/theme'

// Keep the splash screen up until the fonts and the saved session are ready.
void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold })
  const hydrated = useSession((state) => state.hydrated)
  const signedIn = useSession((state) => state.session !== null)
  // A font that fails to load falls back to the system face rather than blocking the app.
  const ready = hydrated && (fontsLoaded || fontError !== null)

  useEffect(() => {
    void hydrateSession()
    return startSessionSync()
  }, [])

  useEffect(() => {
    if (ready) SplashScreen.hide()
  }, [ready])

  if (!ready) return null

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  )
}
