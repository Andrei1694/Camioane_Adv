import { Stack } from 'expo-router'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import Button from '../../components/Button'
import Screen from '../../components/Screen'
import { UserContext } from '../../auth/currentUser'
import { signOut, useSession } from '../../auth/session'
import { api, errorMessage } from '../../lib/api'
import { colors, type } from '../../lib/theme'
import { appRoles, roleLabels } from '../../lib/user'

// Mirrors frontend/src/auth/Authenticated.tsx: every session is checked with GET /users/me
// before any signed-in screen renders, and again whenever the app returns to the foreground.
function VerifiedApp({ revision }: { revision: number }) {
  const current = useQuery({
    queryKey: ['me', revision],
    queryFn: ({ signal }) => api.me(signal),
  })

  if (current.isPending || (!current.isFetchedAfterMount && !current.isError)) {
    return (
      <View style={styles.centered} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.body}>Signing in…</Text>
      </View>
    )
  }

  if (!current.data || current.isError) {
    return (
      <Screen>
        <Text style={styles.title} accessibilityRole="header">Could not verify your session</Text>
        <Text style={styles.error} accessibilityRole="alert">{errorMessage(current.error)}</Text>
        <View style={styles.actions}>
          <Button variant="primary" label={current.isFetching ? 'Checking…' : 'Retry'} disabled={current.isFetching} onPress={() => void current.refetch()} />
          <Button label="Sign out" onPress={() => signOut()} />
        </View>
      </Screen>
    )
  }

  const user = current.data
  if (!appRoles.includes(user.role)) {
    return (
      <Screen>
        <Text style={styles.title} accessibilityRole="header">This app is for drivers and operators</Text>
        <Text style={styles.body}>
          You're signed in as {user.email} with the {roleLabels[user.role]} role. Ask an administrator for a driver or
          operator account, or use the web dashboard.
        </Text>
        <Button label="Sign out" onPress={() => signOut()} />
      </Screen>
    )
  }

  return (
    <UserContext.Provider value={user}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
    </UserContext.Provider>
  )
}

export default function AppLayout() {
  const signedIn = useSession((state) => state.session !== null)
  const revision = useSession((state) => state.revision)
  // On sign-out this group can render once more before the navigator removes it; skip the
  // session check then rather than call the API without a token.
  if (!signedIn) return null
  // A session change remounts every signed-in screen, as the web app's root layout does.
  return <VerifiedApp key={revision} revision={revision} />
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.surface,
  },
  title: {
    ...type.title,
    color: colors.text,
  },
  body: {
    ...type.body,
    color: colors.text,
  },
  error: {
    ...type.body,
    color: colors.danger,
  },
  actions: {
    gap: 12,
  },
})
