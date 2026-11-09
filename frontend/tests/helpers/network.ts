import { vi } from 'vitest'

export const jsonResponse = (body: unknown, status = 200) => new Response(
  status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } },
)

export function respond(body: unknown, status = 200) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse(body, status))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

/** Controllable transport, without emulating the application's upload logic. */
export class TestXHR {
  static instances: TestXHR[] = []
  method = ''
  url = ''
  headers: Record<string, string> = {}
  body: FormData | null = null
  status = 0
  response: unknown = null
  responseType = ''
  timeout = 0
  upload: { onprogress?: (event: ProgressEvent) => void, onload?: () => void } = {}
  onload?: () => void
  onerror?: () => void
  ontimeout?: () => void
  onabort?: () => void
  constructor() { TestXHR.instances.push(this) }
  open(method: string, url: string) { this.method = method; this.url = url }
  setRequestHeader(name: string, value: string) { this.headers[name] = value }
  send(body: FormData) { this.body = body }
  abort() { this.onabort?.() }
  complete(body: unknown, status = 200) { this.status = status; this.response = body; this.onload?.() }
  progress(loaded: number, total: number, lengthComputable = true) {
    this.upload.onprogress?.(new ProgressEvent('progress', { loaded, total, lengthComputable }))
  }
  static install() {
    TestXHR.instances = []
    vi.stubGlobal('XMLHttpRequest', TestXHR)
  }
  static last() { return TestXHR.instances[TestXHR.instances.length - 1] }
}
