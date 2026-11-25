import { fromBlob } from '../features/screen/videoFiles.web'
import { abortError } from '../features/screen/types'
import type { LocalVideo } from '../features/screen/types'

export interface TransferOptions {
  signal: AbortSignal
  headers: Record<string, string>
  onProgress?: (fraction: number) => void
}
export async function downloadVideo(url: string, name: string, options: TransferOptions) {
  const response = await fetch(url, { headers: options.headers, signal: options.signal, credentials: 'omit', redirect: 'error' })
  if (!response.ok) return { status: response.status, body: await response.json().catch(() => undefined), video: undefined }
  const blob = await response.blob()
  options.signal.throwIfAborted()
  options.onProgress?.(1)
  return { status: response.status, body: undefined, video: fromBlob(blob, name) }
}
export async function uploadVideo(url: string, video: LocalVideo, options: TransferOptions): Promise<{ status: number; body: unknown }> {
  const blob = await (await fetch(video.uri, { signal: options.signal })).blob()
  options.signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    const clean = () => options.signal.removeEventListener('abort', abort)
    xhr.open('POST', url)
    for (const [key, value] of Object.entries(options.headers)) xhr.setRequestHeader(key, value)
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) options.onProgress?.(event.loaded / event.total) }
    xhr.onload = () => {
      clean()
      let body: unknown
      try { body = JSON.parse(xhr.responseText) } catch { /* Handled by API decoder. */ }
      resolve({ status: xhr.status, body })
    }
    xhr.onerror = () => { clean(); reject(new Error('Încărcarea a eșuat. Verifică conexiunea.')) }
    xhr.onabort = () => { clean(); reject(abortError()) }
    options.signal.addEventListener('abort', abort, { once: true })
    const form = new FormData()
    form.append('file', blob, video.name)
    xhr.send(form)
  })
}
