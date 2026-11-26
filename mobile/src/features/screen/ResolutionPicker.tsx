import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { TextInputProps } from 'react-native'
import Button from '../../components/Button'
import { colors, radius, touchTarget, type } from '../../lib/theme'
import { defaultResolution, formatResolution, resolutionLimits, sameResolution } from './screenLayout'
import type { Resolution } from './screenLayout'

interface ResolutionPickerProps {
  selected: Resolution
  custom: Resolution[]
  disabled: boolean
  error: string
  onSelect: (resolution: Resolution) => void
  /** Returns why the size was refused, or an empty string once it is added. */
  onAdd: (resolution: Resolution) => string
  onRemove: (resolution: Resolution) => void
}

function parseSide(text: string) {
  const value = text.trim()
  return /^\d{1,5}$/.test(value) ? Number(value) : Number.NaN
}

export default function ResolutionPicker({ selected, custom, disabled, error, onSelect, onAdd, onRemove }: ResolutionPickerProps) {
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [problem, setProblem] = useState('')

  function add() {
    const refused = onAdd({ width: parseSide(width), height: parseSide(height) })
    setProblem(refused)
    if (refused) return
    setWidth('')
    setHeight('')
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">Rezoluție</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Rezoluția videoclipului convertit">
        {[defaultResolution, ...custom].map((resolution) => {
          const checked = sameResolution(resolution, selected)
          const builtIn = sameResolution(resolution, defaultResolution)
          const label = builtIn ? `${formatResolution(resolution)} · Versiunea A` : formatResolution(resolution)
          return <View key={formatResolution(resolution)} style={styles.row}>
            <Pressable disabled={disabled} accessibilityRole="radio" aria-checked={checked} aria-disabled={disabled}
              accessibilityLabel={`Rezoluție ${label}`} accessibilityState={{ checked, disabled }}
              onPress={() => onSelect(resolution)} style={[styles.option, disabled && styles.disabled]}>
              <View style={[styles.radio, checked && styles.radioChecked]} />
              <Text style={[styles.body, styles.optionText]}>{label}</Text>
            </Pressable>
            {!builtIn ? <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Șterge rezoluția ${label}`}
              accessibilityState={{ disabled }} onPress={() => onRemove(resolution)}
              style={({ pressed }) => [styles.remove, pressed && styles.pressed, disabled && styles.disabled]}>
              <Text style={styles.removeLabel}>Șterge</Text>
            </Pressable> : null}
          </View>
        })}
      </View>
      <View style={styles.fields}>
        <SideField label="Lățime (px)" value={width} editable={!disabled} onChangeText={setWidth} invalid={!!problem} />
        <SideField label="Înălțime (px)" value={height} editable={!disabled} onChangeText={setHeight} invalid={!!problem}
          onSubmitEditing={add} />
      </View>
      <Button label="Adaugă rezoluția" disabled={disabled} onPress={add} />
      {problem ? <Text style={styles.error} accessibilityRole="alert">{problem}</Text>
        : <Text style={styles.muted}>Numere pare între {resolutionLimits.min} și {resolutionLimits.max}. Lista rămâne salvată pe acest telefon. Cele trei regiuni se scalează proporțional față de {formatResolution(defaultResolution)}.</Text>}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  )
}

function SideField({ label, invalid, editable, ...input }: TextInputProps & { label: string; invalid: boolean }) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} editable={editable} keyboardType="number-pad" inputMode="numeric" maxLength={5}
        returnKeyType="done" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.inputFocused, invalid && styles.inputInvalid, editable === false && styles.inputDisabled]}
        {...input} />
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  heading: { ...type.section, color: colors.text },
  body: { ...type.body, color: colors.text }, label: { ...type.label, color: colors.text },
  muted: { ...type.meta, color: colors.muted }, error: { ...type.body, color: colors.danger },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: touchTarget },
  optionText: { flex: 1 },
  disabled: { opacity: 0.5 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.controlBorder },
  radioChecked: { borderWidth: 6, borderColor: colors.primary },
  remove: { minHeight: touchTarget, minWidth: touchTarget, paddingHorizontal: 12, justifyContent: 'center', borderRadius: radius.control },
  pressed: { backgroundColor: colors.hover },
  removeLabel: { ...type.label, color: colors.danger },
  fields: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 6 },
  input: {
    ...type.input, minHeight: touchTarget, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1,
    borderColor: colors.controlBorder, borderRadius: radius.control, color: colors.text, backgroundColor: colors.surface,
  },
  inputFocused: { borderColor: colors.focus },
  inputInvalid: { borderColor: colors.danger },
  inputDisabled: { backgroundColor: colors.hover },
})
