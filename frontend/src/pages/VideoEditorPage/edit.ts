// The edit is an ordered list of kept ranges of one source video. The timeline is magnetic: each
// segment starts where the one before it ends, so the timeline always shows the output exactly.

/** One kept range of the source video, in seconds. */
export interface Segment {
  id: string
  sourceStart: number
  sourceEnd: number
}

export interface PlacedSegment {
  segment: Segment
  index: number
  /** Where the segment starts and ends on the timeline, which is the exported video's own time. */
  start: number
  end: number
}

/** The shortest piece a trim or a split may leave, in seconds. */
export const minSegmentLength = 0.1

let lastId = 0
const segmentId = () => `segment-${++lastId}`

// Cut points keep millisecond precision; the timeline's pixel maths produces long fractions.
const round = (seconds: number) => Math.round(seconds * 1000) / 1000
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const segmentLength = (segment: Segment) => segment.sourceEnd - segment.sourceStart

export function layout(segments: readonly Segment[]): PlacedSegment[] {
  let start = 0
  return segments.map((segment, index) => {
    const placed = { segment, index, start, end: start + segmentLength(segment) }
    start = placed.end
    return placed
  })
}

export const totalLength = (segments: readonly Segment[]) => segments.reduce((sum, segment) => sum + segmentLength(segment), 0)

export function initialSegments(duration: number): Segment[] {
  return [{ id: segmentId(), sourceStart: 0, sourceEnd: round(duration) }]
}

export function isUnchanged(segments: readonly Segment[], duration: number) {
  const [only] = segments
  return segments.length === 1 && only.sourceStart === 0 && only.sourceEnd === round(duration)
}

function sameSegments(a: readonly Segment[], b: readonly Segment[]) {
  return a.length === b.length && a.every((segment, index) => segment.id === b[index].id
    && segment.sourceStart === b[index].sourceStart && segment.sourceEnd === b[index].sourceEnd)
}

/**
 * The segment playing at a timeline time and the matching source time. A boundary belongs to the
 * segment that starts there; the end of the edit maps to the end of the last segment.
 */
export function locate(segments: readonly Segment[], time: number) {
  const placed = layout(segments)
  const hit = placed.find((item) => time < item.end) ?? placed.at(-1)
  if (!hit) return undefined
  return { index: hit.index, sourceTime: hit.segment.sourceStart + clamp(time - hit.start, 0, hit.end - hit.start) }
}

const splitTarget = (segments: readonly Segment[], time: number) =>
  layout(segments).find((item) => time - item.start >= minSegmentLength && item.end - time >= minSegmentLength)

/** Whether the playhead sits inside a segment, far enough from its edges for both parts to keep the minimum length. */
export const canSplit = (segments: readonly Segment[], time: number) => splitTarget(segments, time) !== undefined

/** Splits the segment under the playhead, when both parts keep at least the minimum length. */
export function split(segments: readonly Segment[], time: number): Segment[] | undefined {
  const hit = splitTarget(segments, time)
  if (!hit) return undefined
  const cut = round(hit.segment.sourceStart + time - hit.start)
  return [
    ...segments.slice(0, hit.index),
    { ...hit.segment, sourceEnd: cut },
    { id: segmentId(), sourceStart: cut, sourceEnd: hit.segment.sourceEnd },
    ...segments.slice(hit.index + 1),
  ]
}

/** Moves one edge of a segment to a source time, kept inside the source and above the minimum length. */
export function trim(segments: readonly Segment[], id: string, edge: 'start' | 'end', sourceTime: number, duration: number): Segment[] {
  return segments.map((segment) => {
    if (segment.id !== id) return segment
    return edge === 'start'
      ? { ...segment, sourceStart: clamp(round(sourceTime), 0, segment.sourceEnd - minSegmentLength) }
      : { ...segment, sourceEnd: clamp(round(sourceTime), segment.sourceStart + minSegmentLength, round(duration)) }
  })
}

/** Whether a bar being stretched on the timeline to this length still fits its source. */
export function resizeFits(segment: Segment, length: number, dir: 'left' | 'right', duration: number) {
  if (length < minSegmentLength) return false
  return dir === 'left' ? segment.sourceEnd - length >= -0.001 : segment.sourceStart + length <= duration + 0.001
}

/** Applies a stretched bar: the left edge moves the source start, the right edge the source end. */
export function resize(segments: readonly Segment[], id: string, length: number, dir: 'left' | 'right', duration: number) {
  const segment = segments.find((item) => item.id === id)
  if (!segment) return [...segments]
  return dir === 'left'
    ? trim(segments, id, 'start', segment.sourceEnd - length, duration)
    : trim(segments, id, 'end', segment.sourceStart + length, duration)
}

/** Reorders a dropped bar: it goes after every other segment whose centre lies before its own centre. */
export function dropAt(segments: readonly Segment[], id: string, start: number, end: number): Segment[] {
  const moving = segments.find((segment) => segment.id === id)
  if (!moving) return [...segments]
  const others = layout(segments).filter((item) => item.segment.id !== id)
  const index = others.filter((item) => (item.start + item.end) / 2 < (start + end) / 2).length
  const rest = others.map((item) => item.segment)
  return [...rest.slice(0, index), moving, ...rest.slice(index)]
}

export function moveBy(segments: readonly Segment[], id: string, step: -1 | 1): Segment[] {
  const index = segments.findIndex((segment) => segment.id === id)
  const target = index + step
  if (index < 0 || target < 0 || target >= segments.length) return [...segments]
  const next = [...segments]
  next[index] = segments[target]
  next[target] = segments[index]
  return next
}

/** Removes a segment. The edit always keeps at least one. */
export function remove(segments: readonly Segment[], id: string): Segment[] {
  return segments.length > 1 ? segments.filter((segment) => segment.id !== id) : [...segments]
}

// Edit history -----------------------------------------------------------------------------

export interface EditHistory {
  past: Segment[][]
  present: Segment[]
  future: Segment[][]
}

export type HistoryAction =
  | { type: 'load', segments: Segment[] }
  | { type: 'change', change: (segments: Segment[]) => Segment[] | undefined }
  | { type: 'undo' }
  | { type: 'redo' }

const historyLimit = 100

export const emptyHistory: EditHistory = { past: [], present: [], future: [] }

export function historyReducer(state: EditHistory, action: HistoryAction): EditHistory {
  switch (action.type) {
    case 'load':
      return { past: [], present: action.segments, future: [] }
    case 'change': {
      const next = action.change(state.present)
      // A change that keeps every segment as it was (a bar dropped where it started) adds no step.
      if (!next || sameSegments(next, state.present)) return state
      return { past: [...state.past, state.present].slice(-historyLimit), present: next, future: [] }
    }
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] }
    }
    case 'redo': {
      const [next, ...future] = state.future
      if (!next) return state
      return { past: [...state.past, state.present], present: next, future }
    }
  }
}

// Formatting -------------------------------------------------------------------------------

/** A position in the video: `0:12.4`, or `1:02:03.4` past an hour. Whole-second ticks drop the tenth: `0:12`. */
export function formatTimecode(seconds: number, tenths = true) {
  const steps = Math.max(0, Math.round(seconds * (tenths ? 10 : 1)))
  const whole = tenths ? Math.floor(steps / 10) : steps
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor(whole / 60) % 60
  const secs = String(whole % 60).padStart(2, '0')
  const clock = hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`
  return tenths ? `${clock}.${steps % 10}` : clock
}
