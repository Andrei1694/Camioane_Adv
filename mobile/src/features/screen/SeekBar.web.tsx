import type { SeekBarProps } from './SeekBar'
import { colors } from '../../lib/theme'

export default function SeekBar({ value, duration, disabled, onSeek }: SeekBarProps) {
  return <input type="range" min={0} max={duration} step={0.1} value={value} disabled={disabled}
    aria-label="Poziția de redare" aria-valuetext={`${value.toFixed(1)} din ${duration.toFixed(1)} secunde`}
    style={{ width: '100%', minHeight: 44, accentColor: colors.data, margin: 0 }}
    onChange={(event) => onSeek(Number(event.currentTarget.value))} />
}
