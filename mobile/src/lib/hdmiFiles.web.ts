export interface HdmiVideo { uri: string; name: string; source: 'sample' | 'imported' }

export async function loadSampleVideo(): Promise<HdmiVideo | null> {
  return null
}

export async function pickVideo(): Promise<HdmiVideo | null> {
  return null
}

export function deleteVideoCopy(_video: HdmiVideo) {
  // The browser cannot create an HDMI playback session or a temporary native file.
}
