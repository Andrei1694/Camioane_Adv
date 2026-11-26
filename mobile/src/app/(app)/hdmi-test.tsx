import { useLocalSearchParams, useRouter } from 'expo-router'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { hdmiPlayer, unavailableMessage } from '../../../modules/hdmi-player'
import type { PlaybackState } from '../../../modules/hdmi-player'
import Button from '../../components/Button'
import Screen from '../../components/Screen'
import DimOverlay from '../../components/DimOverlay'
import { dimScreen } from '../../lib/screenBrightness'
import { colors, type } from '../../lib/theme'
import { useHdmiTest } from '../../lib/useHdmiTest'
import { useScreenDim } from '../../lib/useScreenDim'
import PlacementControls from '../../features/hdmi-placement/PlacementControls'

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
  const { sample, resultId } = useLocalSearchParams<{ sample?: string; resultId?: string }>()
  const truckScreen = sample === 'truck-screen'
  const { status, file, busy, ready, error, chooseVideo, control, placement, setPattern } = useHdmiTest(truckScreen ? 'truck-screen' : 'flower', resultId)
  const playing = status.playback === 'playing'
  const playbackActive = playing || status.playback === 'buffering'
  const { dimmed, dim, wake, error: dimError } = useScreenDim(playbackActive, playing)
  const prepared = file !== null && ['ready', 'playing', 'buffering', 'paused', 'stopped'].includes(status.playback)
  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">{truckScreen || resultId ? 'Truck screen video' : 'HDMI test'}</Text>
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
            {file?.source === 'sample' ? <Text style={styles.muted}>{file.sample === 'truck-screen'
              ? 'Included truck-screen video · 2304 × 512 · Three regions'
              : 'Included sample video'}</Text> : null}
            <Text style={styles.muted} accessibilityLiveRegion="polite">{status.pattern ? 'Calibration grid on HDMI · Video hidden' : playbackLabels[status.playback]}</Text>
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
            <Button label="Stop" disabled={!ready || busy || (!prepared && !status.pattern)} onPress={() => void control('stop')} />
            {dimScreen !== null ? (
              <Button label="Dim phone screen" disabled={!playing || busy} onPress={() => void dim()} />
            ) : null}
          </View>
          <PlacementControls status={status} placement={placement.placement} disabled={!ready}
            patternDisabled={!ready || busy || !status.display} error={placement.error}
            onChange={placement.update} onPattern={(enabled) => void setPattern(enabled)} />
          <Text style={styles.muted}>
            {Platform.OS === 'ios'
              ? 'After pressing Play, HDMI video continues when you switch apps or lock your iPhone. Return here to pause or stop. Dim phone screen also keeps playback running; press and hold to show controls again. '
              : 'To keep the phone dark while playing, use Dim phone screen instead of locking it. Press and hold to show controls again. On Android 11 and newer, switching apps keeps playback running. Locking may blank HDMI; dim the phone instead. Older Android versions pause when switching apps. '}
            Buffering recovers automatically. Opening the picker, an interruption, or disconnecting HDMI pauses playback and requires Play to resume. Leaving the HDMI test, signing out, or session expiry ends playback. Imported video copies are removed after cleanup succeeds.
          </Text>
        </>
      )}
      <Button label="Back" onPress={goBack} />
      {dimmed ? <DimOverlay wake={wake} buffering={status.playback === 'buffering'} /> : null}
    </Screen>
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
})
