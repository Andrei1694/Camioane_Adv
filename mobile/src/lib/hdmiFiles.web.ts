export type SampleVideo = 'flower' | 'truck-screen'
export interface HdmiVideo { uri: string; name: string; source: 'sample' | 'imported'; sample?: SampleVideo }

export async function loadSampleVideo(_sample: SampleVideo = 'flower'): Promise<HdmiVideo | null> {
  return null
}

export async function pickVideo(): Promise<HdmiVideo | null> {
  return null
}

export function deleteVideoCopy(_video: HdmiVideo) {
  // The browser cannot create an HDMI playback session or a temporary native file.
}
