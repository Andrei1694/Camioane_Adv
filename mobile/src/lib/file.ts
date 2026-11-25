export interface StoredFile {
  id: string
  ownerId: string | null
  originalName: string
  mimeType: string
  size: number
  createdAt: string
  downloadUrl: string
}
export interface FilePage { files: StoredFile[]; total: number }
