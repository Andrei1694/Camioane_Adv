import { useEffect, useState } from 'react'
import { readResolutions, writeResolutions } from './resolutionStorage'
import { defaultResolution, formatResolution, resolutionProblem, sameResolution } from './screenLayout'
import type { Resolution } from './screenLayout'

const maxCustom = 20
// Shared by every editor instance so saves land in the order they were made.
let writes: Promise<void> = Promise.resolve()

interface Settings { custom: Resolution[]; selected: Resolution }

function decodeResolution(value: unknown): Resolution | null {
  if (typeof value !== 'object' || value === null) return null
  const { width, height } = value as Record<string, unknown>
  if (typeof width !== 'number' || typeof height !== 'number') return null
  const resolution = { width, height }
  return resolutionProblem(resolution) ? null : resolution
}

function decodeSettings(text: string | null): Settings {
  const value: unknown = text ? JSON.parse(text) : null
  if (typeof value !== 'object' || value === null) return { custom: [], selected: defaultResolution }
  const stored = value as Record<string, unknown>
  const custom: Resolution[] = []
  for (const entry of Array.isArray(stored.custom) ? stored.custom : []) {
    const resolution = decodeResolution(entry)
    if (resolution && custom.length < maxCustom && ![defaultResolution, ...custom].some((known) => sameResolution(known, resolution))) {
      custom.push(resolution)
    }
  }
  const selected = decodeResolution(stored.selected)
  const known = selected && custom.find((resolution) => sameResolution(resolution, selected))
  return { custom, selected: known ?? defaultResolution }
}

function persist(settings: Settings) {
  const next = writes.catch(() => {}).then(() => writeResolutions(JSON.stringify(settings)))
  writes = next
  return next
}

/** Output sizes saved on this phone. 2304 × 512 is built in and can't be removed. */
export function useResolutions() {
  const [settings, setSettings] = useState<Settings>({ custom: [], selected: defaultResolution })
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    readResolutions()
      .then((text) => { if (active) setSettings(decodeSettings(text)) })
      .catch(() => { if (active) setError(`Rezoluțiile salvate nu au putut fi citite. Se folosește ${formatResolution(defaultResolution)}.`) })
      .finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [])

  function update(next: Settings) {
    setSettings(next)
    setError('')
    persist(next).catch(() => setError('Rezoluțiile nu au putut fi salvate pe telefon. Alegerea rămâne până închizi pagina.'))
  }

  function select(resolution: Resolution) {
    update({ ...settings, selected: resolution })
  }

  /** Returns why the size was refused, or an empty string once it is added and selected. */
  function add(resolution: Resolution) {
    const problem = resolutionProblem(resolution)
    if (problem) return problem
    if ([defaultResolution, ...settings.custom].some((known) => sameResolution(known, resolution))) {
      return `Rezoluția ${formatResolution(resolution)} există deja.`
    }
    if (settings.custom.length >= maxCustom) return `Poți păstra cel mult ${maxCustom} rezoluții proprii. Șterge una întâi.`
    update({ custom: [...settings.custom, resolution], selected: resolution })
    return ''
  }

  function remove(resolution: Resolution) {
    const custom = settings.custom.filter((known) => !sameResolution(known, resolution))
    update({ custom, selected: sameResolution(settings.selected, resolution) ? defaultResolution : settings.selected })
  }

  return { custom: settings.custom, selected: settings.selected, ready, error, select, add, remove }
}
