export interface Placement { x: number, y: number, scale: number }
export interface Size { width: number, height: number }

export const defaultPlacement: Placement = { x: 0, y: 0, scale: 1 }

export function validPlacement(value: unknown): value is Placement {
  if (typeof value !== 'object' || value === null) return false
  const { x, y, scale } = value as Record<string, unknown>
  return typeof x === 'number' && Number.isInteger(x) && x >= -4096 && x <= 4096
    && typeof y === 'number' && Number.isInteger(y) && y >= -4096 && y <= 4096
    && typeof scale === 'number' && Number.isFinite(scale) && scale >= 0.1 && scale <= 4
}

export function decodePlacement(text: string | null): Placement {
  if (text === null) return { ...defaultPlacement }
  const value: unknown = JSON.parse(text)
  if (!validPlacement(value)) throw new Error('Poziționarea salvată nu este validă.')
  return { x: value.x, y: value.y, scale: value.scale }
}

export function formatScale(scale: number) {
  return `${Number((scale * 100).toFixed(3))}%`
}

export function clippedEdges(frame: Size | null, video: Size | null, placement: Placement) {
  if (!frame || !video) return []
  const width = Math.round(video.width * placement.scale)
  const height = Math.round(video.height * placement.scale)
  return [
    { edge: 'în dreapta', pixels: Math.min(width, Math.max(0, placement.x + width - frame.width)) },
    { edge: 'jos', pixels: Math.min(height, Math.max(0, placement.y + height - frame.height)) },
    { edge: 'în stânga', pixels: Math.min(width, Math.max(0, -placement.x)) },
    { edge: 'sus', pixels: Math.min(height, Math.max(0, -placement.y)) },
  ].filter((edge) => edge.pixels > 0)
}

export function fitScale(frame: Size | null, video: Size | null, axis: keyof Size) {
  if (!frame || !video || video[axis] <= 0) return null
  const scale = frame[axis] / video[axis]
  return Number.isFinite(scale) && scale >= 0.1 && scale <= 4 ? scale : null
}
