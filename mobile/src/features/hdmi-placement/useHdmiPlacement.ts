import { useCallback, useRef, useState } from 'react'
import { hdmiPlayer } from '../../../modules/hdmi-player'
import type { HdmiPlacement } from '../../../modules/hdmi-player'
import { defaultPlacement, validPlacement } from './placement'
import { readPlacement, writePlacement } from './placementStorage'

// Shared by test and playlist instances, including while navigation is settling.
let writes: Promise<void> = Promise.resolve()
const messages = {
  en: {
    read: 'Saved placement could not be read. Using 1:1 at 0,0.',
    save: 'Placement could not be saved on this phone. The current adjustment is temporary; try again.',
    apply: 'Placement could not be applied. Check HDMI and try the adjustment again.',
  },
  ro: {
    read: 'Poziționarea salvată nu a putut fi citită. Se folosește 1:1 la 0,0.',
    save: 'Poziționarea nu a putut fi salvată pe telefon. Ajustarea este temporară; încearcă din nou.',
    apply: 'Poziționarea nu a putut fi aplicată. Verifică HDMI și încearcă din nou.',
  },
}

interface Binding { id: string; alive: () => boolean }

export function useHdmiPlacement(language: 'en' | 'ro' = 'en') {
  const [placement, setPlacement] = useState(defaultPlacement)
  const [storageError, setStorageError] = useState('')
  const [applyError, setApplyError] = useState('')
  const binding = useRef<Binding | null>(null)
  const applications = useRef<Promise<void>>(Promise.resolve())
  const revision = useRef(0)
  const copy = messages[language]

  // Startup awaits this before preparing media or enabling controls. Re-read on
  // focus so the playlist picks up changes made on the test screen.
  const applySaved = useCallback(async (id: string, alive: () => boolean) => {
    const current = { id, alive }
    binding.current = current
    await writes.catch(() => {})
    let saved = { ...defaultPlacement }
    let warning = ''
    try { saved = await readPlacement() } catch { warning = copy.read }
    if (!alive() || binding.current !== current || !hdmiPlayer) return
    setStorageError(warning)
    setApplyError('')
    setPlacement(saved)
    await hdmiPlayer.setPlacement(id, saved.x, saved.y, saved.scale)
  }, [copy])

  function update(next: HdmiPlacement) {
    const current = binding.current
    const player = hdmiPlayer
    if (!current?.alive() || !player || !validPlacement(next)) return
    const change = ++revision.current
    setPlacement(next)
    setStorageError('')
    setApplyError('')
    const saving = writes.catch(() => {}).then(() => writePlacement(next))
    writes = saving
    void saving.catch(() => {
      if (current.alive() && revision.current === change) setStorageError(copy.save)
    })
    applications.current = applications.current.catch(() => {}).then(async () => {
      if (current.alive() && binding.current === current) {
        await player.setPlacement(current.id, next.x, next.y, next.scale)
      }
    }).catch(() => {
      if (current.alive() && revision.current === change) setApplyError(copy.apply)
    })
  }

  return { placement, applySaved, update, error: storageError || applyError }
}
