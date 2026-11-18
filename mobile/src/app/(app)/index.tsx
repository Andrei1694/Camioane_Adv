import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import Button from '../../components/Button'
import Screen from '../../components/Screen'
import { useCurrentUser } from '../../auth/currentUser'
import { signOut, useSession } from '../../auth/session'
import { colors, radius, type } from '../../lib/theme'
import { roleLabels } from '../../lib/user'

export default function HomeScreen() {
  const user = useCurrentUser()
  const preview = useSession((state) => __DEV__ && state.preview)
  const router = useRouter()
  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">Your routes</Text>
      {/* The backend has no route, shift or fleet API yet; show that plainly rather than invent data. */}
      <View style={styles.emptyState}>
        <Text style={styles.muted}>Route and shift assignments aren't available in the app yet.</Text>
      </View>
      <View style={styles.account}>
        <Text style={styles.section} accessibilityRole="header">Display test</Text>
        <Text style={styles.muted}>Play a local video on HDMI while keeping controls on your phone.</Text>
        <Button label="HDMI test" onPress={() => router.push('/hdmi-test')} />
      </View>
      <View style={styles.account}>
        <Text style={styles.section} accessibilityRole="header">Account</Text>
        <View>
          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.meta}>{preview ? 'Local preview · Operator' : roleLabels[user.role]}</Text>
        </View>
        <Button label="Sign out" onPress={() => signOut()} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: {
    ...type.title,
    color: colors.text,
  },
  emptyState: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.controlBorder,
    borderRadius: radius.emptyState,
  },
  muted: {
    ...type.body,
    color: colors.muted,
  },
  account: {
    gap: 12,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  section: {
    ...type.section,
    color: colors.text,
  },
  email: {
    ...type.body,
    color: colors.text,
  },
  meta: {
    ...type.meta,
    color: colors.muted,
  },
})
