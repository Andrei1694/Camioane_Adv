import AVFoundation
import ExpoModulesCore

// Lifecycle state belongs to the control queue. Audio and video each need their
// own queue: a blocking read must not prevent the other stream from draining.
// Cancellation settles only after both queues stop using the media files.
final class ScreenExport: @unchecked Sendable {
  let id: String
  private let queue = DispatchQueue(label: "camioane.screen.export")
  private let videoQueue = DispatchQueue(label: "camioane.screen.export.video")
  private let audioQueue = DispatchQueue(label: "camioane.screen.export.audio")
  private var reader: AVAssetReader?
  private var writer: AVAssetWriter?
  private var asset: AVURLAsset?
  private var finished = false
  private var remaining = 0
  private var lastProgress = -1
  private let promise: Promise
  private let onProgress: (Double) -> Void
  private let onFinish: () -> Void

  init(id: String, promise: Promise, onProgress: @escaping (Double) -> Void, onFinish: @escaping () -> Void) {
    self.id = id
    self.promise = promise
    self.onProgress = onProgress
    self.onFinish = onFinish
  }

  func start(uri: String, output: String, layout: ScreenLayout) {
    Task {
      do {
        guard let inputURL = URL(string: uri), inputURL.isFileURL,
          let outputURL = URL(string: output), outputURL.isFileURL else { throw screenError("Fișierul video trebuie să fie local.") }
        let asset = AVURLAsset(url: inputURL)
        let active = self.queue.sync { () -> Bool in
          guard !self.finished else { return false }
          self.asset = asset
          return true
        }
        guard active else { return }
        self.queue.asyncAfter(deadline: .now() + 30) {
          if !self.finished && self.reader == nil { self.fail(screenError("Pregătirea videoclipului a durat prea mult.")) }
        }
        guard let track = try await asset.loadTracks(withMediaType: .video).first else { throw screenError("Fișierul nu are o pistă video.") }
        let duration = try await asset.load(.duration)
        let transform = try await track.load(.preferredTransform)
        let frameDuration = try await track.load(.minFrameDuration)
        let audio = try await asset.loadTracks(withMediaType: .audio).first
        guard duration.seconds.isFinite, duration.seconds > 0 else { throw screenError("Durata videoclipului nu este validă.") }
        let descriptions = try await audio?.load(.formatDescriptions)
        let audioFormat = descriptions?.first.flatMap { CMAudioFormatDescriptionGetStreamBasicDescription($0)?.pointee }
        self.queue.async {
          guard !self.finished else { return }
          do {
            let reader = try AVAssetReader(asset: asset)
            let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
            self.reader = reader
            self.writer = writer
            writer.shouldOptimizeForNetworkUse = true
            let videoOutput = AVAssetReaderVideoCompositionOutput(videoTracks: [track], videoSettings: [
              kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
            ])
            videoOutput.videoComposition = makeScreenComposition(track: track, duration: duration,
              transform: transform, frameDuration: frameDuration, layout: layout)
            videoOutput.alwaysCopiesSampleData = false
            let settings: [String: Any] = [
              AVVideoCodecKey: AVVideoCodecType.h264,
              AVVideoWidthKey: 2304, AVVideoHeightKey: 512,
              AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 12_000_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel],
              AVVideoColorPropertiesKey: [AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
                AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2, AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2]
            ]
            guard writer.canApply(outputSettings: settings, forMediaType: .video) else {
              throw screenError("Acest iPhone nu poate codifica H.264 la 2304 × 512.")
            }
            let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
            videoInput.expectsMediaDataInRealTime = false
            guard reader.canAdd(videoOutput), writer.canAdd(videoInput) else { throw screenError("Conversia video nu este disponibilă.") }
            reader.add(videoOutput)
            writer.add(videoInput)
            var streams: [(AVAssetReaderOutput, AVAssetWriterInput, Bool)] = [(videoOutput, videoInput, true)]
            if let audio = audio {
              let audioOutput = AVAssetReaderTrackOutput(track: audio, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
              let audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: [
                AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: audioFormat?.mSampleRate ?? 44100,
                AVNumberOfChannelsKey: min(audioFormat?.mChannelsPerFrame ?? 2, 2), AVEncoderBitRateKey: 192_000
              ])
              guard reader.canAdd(audioOutput), writer.canAdd(audioInput) else { throw screenError("Sunetul nu poate fi păstrat în acest MP4.") }
              reader.add(audioOutput)
              writer.add(audioInput)
              streams.append((audioOutput, audioInput, false))
            }
            guard writer.startWriting(), reader.startReading() else { throw reader.error ?? writer.error ?? screenError("Conversia nu a putut începe.") }
            writer.startSession(atSourceTime: .zero)
            self.remaining = streams.count
            for (output, input, video) in streams {
              let streamQueue = video ? self.videoQueue : self.audioQueue
              // Accessed only on this stream's serial queue.
              var ended = false
              input.requestMediaDataWhenReady(on: streamQueue) { [weak self] in
                guard let self = self, !ended else { return }
                while input.isReadyForMoreMediaData && self.queue.sync(execute: { !self.finished }) {
                  let continued: Bool = autoreleasepool {
                    guard let sample = output.copyNextSampleBuffer() else { return false }
                    guard self.queue.sync(execute: { !self.finished }) else { return false }
                    guard input.append(sample) else {
                      self.queue.async { self.fail(writer.error ?? screenError("Cadrul video nu a putut fi salvat.")) }
                      return false
                    }
                    if video {
                      let fraction = min(0.99, max(0, CMSampleBufferGetPresentationTimeStamp(sample).seconds / duration.seconds))
                      let percent = Int(fraction * 100)
                      self.queue.async {
                        guard !self.finished else { return }
                        if percent != self.lastProgress { self.lastProgress = percent; self.onProgress(fraction) }
                      }
                    }
                    return true
                  }
                  if self.queue.sync(execute: { self.finished }) { ended = true; return }
                  if !continued {
                    ended = true
                    input.markAsFinished()
                    self.queue.async {
                      guard !self.finished else { return }
                      if reader.status == .failed { self.fail(reader.error ?? screenError("Videoclipul nu poate fi decodat.")); return }
                      self.remaining -= 1
                      guard self.remaining == 0 else { return }
                      // The audio and video can end between different frame boundaries.
                      writer.endSession(atSourceTime: duration)
                      writer.finishWriting {
                        self.queue.async {
                          guard !self.finished else { return }
                          if writer.status == .completed {
                            self.finished = true
                            self.reader = nil
                            self.writer = nil
                            self.asset = nil
                            self.onProgress(1)
                            self.promise.resolve(nil)
                            self.onFinish()
                          } else { self.fail(writer.error ?? screenError("Conversia nu a putut fi finalizată.")) }
                        }
                      }
                    }
                    return
                  }
                }
              }
            }
          } catch { self.fail(error) }
        }
      } catch { self.queue.async { self.fail(error) } }
    }
  }

  func cancel() { queue.async { self.fail(screenError("Conversia a fost anulată.")) } }

  private func fail(_ error: Error) {
    guard !finished else { return }
    finished = true
    reader?.cancelReading()
    asset?.cancelLoading()
    let drained = DispatchGroup()
    for streamQueue in [videoQueue, audioQueue] {
      drained.enter()
      streamQueue.async { drained.leave() }
    }
    drained.notify(queue: queue) {
      self.writer?.cancelWriting()
      self.reader = nil
      self.writer = nil
      self.asset = nil
      self.promise.reject("ERR_SCREEN_CONVERSION", error.localizedDescription)
      self.onFinish()
    }
  }
}
