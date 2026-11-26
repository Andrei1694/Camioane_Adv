import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import type { HdmiPlacement, HdmiStatus } from '../../../modules/hdmi-player'
import Button from '../../components/Button'
import { colors, radius, type } from '../../lib/theme'
import { defaultPlacement, formatScale } from './placement'

interface Props {
  status: HdmiStatus
  placement: HdmiPlacement
  disabled: boolean
  patternDisabled: boolean
  error: string
  onChange: (placement: HdmiPlacement) => void
  onPattern: (enabled: boolean) => void
}

const steps = [-64, -8, -1, 1, 8, 64]

export default function PlacementControls({ status, placement, disabled, patternDisabled, error, onChange, onPattern }: Props) {
  const { display, video } = status
  const modes = [...new Set(status.modes.map((mode) => `${mode.width} × ${mode.height}`))]
  const widthScale = display && video ? display.width / video.width : 0
  const heightScale = display && video ? display.height / video.height : 0
  const truckModeTooSmall = video?.width === 2304 && video.height === 512 && display
    && (display.width < 2304 || display.height < 512)
  // Use acknowledged native placement so a failed adjustment cannot misreport cropping.
  const applied = status.placement
  const width = video ? Math.round(video.width * applied.scale) : 0
  const height = video ? Math.round(video.height * applied.scale) : 0
  const clipped = display && video ? [
    { edge: 'on the right', pixels: Math.min(width, Math.max(0, applied.x + width - display.width)) },
    { edge: 'at the bottom', pixels: Math.min(height, Math.max(0, applied.y + height - display.height)) },
    { edge: 'on the left', pixels: Math.min(width, Math.max(0, -applied.x)) },
    { edge: 'at the top', pixels: Math.min(height, Math.max(0, -applied.y)) },
  ].filter((edge) => edge.pixels > 0) : []

  return <View style={styles.section}>
    <Text style={styles.heading} accessibilityRole="header">HDMI placement</Text>
    <Text style={styles.body}>HDMI mode: {display ? `${display.width} × ${display.height} px` : 'No display connected'}</Text>
    <Text style={styles.muted}>Offered modes: {modes.length ? modes.map((mode) => mode === '2304 × 512' ? `${mode} (truck canvas)` : mode).join(', ') : 'Unavailable until connected'}</Text>
    <Text style={styles.body}>Video: {video ? `${video.width} × ${video.height} px` : 'Waiting for video size'}</Text>
    <Text style={styles.muted}>Saved on this phone for the test and playlist. 100% places one video pixel on one HDMI pixel. The frame crops anything outside its edges.</Text>
    {(['x', 'y'] as const).map((axis) => <View key={axis} style={styles.group}>
      <NumericField label={`${axis.toUpperCase()} offset (px)`} value={placement[axis]} min={-4096} max={4096} integer disabled={disabled}
        onApply={(value) => onChange({ ...placement, [axis]: value })} />
      <View style={styles.steps}>
        {steps.map((step) => {
          const value = placement[axis] + step
          const inactive = disabled || value < -4096 || value > 4096
          return <Pressable key={step} accessibilityRole="button" accessibilityLabel={`${axis.toUpperCase()} ${step > 0 ? 'plus' : 'minus'} ${Math.abs(step)} pixels`}
            accessibilityState={{ disabled: inactive }} disabled={inactive}
            onPress={() => onChange({ ...placement, [axis]: value })}
            style={({ pressed }) => [styles.step, pressed && styles.pressed, inactive && styles.disabled]}>
            <Text style={styles.label}>{step > 0 ? '+' : '−'}{Math.abs(step)}</Text>
          </Pressable>
        })}
      </View>
    </View>)}
    <NumericField label="Scale (%)" value={placement.scale * 100} min={10} max={400} disabled={disabled}
      onApply={(value) => onChange({ ...placement, scale: value / 100 })} />
    <View style={styles.row}>
      <Button label="100%" disabled={disabled} onPress={() => onChange({ ...placement, scale: 1 })} />
      <Button label="Fit width" disabled={disabled || widthScale < 0.1 || widthScale > 4}
        onPress={() => onChange({ ...placement, scale: widthScale })} />
      <Button label="Fit height" disabled={disabled || heightScale < 0.1 || heightScale > 4}
        onPress={() => onChange({ ...placement, scale: heightScale })} />
    </View>
    <Text style={styles.muted}>Scale: {formatScale(placement.scale)} · Allowed: 10–400%. Fit uses the HDMI frame size and keeps X/Y. Fit needs a known video and display size within this range.</Text>
    <Button label="Reset to 1:1 at 0,0" disabled={disabled} onPress={() => onChange({ ...defaultPlacement })} />
    <View style={styles.toggle}>
      <Text style={[styles.label, styles.toggleLabel]}>Calibration grid</Text>
      <Switch accessibilityLabel="Calibration grid" value={status.pattern} disabled={patternDisabled} onValueChange={onPattern} />
    </View>
    <Text style={styles.muted}>The grid replaces the video with fixed HDMI coordinates. Read the labels at each panel’s corners, then turn it off to check your video adjustments. Stop also clears the grid.</Text>
    {clipped.length ? <Text style={styles.error} accessibilityLiveRegion="polite">
      {clipped.map((edge) => `${edge.pixels} px cut off ${edge.edge}`).join(' / ')}. {truckModeTooSmall
        ? 'A 2304 × 512 HDMI mode is needed to show the full truck canvas at 1:1.'
        : 'Adjust X/Y or scale to bring the video inside the HDMI frame.'}
    </Text> : null}
    {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
  </View>
}

function NumericField({ label, value, min, max, integer = false, disabled, onApply }: {
  label: string; value: number; min: number; max: number; integer?: boolean; disabled: boolean; onApply: (value: number) => void
}) {
  const [text, setText] = useState(String(Number(value.toFixed(6))))
  const [previousValue, setPreviousValue] = useState(value)
  const [error, setError] = useState('')
  const [focused, setFocused] = useState(false)
  if (previousValue !== value) {
    setPreviousValue(value)
    setText(String(Number(value.toFixed(6))))
    setError('')
  }

  function apply() {
    const next = text.trim() ? Number(text.replace(',', '.')) : NaN
    if (!Number.isFinite(next) || next < min || next > max || (integer && !Number.isInteger(next))) {
      setError(`Enter ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}.`)
      return
    }
    setError('')
    onApply(next)
  }

  return <View style={styles.group}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.row}>
      <TextInput accessibilityLabel={label} value={text} editable={!disabled}
        keyboardType={integer ? (Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default') : 'decimal-pad'}
        onChangeText={setText} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onSubmitEditing={apply} returnKeyType="done" selectTextOnFocus
        style={[styles.input, focused && styles.focused, !!error && styles.invalid, disabled && styles.disabled]} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Apply ${label}`} accessibilityState={{ disabled }} disabled={disabled}
        onPress={apply} style={({ pressed }) => [styles.apply, pressed && styles.pressed, disabled && styles.disabled]}>
        <Text style={styles.label}>Apply</Text>
      </Pressable>
    </View>
    {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
  </View>
}

const styles = StyleSheet.create({
  section: { gap: 12, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border },
  heading: { ...type.section, color: colors.text }, body: { ...type.body, color: colors.text },
  muted: { ...type.meta, color: colors.muted }, label: { ...type.label, color: colors.text },
  error: { ...type.body, color: colors.danger }, group: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  step: { minWidth: 44, minHeight: 44, flexGrow: 1, paddingHorizontal: 6, paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.controlBorder, borderRadius: radius.control },
  apply: { minWidth: 44, minHeight: 44, paddingHorizontal: 16, justifyContent: 'center',
    borderWidth: 1, borderColor: colors.controlBorder, borderRadius: radius.control },
  input: { ...type.input, color: colors.text, flex: 1, minWidth: 100, minHeight: 44, paddingHorizontal: 12,
    borderWidth: 1, borderColor: colors.controlBorder, borderRadius: radius.control },
  toggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { flex: 1 }, focused: { borderColor: colors.focus }, invalid: { borderColor: colors.danger },
  pressed: { backgroundColor: colors.hover }, disabled: { opacity: 0.4 },
})
