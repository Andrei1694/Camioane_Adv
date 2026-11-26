/**
 * An export failure the admin can act on, with a sentence ready to show. It lives apart from
 * renderVideo.ts so the page can recognise it without loading mediabunny.
 */
export class ExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportError'
  }
}
