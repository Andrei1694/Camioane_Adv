import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import FilesPage from '../src/pages/FilesPage/FilesPage'
import { saveBlob } from '../src/pages/FilesPage/saveFile'
import { api, ApiError } from '../src/lib/api'
import { useNotifications } from '../src/lib/notifications'
import { authenticate, renderPage } from './helpers/render'
import { deferred, file } from './helpers/fixtures'

beforeEach(() => {
  authenticate()
  vi.spyOn(api, 'files').mockResolvedValue({ files: [file()], total: 1 })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

it('shows loading, network failure, retry and empty states', async () => {
  const pending = deferred<Awaited<ReturnType<typeof api.files>>>()
  vi.mocked(api.files).mockReturnValueOnce(pending.promise).mockResolvedValue({ files: [], total: 0 })
  await renderPage(<FilesPage />)
  expect(screen.getByText('Se încarcă fișierele…')).toBeInTheDocument()
  await act(async () => pending.reject(new ApiError(0, 'Offline')))
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('Nu există încă fișiere încărcate.')).toBeInTheDocument()
})

it('validates uploads and reports sending, saving and success states', async () => {
  const pending = deferred<ReturnType<typeof file>>()
  const upload = vi.spyOn(api, 'uploadFile').mockReturnValue(pending.promise)
  const { container } = await renderPage(<FilesPage />)
  const picker = container.querySelector('input[type=file]')!
  fireEvent.change(picker, { target: { files: [new File([], 'empty.png')] } })
  expect(await screen.findByRole('alert')).toHaveTextContent('gol')
  expect(upload).not.toHaveBeenCalled()
  fireEvent.change(picker, { target: { files: [new File(['12345'], 'creative.png', { type: 'image/png' })] } })
  await waitFor(() => expect(upload).toHaveBeenCalledOnce())
  act(() => upload.mock.calls[0][1]?.onProgress?.(2))
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
  act(() => upload.mock.calls[0][1]?.onSent?.())
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toContain('se verifică și se salvează')
  await act(async () => pending.resolve(file()))
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument())
  expect(useNotifications.getState().notifications[0]?.message).toContain('Încărcat creative.png')
  expect(api.files).toHaveBeenCalledTimes(2)
})

it('retries recoverable upload failures using the selected file', async () => {
  const upload = vi.spyOn(api, 'uploadFile').mockRejectedValueOnce(new ApiError(500, 'Offline')).mockResolvedValue(file())
  const { container } = await renderPage(<FilesPage />)
  const input = new File(['x'], 'creative.png', { type: 'image/png' })
  fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [input] } })
  await userEvent.click(await screen.findByRole('button', { name: /Reîncearcă\s*încărcarea/ }))
  await waitFor(() => expect(upload).toHaveBeenCalledTimes(2))
  expect(upload.mock.calls[1][0]).toBe(input)
})

it('cancels uploads explicitly and silently cancels on unmount', async () => {
  const upload = vi.spyOn(api, 'uploadFile').mockImplementation((_file, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new DOMException('Canceled', 'AbortError')))
  }))
  const { container, unmount } = await renderPage(<FilesPage />)
  const choose = () => fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [new File(['x'], 'creative.png', { type: 'image/png' })] } })
  choose()
  await userEvent.click(await screen.findByRole('button', { name: /Anulează\s*încărcarea/ }))
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument())
  expect(upload.mock.calls[0][1]?.signal?.aborted).toBe(true)
  expect(useNotifications.getState().notifications).toHaveLength(1)
  choose()
  await act(async () => unmount())
  expect(upload.mock.calls[1][1]?.signal?.aborted).toBe(true)
  expect(useNotifications.getState().notifications).toHaveLength(1)
})

it('previews a file, reuses its download and releases the preview URL', async () => {
  const download = vi.spyOn(api, 'downloadFile').mockResolvedValue(new Blob(['image']))
  await renderPage(<FilesPage />)
  await userEvent.click(await screen.findByRole('button', { name: /^Previzualizează\s*creative\.png$/ }))
  const dialog = await screen.findByRole('dialog', { name: 'creative.png' })
  expect(await within(dialog).findByRole('img', { name: 'Previzualizarea fișierului creative.png' })).toHaveAttribute('src', 'blob:test-object')
  await userEvent.click(within(dialog).getByRole('button', { name: /^Descarcă\s*creative\.png$/ }))
  expect(download).toHaveBeenCalledOnce()
  await userEvent.click(screen.getByRole('button', { name: 'Închide previzualizarea' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-object')
})

it('downloads from the row and confirms deletion before refreshing the list', async () => {
  const download = vi.spyOn(api, 'downloadFile').mockResolvedValue(new Blob(['image']))
  const remove = vi.spyOn(api, 'deleteFile').mockResolvedValue(undefined)
  await renderPage(<FilesPage />)
  await userEvent.click(await screen.findByRole('button', { name: /^Descarcă\s*creative\.png$/ }))
  expect(download).toHaveBeenCalledWith(file())
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  await userEvent.click(screen.getByRole('button', { name: /^Șterge\s*creative\.png$/ }))
  expect(remove).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: /^Șterge\s*creative\.png$/ }))
  await waitFor(() => expect(remove).toHaveBeenCalled())
  expect(remove.mock.calls[0][0]).toBe(file().id)
  await waitFor(() => expect(api.files).toHaveBeenCalledTimes(2))
})

it('pages backward after deleting the final file on a later page', async () => {
  vi.mocked(api.files).mockResolvedValue({ files: [file()], total: 51 })
  vi.spyOn(api, 'deleteFile').mockResolvedValue(undefined)
  await renderPage(<FilesPage />)
  await userEvent.click(await screen.findByRole('button', { name: /Înainte/ }))
  await waitFor(() => expect(api.files).toHaveBeenCalledWith({ limit: 50, offset: 50 }, expect.any(AbortSignal)))
  await userEvent.click(screen.getByRole('button', { name: /^Șterge\s*creative\.png$/ }))
  await waitFor(() => expect(screen.getByRole('button', { name: /Înapoi/ })).toBeDisabled())
})

it('saves a download with its original name and releases the download URL', () => {
  vi.useFakeTimers()
  let filename = ''
  vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (this: HTMLAnchorElement) { filename = this.download })
  saveBlob(new Blob(['x']), 'original.png')
  expect(filename).toBe('original.png')
  expect(document.querySelector('a[download]')).toBeNull()
  vi.advanceTimersByTime(30_000)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-object')
})
