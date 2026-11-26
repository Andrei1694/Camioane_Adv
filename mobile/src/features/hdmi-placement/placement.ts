import type { HdmiPlacement } from '../../../modules/hdmi-player'

export const defaultPlacement: HdmiPlacement = { x: 0, y: 0, scale: 1 }

export function validPlacement(value: unknown): value is HdmiPlacement {
  if (typeof value !== 'object' || value === null) return false
  const { x, y, scale } = value as Record<string, unknown>
  return typeof x === 'number' && Number.isInteger(x) && x >= -4096 && x <= 4096
    && typeof y === 'number' && Number.isInteger(y) && y >= -4096 && y <= 4096
    && typeof scale === 'number' && Number.isFinite(scale) && scale >= 0.1 && scale <= 4
}

export function decodePlacement(text: string | null): HdmiPlacement {
  if (text === null) return { ...defaultPlacement }
  const value: unknown = JSON.parse(text)
  if (!validPlacement(value)) throw new Error('Invalid saved HDMI placement')
  return { x: value.x, y: value.y, scale: value.scale }
}

export function formatScale(scale: number) {
  return `${Number((scale * 100).toFixed(3))}%`
}
