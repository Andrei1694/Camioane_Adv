// Loaded only on conversion, keeping mediabunny out of the page's own chunk.
import {
  AudioSampleSink, AudioSampleSource, BlobSource, BufferTarget, CanvasSource,
  getFirstEncodableAudioCodec, getFirstEncodableVideoCodec, Input, MP4,
  Mp4OutputFormat, Output, QUALITY_HIGH, VideoSampleSink,
} from 'mediabunny'
import type { InputAudioTrack, InputVideoTrack } from 'mediabunny'
import { ExportError } from './exportError'
import { screenCanvas } from './screenLayout'
import type { Composition } from './types'

export async function renderScreen(source: Blob, composition: Composition, { signal, onProgress }: {
  signal: AbortSignal
  onProgress: (fraction: number) => void
}): Promise<Blob> {
  const input = new Input({ source: new BlobSource(source), formats: [MP4] })
  let output: Output<Mp4OutputFormat, BufferTarget> | undefined
  try {
    signal.throwIfAborted()
    const video = await input.getPrimaryVideoTrack()
    if (!video) throw new ExportError('Acest fișier nu are o pistă video de convertit.')
    if (!(await video.canDecode())) throw new ExportError('Acest browser nu poate decoda videoclipul. Încearcă o versiune recentă de Chrome, Edge sau Safari.')
    const audio = await input.getPrimaryAudioTrack()
    if (audio && !(await audio.canDecode())) throw new ExportError('Acest browser nu poate decoda sunetul videoclipului. Încearcă o versiune recentă de Chrome, Edge sau Safari.')
    const videoCodec = await getFirstEncodableVideoCodec(['avc'], { ...screenCanvas, quality: QUALITY_HIGH })
    if (!videoCodec) throw new ExportError('Acest browser nu poate codifica video H.264 la 2304 × 512. Folosește o versiune recentă de Chrome, Edge sau Safari.')
    const audioCodec = audio ? await getFirstEncodableAudioCodec(['aac', 'opus'], {
      numberOfChannels: await audio.getNumberOfChannels(), sampleRate: await audio.getSampleRate(), quality: QUALITY_HIGH,
    }) : null
    if (audio && !audioCodec) throw new ExportError('Acest browser nu poate codifica sunetul videoclipului. Folosește o versiune recentă de Chrome, Edge sau Safari.')
    let duration = await video.computeDuration()
    if (!Number.isFinite(duration) || duration <= 0) duration = await input.computeDuration()
    if (!Number.isFinite(duration) || duration <= 0) throw new ExportError('Durata videoclipului nu a putut fi citită.')
    signal.throwIfAborted()

    const canvas = new OffscreenCanvas(screenCanvas.width, screenCanvas.height)
    const context = canvas.getContext('2d')
    if (!context) throw new ExportError('Acest browser nu poate crea imaginea pentru ecranul camionului.')
    output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
    const videoSource = new CanvasSource(canvas, { codec: videoCodec, quality: QUALITY_HIGH })
    // sample.draw already applies rotation and flip. The combined picture stays upright.
    output.addVideoTrack(videoSource)
    const audioSource = audioCodec ? new AudioSampleSource({ codec: audioCodec, quality: QUALITY_HIGH }) : undefined
    if (audioSource) output.addAudioTrack(audioSource)
    await output.start()
    await Promise.all([
      pumpVideo(video, videoSource, context, composition, signal, (timestamp) => onProgress(Math.max(0, Math.min(timestamp / duration, 1)))),
      audio && audioSource ? pumpAudio(audio, audioSource, signal) : undefined,
    ])
    signal.throwIfAborted()
    await output.finalize()
    signal.throwIfAborted()
    const buffer = output.target.buffer
    if (!buffer) throw new ExportError('Videoclipul convertit este gol. Încearcă din nou.')
    onProgress(1)
    return new Blob([buffer], { type: 'video/mp4' })
  } catch (error) {
    if (output && output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => undefined)
    if (signal.aborted) throw new DOMException('Conversion cancelled', 'AbortError')
    if (error instanceof ExportError) throw error
    throw new ExportError('Videoclipul nu a putut fi convertit. Încearcă din nou sau folosește o versiune recentă de Chrome, Edge ori Safari.')
  } finally {
    input.dispose()
  }
}

async function pumpVideo(track: InputVideoTrack, source: CanvasSource, context: OffscreenCanvasRenderingContext2D,
  composition: Composition, signal: AbortSignal, onDone: (timestamp: number) => void) {
  for await (const sample of new VideoSampleSink(track).samples()) {
    try {
      signal.throwIfAborted()
      context.fillStyle = '#000'
      context.fillRect(0, 0, screenCanvas.width, screenCanvas.height)
      // Use the preview's rectangles, normalizing source pixels if the browser's
      // video element and decoder report different pixel-aspect dimensions.
      const scaleX = sample.displayWidth / composition.sourceWidth
      const scaleY = sample.displayHeight / composition.sourceHeight
      for (const { sx, sy, sw, sh, dx, dy, dw, dh } of composition.regions) {
        sample.draw(context, sx * scaleX, sy * scaleY, sw * scaleX, sh * scaleY, dx, dy, dw, dh)
      }
      await source.add(sample.timestamp, sample.duration)
      onDone(sample.timestamp)
    } finally {
      sample.close()
    }
  }
  source.close()
}

async function pumpAudio(track: InputAudioTrack, source: AudioSampleSource, signal: AbortSignal) {
  for await (const sample of new AudioSampleSink(track).samples()) {
    try {
      signal.throwIfAborted()
      await source.add(sample)
    } finally {
      sample.close()
    }
  }
  source.close()
}
