export interface Resolution { width: number; height: number }

/** Version A, the size the region geometry below was measured at. */
export const defaultResolution: Resolution = { width: 2304, height: 512 }
export const resolutionLimits = { min: 64, max: 4096 }

// Unconfirmed ViPlex widget sizes from hardware_docs/Phone-HDMI-Playback.md.
// The mapping from editor regions to physical truck sides still needs verification.
// Other resolutions scale these rectangles proportionally (regionsFor).
export const screenRegions = [
  { id: 'left', label: 'Stânga în editor', x: 0, y: 0, width: 1018, height: 512 },
  { id: 'middle', label: 'Mijloc în editor', x: 1024, y: 0, width: 512, height: 512 },
  { id: 'right', label: 'Dreapta în editor', x: 1585, y: 0, width: 719, height: 512 },
] as const

export type RegionId = typeof screenRegions[number]['id']
export type Fit = 'cover' | 'contain'
export const defaultFits: Record<RegionId, Fit> = { left: 'contain', middle: 'contain', right: 'contain' }

/** H.264 needs even sides; the native converters enforce the same limits. */
export function resolutionProblem({ width, height }: Resolution) {
  if (!Number.isInteger(width) || !Number.isInteger(height)) return 'Introdu lățimea și înălțimea în pixeli, ca numere întregi.'
  const { min, max } = resolutionLimits
  if ([width, height].some((side) => side < min || side > max || side % 2 !== 0)) {
    return `Lățimea și înălțimea trebuie să fie numere pare între ${min} și ${max}.`
  }
  return ''
}

export function sameResolution(a: Resolution, b: Resolution) {
  return a.width === b.width && a.height === b.height
}

export function formatResolution({ width, height }: Resolution) {
  return `${width} × ${height}`
}

/** Scales region edges, not sizes, so the right region still ends exactly at the canvas edge. */
export function regionsFor({ width, height }: Resolution) {
  function scaleX(value: number) { return Math.round(value * width / defaultResolution.width) }
  function scaleY(value: number) { return Math.round(value * height / defaultResolution.height) }
  return screenRegions.map((region) => ({
    ...region,
    x: scaleX(region.x),
    y: scaleY(region.y),
    width: scaleX(region.x + region.width) - scaleX(region.x),
    height: scaleY(region.y + region.height) - scaleY(region.y),
  }))
}

/** Source coordinates are upright display pixels, shared by preview and encoder. */
export function placement(sourceWidth: number, sourceHeight: number, region: { x: number, y: number, width: number, height: number }, fit: Fit) {
  const scale = fit === 'cover'
    ? Math.max(region.width / sourceWidth, region.height / sourceHeight)
    : Math.min(region.width / sourceWidth, region.height / sourceHeight)
  const sw = fit === 'cover' ? region.width / scale : sourceWidth
  const sh = fit === 'cover' ? region.height / scale : sourceHeight
  const dw = fit === 'cover' ? region.width : sourceWidth * scale
  const dh = fit === 'cover' ? region.height : sourceHeight * scale
  return {
    sx: (sourceWidth - sw) / 2, sy: (sourceHeight - sh) / 2, sw, sh,
    dx: region.x + (region.width - dw) / 2, dy: region.y + (region.height - dh) / 2, dw, dh,
  }
}

export function screenFileName(original: string, { width, height }: Resolution) {
  const base = original.replace(/\.[^.]+$/, '') || original
  return `${base} (ecran camion ${width}x${height}).mp4`
}
