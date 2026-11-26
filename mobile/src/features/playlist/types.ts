import type { LocalVideo } from '../screen/types'

export interface PlaylistItem {
  id: string
  name: string
  source: 'device' | 'server'
  fileId?: string
  size: number
  /** Relative to the user's playlist directory; never an arbitrary file path. */
  file: string
}

export interface PlaylistStore {
  load(): Promise<PlaylistItem[]>
  uri(item: PlaylistItem): string
  addLocal(video: LocalVideo, source: PlaylistItem['source'], fileId?: string): Promise<PlaylistItem[]>
  /** Caller must detach native readers before removing a file. */
  remove(id: string): Promise<PlaylistItem[]>
  move(from: number, to: number): Promise<PlaylistItem[]>
}
