import { StatusBar } from 'expo-status-bar'
import { Modal, Pressable, StyleSheet, Text } from 'react-native'
import { colors, type } from '../lib/theme'

export default function DimOverlay({ wake, buffering, romanian = false }: { wake: () => void; buffering: boolean; romanian?: boolean }) {
  return (
    <Modal animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={wake}>
      <StatusBar hidden />
      <Pressable
        style={styles.dimOverlay}
        onLongPress={wake}
        delayLongPress={1000}
        accessibilityRole="button"
        accessibilityLabel={romanian ? 'Ține apăsat o secundă pentru a afișa comenzile' : 'Press and hold for one second to show controls'}
        accessibilityActions={[{ name: 'activate', label: romanian ? 'Arată comenzile' : 'Show controls' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'activate') wake()
        }}
      >
        <Text style={styles.dimHint} accessibilityLiveRegion="polite">
          {romanian
            ? `${buffering ? 'Se încarcă…' : 'Redare pe HDMI.'} Ține apăsat pentru a afișa comenzile.`
            : `${buffering ? 'Buffering…' : 'Video is playing on HDMI.'} Press and hold to show controls.`}
        </Text>
      </Pressable>
    </Modal>
  )
}


const styles = StyleSheet.create({
  dimOverlay: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', padding: 32 },
  dimHint: { ...type.body, color: colors.muted, textAlign: 'center' },
})
