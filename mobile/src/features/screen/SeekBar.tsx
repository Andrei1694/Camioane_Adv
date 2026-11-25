import { useState } from 'react'
import { View } from 'react-native'
import { colors } from '../../lib/theme'

export interface SeekBarProps { value: number; duration: number; disabled: boolean; onSeek: (value: number) => void }
export default function SeekBar({ value, duration, disabled, onSeek }: SeekBarProps) {
  const [width, setWidth] = useState(1)
  const seek = (x: number) => { if (!disabled && duration) onSeek(Math.max(0, Math.min(x / width, 1)) * duration) }
  return <View style={{ minHeight: 44, justifyContent: 'center' }} accessibilityRole="adjustable" accessibilityLabel="Poziția de redare"
    accessibilityState={{ disabled }} accessibilityValue={{ min: 0, max: duration, now: value, text: `${value.toFixed(1)} din ${duration.toFixed(1)} secunde` }}
    accessibilityActions={[{ name: 'increment', label: 'Înainte 5 secunde' }, { name: 'decrement', label: 'Înapoi 5 secunde' }]}
    onAccessibilityAction={(event) => { if (!disabled) onSeek(Math.max(0, Math.min(duration, value + (event.nativeEvent.actionName === 'increment' ? 5 : -5)))) }}
    onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    onStartShouldSetResponder={() => !disabled} onMoveShouldSetResponder={() => !disabled}
    onResponderGrant={(event) => seek(event.nativeEvent.locationX)} onResponderMove={(event) => seek(event.nativeEvent.locationX)}>
    <View pointerEvents="none" style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
      <View style={{ height: '100%', backgroundColor: colors.data, width: `${duration ? value / duration * 100 : 0}%` }} />
    </View>
  </View>
}
