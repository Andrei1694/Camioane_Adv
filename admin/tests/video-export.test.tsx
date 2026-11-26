import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import VideoEditorPage from '../src/pages/VideoEditorPage/VideoEditorPage'
import { renderEdit } from '../src/pages/VideoEditorPage/renderVideo'
import { ExportError } from '../src/pages/VideoEditorPage/exportError'
import { api, ApiError } from '../src/lib/api'
import { useNotifications } from '../src/lib/notifications'
import { authenticate, renderPage } from './helpers/render'
import { deferred, file } from './helpers/fixtures'

// Capability is checked when the page module is loaded; encoding itself stays mocked.
vi.hoisted(() => { vi.stubGlobal('VideoEncoder', class {}) })
vi.mock('../src/pages/VideoEditorPage/renderVideo', () => ({ renderEdit: vi.fn() }))
vi.mock('../src/pages/VideoEditorPage/components/EditTimeline', () => ({ default: () => null }))

const video = file({ originalName: 'clip.mp4', mimeType: 'video/mp4' })
beforeEach(() => {
  vi.mocked(renderEdit).mockReset()
  authenticate()
  vi.spyOn(api, 'files').mockResolvedValue({ files: [video], total: 1 })
  vi.spyOn(api, 'downloadFile').mockResolvedValue(new Blob(['source'], { type: 'video/mp4' }))
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})

async function editVideo() {
  const view = await renderPage(<VideoEditorPage />, { path: '/files/$fileId/edit' })
  const element = await screen.findByLabelText('Previzualizarea editării pentru clip.mp4')
  Object.defineProperty(element, 'duration', { configurable: true, value: 10 })
  fireEvent.loadedMetadata(element)
  fireEvent.change(screen.getByLabelText('Poziția de redare'), { target: { value: '5' } })
  await userEvent.click(screen.getByRole('button', { name: 'Împarte la poziția de redare' }))
  return view
}

it('exports the edit as a new MP4 and uploads it without replacing the original', async () => {
  vi.mocked(renderEdit).mockResolvedValue(new Blob(['rendered'], { type: 'video/mp4' }))
  const upload = vi.spyOn(api, 'uploadFile').mockResolvedValue(file({ originalName: 'clip (editat).mp4', mimeType: 'video/mp4' }))
  await editVideo()
  await userEvent.click(screen.getByRole('button', { name: 'Exportă în Fișiere' }))
  await waitFor(() => expect(upload).toHaveBeenCalledOnce())
  expect(upload.mock.calls[0][0]).toMatchObject({ name: 'clip (editat).mp4', type: 'video/mp4', size: 8 })
  expect(vi.mocked(renderEdit).mock.calls[0][1]).toEqual([
    expect.objectContaining({ sourceStart: 0, sourceEnd: 5 }), expect.objectContaining({ sourceStart: 5, sourceEnd: 10 }),
  ])
  expect(video.originalName).toBe('clip.mp4')
  await waitFor(() => expect(useNotifications.getState().notifications[0]?.message).toContain('Salvat clip (editat).mp4'))
})

it('shows render progress, blocks concurrent exports and cancels without losing the edit', async () => {
  vi.mocked(renderEdit).mockImplementation((_blob, _edit, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Canceled', 'AbortError')))
  }))
  const upload = vi.spyOn(api, 'uploadFile')
  await editVideo()
  await userEvent.click(screen.getByRole('button', { name: 'Exportă în Fișiere' }))
  await waitFor(() => expect(renderEdit).toHaveBeenCalledOnce())
  act(() => vi.mocked(renderEdit).mock.calls[0][2].onProgress(0.4))
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
  expect(screen.getByRole('button', { name: 'Exportă în Fișiere' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: /Anulează\s*exportul/ }))
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument())
  expect(upload).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Anulează ultima acțiune' })).toBeEnabled()
})

it('reports encoder failure and retries rendering the retained edit', async () => {
  vi.mocked(renderEdit).mockRejectedValueOnce(new ExportError('Encoder unavailable'))
    .mockResolvedValue(new Blob(['rendered']))
  vi.spyOn(api, 'uploadFile').mockResolvedValue(video)
  await editVideo()
  await userEvent.click(screen.getByRole('button', { name: 'Exportă în Fișiere' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Encoder unavailable')
  await userEvent.click(screen.getByRole('button', { name: /Reîncearcă\s*exportul/ }))
  await waitFor(() => expect(renderEdit).toHaveBeenCalledTimes(2))
})

it('retries a failed upload without rendering again', async () => {
  vi.mocked(renderEdit).mockResolvedValue(new Blob(['rendered']))
  const upload = vi.spyOn(api, 'uploadFile').mockRejectedValueOnce(new ApiError(500, 'Offline')).mockResolvedValue(video)
  await editVideo()
  await userEvent.click(screen.getByRole('button', { name: 'Exportă în Fișiere' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
  await userEvent.click(screen.getByRole('button', { name: /Reîncearcă\s*încărcarea/ }))
  await waitFor(() => expect(upload).toHaveBeenCalledTimes(2))
  expect(renderEdit).toHaveBeenCalledOnce()
  expect(upload.mock.calls[1][0]).toBe(upload.mock.calls[0][0])
})

it('cancels the active export on unmount and releases preview resources', async () => {
  const pending = deferred<Blob>()
  vi.mocked(renderEdit).mockReturnValue(pending.promise)
  const view = await editVideo()
  await userEvent.click(screen.getByRole('button', { name: 'Exportă în Fișiere' }))
  await waitFor(() => expect(renderEdit).toHaveBeenCalledOnce())
  view.unmount()
  expect(vi.mocked(renderEdit).mock.calls[0][2].signal.aborted).toBe(true)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-object')
  await act(async () => pending.reject(new DOMException('Canceled', 'AbortError')))
  expect(useNotifications.getState().notifications).toEqual([])
})
