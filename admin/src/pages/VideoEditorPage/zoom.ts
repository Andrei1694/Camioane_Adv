// The timeline's geometry and zoom steps, shared by the page and the timeline component.

export const scaleWidth = 120
export const startLeft = 16
export const rowHeight = 48

/** Seconds per labelled tick and the number of unlabelled steps between labels, closest zoom first. */
export const zoomLevels = [
  { scale: 1, split: 10 },
  { scale: 2, split: 4 },
  { scale: 5, split: 5 },
  { scale: 10, split: 10 },
  { scale: 30, split: 6 },
  { scale: 60, split: 6 },
] as const

/** The closest zoom that still shows the whole video in the given width. */
export function fittingZoom(duration: number, width: number) {
  const index = zoomLevels.findIndex(({ scale }) => (duration / scale) * scaleWidth + startLeft * 2 <= width)
  return index === -1 ? zoomLevels.length - 1 : index
}
