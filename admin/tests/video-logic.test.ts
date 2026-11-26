import { expect, it, vi } from 'vitest'
import { canSplit, dropAt, emptyHistory, formatTimecode, historyReducer, initialSegments, isUnchanged, layout, locate, moveBy, remove, resize, resizeFits, split, totalLength, trim } from '../src/pages/VideoEditorPage/edit'
import { fittingZoom } from '../src/pages/VideoEditorPage/zoom'
import { findFile } from '../src/pages/VideoEditorPage/findFile'
import { api } from '../src/lib/api'
import { queryClient } from '../src/lib/queryClient'
import { file, id } from './helpers/fixtures'

const segments = [{ id: 'a', sourceStart: 2, sourceEnd: 5 }, { id: 'b', sourceStart: 8, sourceEnd: 10 }]

it('lays out retained source ranges without gaps and maps edit time to source time', () => {
  expect(layout(segments).map(({ start, end }) => [start, end])).toEqual([[0, 3], [3, 5]])
  expect(totalLength(segments)).toBe(5)
  expect(locate(segments, -1)).toEqual({ index: 0, sourceTime: 2 })
  expect(locate(segments, 3)).toEqual({ index: 1, sourceTime: 8 })
  expect(locate(segments, 100)).toEqual({ index: 1, sourceTime: 10 })
  expect(locate([], 0)).toBeUndefined()
})

it('splits without mutating input and enforces the minimum segment length', () => {
  const result = split(segments, 1)!
  expect(result.map(({ sourceStart, sourceEnd }) => [sourceStart, sourceEnd])).toEqual([[2, 3], [3, 5], [8, 10]])
  expect(new Set(result.map(({ id }) => id)).size).toBe(3)
  expect(segments).toHaveLength(2)
  expect(canSplit(segments, 0.05)).toBe(false)
  expect(split(segments, 3)).toBeUndefined()
})

it('clamps trims and resizes to valid source bounds', () => {
  expect(trim(segments, 'a', 'start', -10, 10)[0].sourceStart).toBe(0)
  expect(trim(segments, 'a', 'start', 100, 10)[0].sourceStart).toBeCloseTo(4.9)
  expect(trim(segments, 'b', 'end', 100, 10)[1].sourceEnd).toBe(10)
  expect(trim(segments, 'b', 'end', -1, 10)[1].sourceEnd).toBeCloseTo(8.1)
  expect(resizeFits(segments[0], 0.05, 'left', 10)).toBe(false)
  expect(resizeFits(segments[0], 6, 'left', 10)).toBe(false)
  expect(resizeFits(segments[1], 3, 'right', 10)).toBe(false)
  expect(resize(segments, 'a', 2, 'left', 10)[0].sourceStart).toBe(3)
  expect(resize(segments, 'a', 2, 'right', 10)[0].sourceEnd).toBe(4)
})

it('reorders segments and keeps the final segment when deleting', () => {
  expect(moveBy(segments, 'a', 1).map(({ id }) => id)).toEqual(['b', 'a'])
  expect(moveBy(segments, 'a', -1)).toEqual(segments)
  expect(dropAt(segments, 'a', 4, 7).map(({ id }) => id)).toEqual(['b', 'a'])
  expect(remove(segments, 'a')).toEqual([segments[1]])
  expect(remove([segments[0]], 'a')).toEqual([segments[0]])
})

it('supports undo/redo, ignores no-op changes and discards redo after a new edit', () => {
  const loaded = historyReducer(emptyHistory, { type: 'load', segments })
  expect(historyReducer(loaded, { type: 'change', change: (current) => [...current] })).toBe(loaded)
  expect(historyReducer(loaded, { type: 'change', change: () => undefined })).toBe(loaded)
  const changed = historyReducer(loaded, { type: 'change', change: (current) => split(current, 1) })
  const undo = historyReducer(changed, { type: 'undo' })
  expect(undo.present).toEqual(segments)
  expect(historyReducer(undo, { type: 'redo' }).present).toEqual(changed.present)
  expect(historyReducer(undo, { type: 'change', change: (current) => remove(current, 'b') }).future).toEqual([])
  let bounded = loaded
  for (let n = 0; n < 110; n++) bounded = historyReducer(bounded, { type: 'change', change: () => initialSegments(n + 1) })
  expect(bounded.past).toHaveLength(100)
})

it('recognizes original video, selects fitting zoom and formats timecodes', () => {
  expect(isUnchanged(initialSegments(10.1234), 10.1234)).toBe(true)
  expect(isUnchanged(segments, 10)).toBe(false)
  expect(fittingZoom(1, 200)).toBe(0)
  expect(fittingZoom(600, 20)).toBe(5)
  expect(formatTimecode(3723.4)).toBe('1:02:03.4')
  expect(formatTimecode(59.96)).toBe('1:00.0')
  expect(formatTimecode(-1, false)).toBe('0:00')
})

it('finds cached files without a request and scans pages after reload', async () => {
  const files = vi.spyOn(api, 'files')
  queryClient.setQueryData(['files', 1, 0], { files: [file()], total: 1 })
  await expect(findFile(queryClient, 1, id(3), new AbortController().signal)).resolves.toEqual(file())
  expect(files).not.toHaveBeenCalled()
  files.mockResolvedValueOnce({ files: [file({ id: id(9) })], total: 101 })
    .mockResolvedValueOnce({ files: [file()], total: 101 })
  await expect(findFile(queryClient, 2, id(3), new AbortController().signal)).resolves.toEqual(file())
  expect(files.mock.calls.map(([page]) => page.offset)).toEqual([0, 100])
})

it('rejects bad IDs and stops scanning when a file is missing', async () => {
  const files = vi.spyOn(api, 'files').mockResolvedValue({ files: [], total: 1000 })
  await expect(findFile(queryClient, 0, 'bad', new AbortController().signal)).rejects.toMatchObject({ status: 404 })
  expect(files).not.toHaveBeenCalled()
  await expect(findFile(queryClient, 0, id(3), new AbortController().signal)).rejects.toMatchObject({ status: 404 })
  expect(files).toHaveBeenCalledOnce()
})
