import { Pressable, StyleSheet, Text } from 'react-native'
import { colors, radius, touchTarget, type } from '../lib/theme'

interface ButtonProps {
  label: string
  onPress: () => void
  /** Primary is the screen's one main action. */
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

export default function Button({ label, onPress, variant = 'secondary', disabled = false }: ButtonProps) {
  const primary = variant === 'primary'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primary,
        pressed && (primary ? styles.primaryPressed : styles.pressed),
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, primary && styles.primaryLabel, disabled && styles.disabledLabel]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: touchTarget,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.hover,
  },
  primary: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  primaryPressed: {
    borderColor: colors.primaryPressed,
    backgroundColor: colors.primaryPressed,
  },
  disabled: {
    borderColor: colors.border,
    backgroundColor: colors.hover,
  },
  label: {
    ...type.label,
    color: colors.text,
  },
  primaryLabel: {
    color: colors.surface,
  },
  disabledLabel: {
    color: colors.muted,
  },
})
