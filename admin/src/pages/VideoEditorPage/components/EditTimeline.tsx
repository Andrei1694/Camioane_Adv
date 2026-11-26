import { useEffect, useMemo, useReducer, useRef } from 'react'
import type { RefObject } from 'react'
import { Timeline } from '@xzdarcy/react-timeline-editor'
import type { TimelineEditor, TimelineState } from '@xzdarcy/react-timeline-editor'
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css'
import { formatTimecode, layout, resizeFits } from '../edit'
import type { Segment } from '../edit'
import { rowHeight, scaleWidth, startLeft, zoomLevels } from '../zoom'

type Row = NonNullable<TimelineEditor['editorData']>[number]

// The library keeps each bar's position in its own state and resets it only when the bar's
// start or end changes. Bars get a new id after every drop or stretch, so a bar dropped where
// it changes nothing is remounted at its place instead of staying where the pointer left it.
const actionId = (segment: Segment, version: number) => `${segment.id}~${version}`
const segmentOf = (id: string) => id.slice(0, id.lastIndexOf('~'))

export default function EditTimeline({ timelineRef, segments, duration, selected, zoom, locked, playing, time, onSelect, onSeek, onResize, onDrop }: {
  timelineRef: RefObject<TimelineState | null>
  segments: Segment[]
  duration: number
  selected?: string
  zoom: number
  /** No dragging or stretching, while an export runs or before the video loads. */
  locked: boolean
  playing: boolean
  time: number
  onSelect: (id: string) => void
  onSeek: (time: number) => void
  onResize: (id: string, length: number, dir: 'left' | 'right') => void
  onDrop: (id: string, start: number, end: number) => void
}) {
  const [version, remount] = useReducer((value: number) => value + 1, 0)
  const frame = useRef<HTMLDivElement>(null)
  const scrollLeft = useRef(0)
  const { scale, split } = zoomLevels[zoom]
  const placed = useMemo(() => layout(segments), [segments])
  const total = placed.at(-1)?.end ?? 0

  const rows = useMemo<Row[]>(() => [{
    id: 'video',
    actions: placed.map(({ segment, start, end }) => ({
      id: actionId(segment, version), start, end, effectId: 'clip', selected: segment.id === selected,
    })),
  }], [placed, selected, version])

  const find = (id: string) => segments.find((segment) => segment.id === segmentOf(id))

  const timeRef = useRef(time)
  useEffect(() => {
    timeRef.current = time
  }, [time])

  // The library's ruler caches its tick cells and recomputes them only when scaleWidth changes,
  // so each zoom remounts the timeline (see the key below). The playhead comes back, centred.
  useEffect(() => {
    const state = timelineRef.current
    if (!state) return
    state.setTime(timeRef.current)
    const left = startLeft + (timeRef.current / scale) * scaleWidth
    scrollLeft.current = Math.max(0, left - (frame.current?.clientWidth ?? 0) / 2)
    state.setScrollLeft(scrollLeft.current)
  }, [zoom, scale, timelineRef])

  // While playing, the view keeps the playhead in sight when the edit is wider than the frame.
  useEffect(() => {
    const width = frame.current?.clientWidth
    if (!playing || !width || !timelineRef.current) return
    const left = startLeft + (time / scale) * scaleWidth
    if (left < scrollLeft.current || left > scrollLeft.current + width - 48) {
      scrollLeft.current = Math.max(0, left - 48)
      timelineRef.current.setScrollLeft(scrollLeft.current)
    }
  }, [playing, time, scale, timelineRef])

  return (
    <div ref={frame} className="edit-timeline">
      <Timeline
        key={zoom}
        ref={timelineRef}
        editorData={rows}
        effects={{ clip: { id: 'clip', name: 'Clip' } }}
        scale={scale}
        scaleSplitCount={split}
        scaleWidth={scaleWidth}
        startLeft={startLeft}
        rowHeight={rowHeight}
        minScaleCount={Math.max(1, Math.ceil(Math.max(duration, total) / scale) + 1)}
        disableDrag={locked}
        autoScroll
        onScroll={({ scrollLeft: left }) => { scrollLeft.current = left }}
        dragLine
        getScaleRender={(value) => formatTimecode(value, false)}
        getActionRender={(action) => {
          const item = placed.find(({ segment }) => segment.id === segmentOf(action.id))
          if (!item) return null
          return (
            <span className="clip-label">
              <span className="clip-name">Segment {item.index + 1}</span>
              <span className="clip-range num">{formatTimecode(item.segment.sourceStart)}–{formatTimecode(item.segment.sourceEnd)}</span>
            </span>
          )
        }}
        onClickActionOnly={(_, { action }) => {
          const segment = find(action.id)
          if (segment) onSelect(segment.id)
        }}
        onActionResizing={({ action, start, end, dir }) => {
          const segment = find(action.id)
          return segment !== undefined && resizeFits(segment, end - start, dir, duration)
        }}
        onActionResizeEnd={({ action, start, end, dir }) => {
          const segment = find(action.id)
          remount()
          if (segment) onResize(segment.id, end - start, dir)
        }}
        onActionMoveEnd={({ action, start, end }) => {
          const segment = find(action.id)
          remount()
          if (segment) onDrop(segment.id, start, end)
        }}
        onCursorDrag={onSeek}
        onCursorDragEnd={onSeek}
        onClickTimeArea={(value) => {
          onSeek(value)
          return false
        }}
        onClickRow={(_, { time: value }) => onSeek(value)}
        // The page owns the edit; nothing needs the library's engine to follow along.
        onChange={() => false}
      />
    </div>
  )
}
