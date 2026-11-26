import type { PlaylistStore } from './types'

export function createPlaylistStore(_userId: string, _assertActive: () => void): PlaylistStore {
  const unavailable = async (): Promise<never> => { throw new Error('Playlistul HDMI este disponibil în aplicația instalată pe telefon.') }
  return { load: async () => [], uri: () => '', addLocal: unavailable, remove: unavailable, move: unavailable }
}
