import { fetch } from 'expo/fetch'
import { File, FileMode, UploadTask, UploadType } from 'expo-file-system'
import { allocateVideo, completeVideo, deleteVideo } from '../features/screen/videoFiles'
import type { LocalVideo } from '../features/screen/types'

export interface TransferOptions {
  signal: AbortSignal
  headers: Record<string, string>
  onProgress?: (fraction: number) => void
}

export async function downloadVideo(url: string, name: string, options: TransferOptions) {
  const response = await fetch(url, { headers: options.headers, signal: options.signal, credentials: 'omit', redirect: 'error' })
  if (!response.ok) return { status: response.status, body: await response.json().catch(() => undefined), video: undefined }
  const video = allocateVideo(name)
  const file = new File(video.uri)
  try {
    if (!response.body) throw new Error('Descărcarea nu conține un videoclip.')
    file.create()
    const handle = file.open(FileMode.WriteOnly)
    const reader = response.body.getReader()
    const length = Number(response.headers.get('content-length'))
    let received = 0
    try {
      for (;;) {
        options.signal.throwIfAborted()
        const { value, done } = await reader.read()
        if (done) break
        await handle.writeBytes(value)
        received += value.byteLength
        if (length > 0) options.onProgress?.(Math.min(received / length, 1))
      }
    } finally {
      handle.close()
      await reader.cancel().catch(() => {})
    }
    options.signal.throwIfAborted()
    return { status: response.status, body: undefined, video: completeVideo(video) }
  } catch (error) {
    await deleteVideo(video)
    throw error
  }
}

export async function uploadVideo(url: string, video: LocalVideo, options: TransferOptions) {
  const task = new UploadTask(new File(video.uri), url, {
    httpMethod: 'POST', uploadType: UploadType.MULTIPART, fieldName: 'file', mimeType: 'video/mp4',
    headers: options.headers, signal: options.signal, sessionType: 'foreground',
    onProgress: ({ bytesSent, totalBytes }) => options.onProgress?.(totalBytes > 0 ? Math.min(bytesSent / totalBytes, 1) : 0),
  })
  try {
    const result = await task.uploadAsync()
    let body: unknown
    try { body = JSON.parse(result.body) } catch { /* The API decoder reports malformed responses. */ }
    return { status: result.status, body }
  } finally { task.release() }
}
