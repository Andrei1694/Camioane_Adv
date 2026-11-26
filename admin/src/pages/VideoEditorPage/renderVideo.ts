// Renders an edit to a new MP4 in the browser with WebCodecs. The page imports this module only
// when the admin exports, so mediabunny stays out of the editor's own chunk.
import {
  AudioSampleSink,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Input,
  MP4,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  VideoSampleSink,
  VideoSampleSource,
} from 'mediabunny'
import type { InputAudioTrack, InputVideoTrack } from 'mediabunny'
import { layout, totalLength } from './edit'
import type { Segment } from './edit'
import { ExportError } from './exportError'

export interface RenderOptions {
  signal: AbortSignal
  /** The share of the edit rendered so far, from 0 to 1. */
  onProgress: (fraction: number) => void
}

const cancelled = () => new DOMException('Export cancelled', 'AbortError')

/** Renders the segments, in order and back to back, into an MP4 with H.264 video. */
export async function renderEdit(source: Blob, segments: readonly Segment[], { signal, onProgress }: RenderOptions): Promise<Blob> {
  const input = new Input({ source: new BlobSource(source), formats: [MP4] })
  let output: Output<Mp4OutputFormat, BufferTarget> | undefined
  try {
    const video = await input.getPrimaryVideoTrack()
    if (!video) throw new ExportError('Acest fișier nu are o pistă video de exportat.')
    if (!(await video.canDecode())) throw new ExportError("Acest browser nu poate decoda videoclipul. Încearcă o versiune recentă de Chrome, Edge sau Safari.")
    const audio = await input.getPrimaryAudioTrack()
    if (audio && !(await audio.canDecode())) throw new ExportError("Acest browser nu poate decoda sunetul videoclipului. Încearcă o versiune recentă de Chrome, Edge sau Safari.")

    // H.264 is the format LED screen controllers are most likely to play.
    const videoCodec = await getFirstEncodableVideoCodec(['avc'], {
      width: await video.getCodedWidth(), height: await video.getCodedHeight(), quality: QUALITY_HIGH,
    })
    if (!videoCodec) throw new ExportError("Acest browser nu poate codifica video H.264. Folosește o versiune recentă de Chrome, Edge sau Safari.")
    const audioCodec = audio ? await getFirstEncodableAudioCodec(['aac', 'opus'], {
      numberOfChannels: await audio.getNumberOfChannels(), sampleRate: await audio.getSampleRate(), quality: QUALITY_HIGH,
    }) : null
    if (audio && !audioCodec) throw new ExportError("Acest browser nu poate codifica sunetul videoclipului. Folosește o versiune recentă de Chrome, Edge sau Safari.")
    signal.throwIfAborted()

    // The whole file is built in memory, with its index at the front so players can start it at once.
    output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
    const videoSource = new VideoSampleSource({ codec: videoCodec, quality: QUALITY_HIGH })
    // Decoded frames are stored unrotated; the track carries the source's rotation and flip as metadata.
    output.addVideoTrack(videoSource, { rotation: await video.getRotation(), flip: await video.getFlip() })
    const audioSource = audioCodec ? new AudioSampleSource({ codec: audioCodec, quality: QUALITY_HIGH }) : undefined
    if (audioSource) output.addAudioTrack(audioSource)
    await output.start()

    const total = totalLength(segments)
    await Promise.all([
      pumpVideo(video, videoSource, segments, signal, (done) => onProgress(total > 0 ? Math.min(done / total, 1) : 1)),
      audio && audioSource ? pumpAudio(audio, audioSource, segments, signal) : undefined,
    ])
    await output.finalize()
    const buffer = output.target.buffer
    if (!buffer) throw new ExportError("Videoclipul exportat este gol. Încearcă din nou.")
    return new Blob([buffer], { type: 'video/mp4' })
  } catch (error) {
    if (output && output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => undefined)
    if (signal.aborted) throw cancelled()
    if (error instanceof ExportError) throw error
    throw new ExportError('Videoclipul nu a putut fi exportat. Încearcă din nou sau folosește o versiune recentă de Chrome, Edge ori Safari.')
  } finally {
    input.dispose()
  }
}

/** Frames are clamped to their segment, then shifted to where the segment sits in the output. */
async function pumpVideo(track: InputVideoTrack, source: VideoSampleSource, segments: readonly Segment[], signal: AbortSignal, onDone: (seconds: number) => void) {
  const sink = new VideoSampleSink(track)
  for (const { segment, start } of layout(segments)) {
    for await (const sample of sink.samples(segment.sourceStart, segment.sourceEnd)) {
      try {
        if (signal.aborted) throw cancelled()
        const from = Math.max(sample.timestamp, segment.sourceStart)
        const to = Math.min(sample.timestamp + sample.duration, segment.sourceEnd)
        if (to <= from) continue
        sample.setTimestamp(start + from - segment.sourceStart)
        sample.setDuration(to - from)
        await source.add(sample)
        onDone(start + to - segment.sourceStart)
      } finally {
        sample.close()
      }
    }
  }
  source.close()
}

/** Samples that straddle a cut are trimmed to the exact frame, so sound stays in step across cuts. */
async function pumpAudio(track: InputAudioTrack, source: AudioSampleSource, segments: readonly Segment[], signal: AbortSignal) {
  const sink = new AudioSampleSink(track)
  for (const { segment, start } of layout(segments)) {
    for await (const sample of sink.samples(segment.sourceStart, segment.sourceEnd)) {
      let kept = sample
      try {
        if (signal.aborted) throw cancelled()
        const first = sample.timestamp < segment.sourceStart ? Math.round((segment.sourceStart - sample.timestamp) * sample.sampleRate) : 0
        const last = sample.timestamp + sample.duration > segment.sourceEnd
          ? Math.round((segment.sourceEnd - sample.timestamp) * sample.sampleRate) : sample.numberOfFrames
        if (first >= last) continue
        if (first > 0 || last < sample.numberOfFrames) kept = sample.trim(first, last)
        kept.setTimestamp(start + Math.max(kept.timestamp, segment.sourceStart) - segment.sourceStart)
        await source.add(kept)
      } finally {
        if (kept !== sample) kept.close()
        sample.close()
      }
    }
  }
  source.close()
}
