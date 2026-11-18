export type PlaybackState = 'idle' | 'loading' | 'ready' | 'playing' | 'buffering' | 'paused' | 'stopped' | 'error'

export interface HdmiStatus {
  sessionId: string
  display: { name: string; width: number; height: number } | null
  /**
   * `loading` is initial preparation; `buffering` retains an explicit Play request.
   * A terminal `error` is emitted only after the native media readers detach.
   */
  playback: PlaybackState
  error: string | null
}

export interface HdmiPlayer {
  /** iOS also accepts the login expiry (epoch milliseconds); null is the local preview. */
  start(sessionId: string, expiresAt?: number | null): Promise<HdmiStatus>
  /**
   * Resolves when the video is playable, not merely when loading starts.
   * ERR_HDMI_PREPARE_FAILED and ERR_HDMI_CANCELLED confirm that the replaced
   * and attempted media have been detached. Other failures require release
   * before their cached files may be deleted. Release cancels pending preparation.
   */
  prepare(sessionId: string, uri: string): Promise<void>
  play(sessionId: string): Promise<void>
  pause(sessionId: string): Promise<void>
  stop(sessionId: string): Promise<void>
  /** Resolves after teardown; a failed release retains ownership for a retry. */
  release(sessionId: string): Promise<void>
  addListener(event: 'onStatus', listener: (status: HdmiStatus) => void): { remove(): void }
}
