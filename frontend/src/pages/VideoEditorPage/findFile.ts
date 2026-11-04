import type { QueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../../lib/api'
import type { FilePage, StoredFile } from '../../lib/file'

// The API's largest page.
const scanPageSize = 100

/**
 * The API has no single-file endpoint, so a file's metadata comes from a Files page already in the
 * cache (the usual way in, from the Edit link) or, after a reload or from a shared link, from
 * scanning the list until the file turns up.
 */
export async function findFile(queryClient: QueryClient, revision: number, id: string, signal: AbortSignal): Promise<StoredFile> {
  // File IDs are lowercase UUIDs; anything else can't be in the list.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new ApiError(404, 'File not found')
  for (const [, page] of queryClient.getQueriesData<FilePage>({ queryKey: ['files', revision] })) {
    const cached = page?.files.find((file) => file.id === id)
    if (cached) return cached
  }
  for (let offset = 0; ; offset += scanPageSize) {
    const page = await api.files({ limit: scanPageSize, offset }, signal)
    const found = page.files.find((file) => file.id === id)
    if (found) return found
    if (page.files.length === 0 || offset + scanPageSize >= page.total) throw new ApiError(404, 'File not found')
  }
}
