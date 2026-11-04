import { useRef, useState } from 'react'
import type { Ref } from 'react'
import { Image, StyleSheet, Text, TextInput, View } from 'react-native'
import type { TextInputInstance, TextInputProps } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import Button from '../components/Button'
import Screen from '../components/Screen'
import { signIn, useSession } from '../auth/session'
import { api, errorMessage } from '../lib/api'
import { colors, radius, touchTarget, type } from '../lib/theme'
import { getEmailError, getPasswordError, normalizeEmail } from '../lib/user'

export default function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string, password?: string }>({})
  const [failure, setFailure] = useState('')
  const emailInput = useRef<TextInputInstance>(null)
  const passwordInput = useRef<TextInputInstance>(null)
  const message = useSession((state) => state.message)
  const notice = useSession((state) => state.notice)
  const login = useMutation({ mutationFn: api.login })

  async function submit() {
    if (login.isPending) return
    const normalized = normalizeEmail(email)
    const next = { email: getEmailError(normalized), password: getPasswordError(password) }
    setErrors(next)
    setFailure('')
    if (next.email) { emailInput.current?.focus(); return }
    if (next.password) { passwordInput.current?.focus(); return }
    try {
      const result = await login.mutateAsync({ email: normalized, password })
      setPassword('')
      signIn(result.accessToken, result.expiresIn)
    } catch (error) {
      setFailure(errorMessage(error))
    } finally {
      login.reset()
    }
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <Image source={require('../../assets/splash-icon.png')} style={styles.mark} accessibilityIgnoresInvertColors />
        <Text style={styles.title} accessibilityRole="header">Sign in</Text>
        <Text style={styles.description}>Use the driver or operator account provided by your administrator.</Text>
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {message ? <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text> : null}
      <Field
        ref={emailInput}
        label="Email"
        error={errors.email}
        value={email}
        editable={!login.isPending}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        keyboardType="email-address"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordInput.current?.focus()}
        onChangeText={(text) => { setEmail(text); setErrors((old) => ({ ...old, email: undefined })) }}
      />
      <Field
        ref={passwordInput}
        label="Password"
        error={errors.password}
        value={password}
        editable={!login.isPending}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        onChangeText={(text) => { setPassword(text); setErrors((old) => ({ ...old, password: undefined })) }}
      />
      {failure ? <Text style={styles.failure} accessibilityRole="alert" accessibilityLiveRegion="assertive">{failure}</Text> : null}
      <Button variant="primary" label={login.isPending ? 'Signing in…' : 'Sign in'} disabled={login.isPending} onPress={() => void submit()} />
    </Screen>
  )
}

interface FieldProps extends TextInputProps {
  label: string
  error?: string
  ref?: Ref<TextInputInstance>
}

function Field({ label, error, ref, editable = true, onFocus, onBlur, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error}
        editable={editable}
        style={[styles.input, focused && styles.inputFocused, error ? styles.inputInvalid : null, !editable && styles.inputDisabled]}
        onFocus={(event) => { setFocused(true); onFocus?.(event) }}
        onBlur={(event) => { setFocused(false); onBlur?.(event) }}
        {...input}
      />
      {error ? <Text style={styles.fieldError} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  heading: {
    gap: 8,
    marginTop: 24,
  },
  mark: {
    width: 64,
    height: 64,
    marginBottom: 8,
  },
  title: {
    ...type.title,
    color: colors.text,
  },
  description: {
    ...type.body,
    color: colors.muted,
  },
  notice: {
    ...type.body,
    padding: 12,
    borderRadius: radius.control,
    color: colors.text,
    backgroundColor: colors.frame,
  },
  message: {
    ...type.body,
    color: colors.text,
  },
  field: {
    gap: 8,
  },
  label: {
    ...type.label,
    color: colors.text,
  },
  input: {
    ...type.input,
    minHeight: touchTarget,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: radius.control,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputFocused: {
    borderColor: colors.focus,
  },
  inputInvalid: {
    borderColor: colors.danger,
  },
  inputDisabled: {
    backgroundColor: colors.hover,
  },
  fieldError: {
    ...type.meta,
    color: colors.danger,
  },
  failure: {
    ...type.body,
    color: colors.danger,
  },
})
