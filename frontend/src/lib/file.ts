/** Uploaded file metadata as `GET /files` returns it. Named to avoid the DOM `File`. */
export interface StoredFile {
  id: string
  /** Null once the owner's account has been deleted. */
  ownerId: string | null
  originalName: string
  mimeType: string
  size: number
  createdAt: string
  downloadUrl: string
}

export interface FilePage {
  files: StoredFile[]
  total: number
}

// Mirrors allowedTypes in backend/src/lib/file-validation.ts. The API sniffs the content and
// stays the authority; the browser uses this list for the file picker and an early check.
export const acceptedFileTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'] as const

const typeLabels: Record<string, string> = {
  'image/jpeg': 'JPEG image',
  'image/png': 'PNG image',
  'image/webp': 'WebP image',
  'video/mp4': 'MP4 video',
}

export function fileTypeLabel(mimeType: string) {
  return typeLabels[mimeType] ?? mimeType
}

export function fileKind(mimeType: string): 'image' | 'video' | 'other' {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  return 'other'
}

/**
 * Rejects a file whose declared type is known and unsupported before any byte is sent, since
 * the API answers only after the whole body arrives. A blank type is left to the API.
 */
export function declaredTypeError(file: File): string | undefined {
  if (file.size === 0) return `${file.name} is empty.`
  if (file.type && !acceptedFileTypes.some((type) => type === file.type)) {
    return `${file.name} is not a JPEG, PNG, WebP or MP4 file.`
  }
}
