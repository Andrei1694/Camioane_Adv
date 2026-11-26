export type PlaybackState = 'idle' | 'loading' | 'ready' | 'playing' | 'buffering' | 'paused' | 'stopped' | 'error'

/** Offset and uniform scale in HDMI pixels, independent of the editor canvas. */
export interface HdmiPlacement { x: number; y: number; scale: number }

export interface HdmiStatus {
  sessionId: string
  display: { name: string; width: number; height: number } | null
  /**
   * `loading` is initial preparation; `buffering` retains an explicit Play request.
   * A terminal `error` is emitted only after the native media readers detach.
   */
  playback: PlaybackState
  error: string | null
  index: number | null
  count: number
  video: { width: number; height: number } | null
  placement: HdmiPlacement
  modes: { width: number; height: number }[]
  pattern: boolean
}

export interface HdmiPlayer {
  /** Both platforms enforce the login expiry (epoch milliseconds); null is the local preview. */
  start(sessionId: string, expiresAt?: number | null): Promise<HdmiStatus>
  /** Integer offsets −4096…4096, finite scale 0.1…4. Rejects stale/expired sessions. */
  setPlacement(sessionId: string, x: number, y: number, scale: number): Promise<void>
  /** Fixed HDMI-pixel grid; temporarily hides video without changing playback intent. */
  setPattern(sessionId: string, enabled: boolean): Promise<void>
  /**
   * Prepares the list at startIndex (default 0), resolving when its first item
   * is playable. An empty list detaches readers and returns to idle.
   * ERR_HDMI_PREPARE_FAILED and ERR_HDMI_CANCELLED confirm that the replaced
   * and attempted media have been detached. Other failures require release
   * before their cached files may be deleted. Release cancels pending preparation.
   */
  prepare(sessionId: string, uris: string[], startIndex?: number): Promise<void>
  /** Jump to an item, preserving the current play/pause intent. */
  skip(sessionId: string, index: number): Promise<void>
  play(sessionId: string): Promise<void>
  pause(sessionId: string): Promise<void>
  stop(sessionId: string): Promise<void>
  /** Resolves after teardown; a failed release retains ownership for a retry. */
  release(sessionId: string): Promise<void>
  addListener(event: 'onStatus', listener: (status: HdmiStatus) => void): { remove(): void }
}
