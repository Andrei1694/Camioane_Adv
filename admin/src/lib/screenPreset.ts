export type RegionId = 'left' | 'middle' | 'right'
export type Fit = 'cover' | 'contain'
export type ScreenRegion = { x: number, y: number, width: number, height: number }

export interface ScreenLayout {
  canvas: { width: number, height: number }
  regions: Record<RegionId, ScreenRegion & { fit: Fit }>
}

export interface ScreenPresetInput extends ScreenLayout {
  name: string
}

export interface ScreenPreset extends ScreenPresetInput {
  id: string
  version: number
  createdAt: string
  updatedAt: string
}

export const screenPresetsKey = (revision: number) => ['screen-presets', revision] as const

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
}

export function screenPresetNameError(name: string) {
  return !name.trim() || name.trim().length > 200 || name.includes('\0')
    ? 'Introdu un nume de preset de 1–200 de caractere, fără caractere nule.' : ''
}

export function screenLayoutError(layout: unknown): string {
  if (!record(layout) || !record(layout.canvas) || !exactKeys(layout.canvas, ['width', 'height'])) {
    return 'Pânza trebuie să aibă lățime și înălțime.'
  }
  const { width, height } = layout.canvas
  if (!integer(width, 16, 4096) || width % 2 !== 0 || !integer(height, 16, 4096) || height % 2 !== 0) {
    return 'Dimensiunile pânzei trebuie să fie numere întregi pare între 16 și 4096 px.'
  }
  if (!record(layout.regions) || !exactKeys(layout.regions, ['left', 'middle', 'right'])) {
    return 'Configurația trebuie să conțină exact regiunile stânga, mijloc și dreapta.'
  }
  for (const [id, label] of [['left', 'Stânga'], ['middle', 'Mijloc'], ['right', 'Dreapta']] as const) {
    const region = layout.regions[id]
    if (!record(region) || !exactKeys(region, ['x', 'y', 'width', 'height', 'fit'])) {
      return `${label}: completează x, y, lățimea, înălțimea și încadrarea.`
    }
    if (!integer(region.x, 0, 4095) || !integer(region.y, 0, 4095)) {
      return `${label}: x și y trebuie să fie numere întregi între 0 și 4095 px.`
    }
    if (!integer(region.width, 1, 4096) || !integer(region.height, 1, 4096)) {
      return `${label}: lățimea și înălțimea trebuie să fie numere întregi între 1 și 4096 px.`
    }
    if (region.x + region.width > width || region.y + region.height > height) {
      return `${label}: regiunea trebuie să încapă integral în pânză.`
    }
    if (region.fit !== 'cover' && region.fit !== 'contain') {
      return `${label}: alege decuparea pentru umplere sau încadrarea cu bandă neagră.`
    }
  }
  return ''
}

export function isScreenLayout(value: unknown): value is ScreenLayout {
  return screenLayoutError(value) === ''
}

export function isScreenPreset(value: unknown): value is ScreenPreset {
  return record(value) && isScreenLayout(value)
    && typeof value.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.id)
    && typeof value.name === 'string' && value.name === value.name.trim() && !screenPresetNameError(value.name)
    && integer(value.version, 1, 2147483647)
    && typeof value.createdAt === 'string' && !Number.isNaN(Date.parse(value.createdAt))
    && typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt))
}

export function sameLayout(a: ScreenLayout, b: ScreenLayout) {
  return a.canvas.width === b.canvas.width && a.canvas.height === b.canvas.height
    && (['left', 'middle', 'right'] as const).every((id) => {
      const left = a.regions[id]
      const right = b.regions[id]
      return left.x === right.x && left.y === right.y && left.width === right.width
        && left.height === right.height && left.fit === right.fit
    })
}
