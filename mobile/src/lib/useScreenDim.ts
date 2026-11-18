import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { AppState } from 'react-native'
import { dimScreen } from './screenBrightness'

export function useScreenDim(active: boolean, canDim: boolean) {
  const [dimmed, setDimmed] = useState(false)
  const [error, setError] = useState('')
  const restore = useRef<(() => Promise<void>) | null>(null)
  const generation = useRef(0)
  const pending = useRef(false)
  const focused = useRef(false)

  const wake = useCallback(() => {
    generation.current += 1
    setDimmed(false)
    const restoreBrightness = restore.current
    restore.current = null
    if (!restoreBrightness) return
    pending.current = true
    void restoreBrightness().catch(() => {}).finally(() => {
      pending.current = false
    })
  }, [])

  useEffect(() => {
    // Buffering remains active so it does not restore an existing dim operation.
    if (active) return wake
  }, [active, wake])

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'background') wake()
    })
    return () => listener.remove()
  }, [wake])

  useFocusEffect(useCallback(() => {
    focused.current = true
    return () => {
      focused.current = false
      wake()
    }
  }, [wake]))

  async function dim() {
    if (!dimScreen || !active || !canDim || !focused.current || AppState.currentState === 'background') return
    // Do not capture the dimmed brightness during a repeated press or a pending restore.
    if (pending.current || restore.current) return
    pending.current = true
    const current = ++generation.current
    setError('')
    try {
      const restoreBrightness = await dimScreen()
      if (current !== generation.current) {
        // Playback or focus may have ended before the native dim operation finished.
        await restoreBrightness().catch(() => {})
        return
      }
      restore.current = restoreBrightness
      setDimmed(true)
    } catch {
      if (current === generation.current) {
        setDimmed(false)
        setError('The phone screen could not be dimmed.')
      }
    } finally {
      pending.current = false
    }
  }

  return { dimmed, dim, wake, error }
}
