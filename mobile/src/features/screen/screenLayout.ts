export const screenCanvas = { width: 2304, height: 512 }

// Unconfirmed ViPlex widget sizes from hardware_docs/Phone-HDMI-Playback.md.
// The mapping from editor regions to physical truck sides still needs verification.
export const screenRegions = [
  { id: 'left', label: 'Stânga în editor', x: 0, y: 0, width: 1018, height: 512 },
  { id: 'middle', label: 'Mijloc în editor', x: 1024, y: 0, width: 512, height: 512 },
  { id: 'right', label: 'Dreapta în editor', x: 1585, y: 0, width: 719, height: 512 },
] as const

export type RegionId = typeof screenRegions[number]['id']
export type Fit = 'cover' | 'contain'
export const defaultFits: Record<RegionId, Fit> = { left: 'contain', middle: 'contain', right: 'contain' }

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

export function screenFileName(original: string) {
  const base = original.replace(/\.[^.]+$/, '') || original
  return `${base} (ecran camion).mp4`
}
