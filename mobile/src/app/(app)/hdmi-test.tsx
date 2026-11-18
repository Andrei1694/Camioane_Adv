import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { hdmiPlayer, unavailableMessage } from '../../../modules/hdmi-player'
import type { PlaybackState } from '../../../modules/hdmi-player'
import Button from '../../components/Button'
import Screen from '../../components/Screen'
import { dimScreen } from '../../lib/screenBrightness'
import { colors, type } from '../../lib/theme'
import { useHdmiTest } from '../../lib/useHdmiTest'
import { useScreenDim } from '../../lib/useScreenDim'

const playbackLabels: Record<PlaybackState, string> = {
  idle: 'Choose a video to begin',
  loading: 'Preparing video…',
  ready: 'Ready to play',
  playing: 'Playing on HDMI · Looping · Muted',
  buffering: 'Buffering…',
  paused: 'Paused · Press Play to resume',
  stopped: 'Stopped · External output is black',
  error: 'Video unavailable',
}

export default function HdmiTestScreen() {
  const router = useRouter()
  const { status, file, busy, ready, error, chooseVideo, control } = useHdmiTest()
  const playing = status.playback === 'playing'
  const playbackActive = playing || status.playback === 'buffering'
  const { dimmed, dim, wake, error: dimError } = useScreenDim(playbackActive, playing)
  const prepared = file !== null && ['ready', 'playing', 'buffering', 'paused', 'stopped'].includes(status.playback)
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/')

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">HDMI test</Text>
      <Text style={styles.body}>Video plays on the connected display. This phone shows controls only.</Text>
      {!hdmiPlayer ? (
        <Text style={styles.muted}>{unavailableMessage}</Text>
      ) : (
        <>
          <View style={styles.section} accessibilityLiveRegion="polite">
            <Text style={styles.heading} accessibilityRole="header">External display</Text>
            <Text style={styles.body}>{status.display?.name ?? 'No external display connected'}</Text>
            <Text style={styles.muted}>
              {status.display
                ? `${status.display.width} × ${status.display.height} pixels`
                : 'Connect your phone to HDMI using a compatible adapter.'}
            </Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.heading} accessibilityRole="header">Video</Text>
            <Text style={styles.body} selectable>{file?.name ?? 'No video selected'}</Text>
            {file?.source === 'sample' ? <Text style={styles.muted}>Included sample video</Text> : null}
            <Text style={styles.muted} accessibilityLiveRegion="polite">{playbackLabels[status.playback]}</Text>
            <Button label={busy ? 'Please wait…' : 'Choose video'} disabled={!ready || busy} onPress={() => void chooseVideo()} />
          </View>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          {dimError ? <Text style={styles.error} accessibilityRole="alert">{dimError}</Text> : null}
          <View style={styles.actions}>
            <Button
              variant="primary"
              label={playbackActive ? 'Pause' : 'Play'}
              disabled={!ready || busy || !prepared || (!playbackActive && !status.display)}
              onPress={() => void control(playbackActive ? 'pause' : 'play')}
            />
            <Button label="Stop" disabled={!ready || busy || !prepared} onPress={() => void control('stop')} />
            {dimScreen !== null ? (
              <Button label="Dim phone screen" disabled={!playing || busy} onPress={() => void dim()} />
            ) : null}
          </View>
          <Text style={styles.muted}>
            {Platform.OS === 'ios'
              ? 'After pressing Play, HDMI video continues when you switch apps or lock your iPhone. Return here to pause or stop. Dim phone screen also keeps playback running; press and hold to show controls again. '
              : 'To keep the phone dark while playing, use Dim phone screen instead of locking it. Press and hold to show controls again. Switching apps or locking your phone pauses playback. '}
            Buffering recovers automatically. Opening the picker, an interruption, or disconnecting HDMI pauses playback and requires Play to resume. Leaving the HDMI test, signing out, or session expiry ends playback. Imported video copies are removed after cleanup succeeds.
          </Text>
        </>
      )}
      <Button label="Back" onPress={goBack} />
      {dimmed ? <DimOverlay wake={wake} buffering={status.playback === 'buffering'} /> : null}
    </Screen>
  )
}

function DimOverlay({ wake, buffering }: { wake: () => void; buffering: boolean }) {
  return (
    <Modal animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={wake}>
      <StatusBar hidden />
      <Pressable
        style={styles.dimOverlay}
        onLongPress={wake}
        delayLongPress={1000}
        accessibilityRole="button"
        accessibilityLabel="Press and hold for one second to show controls"
        accessibilityActions={[{ name: 'activate', label: 'Show controls' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'activate') wake()
        }}
      >
        <Text style={styles.dimHint} accessibilityLiveRegion="polite">
          {buffering ? 'Buffering…' : 'Video is playing on HDMI.'} Press and hold to show controls.
        </Text>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  title: { ...type.title, color: colors.text },
  heading: { ...type.section, color: colors.text },
  body: { ...type.body, color: colors.text },
  muted: { ...type.body, color: colors.muted },
  error: { ...type.body, color: colors.danger },
  section: { gap: 10, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border },
  actions: { gap: 12 },
  dimOverlay: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', padding: 32 },
  dimHint: { ...type.body, color: colors.muted, textAlign: 'center' },
})
