import AVFoundation
import CoreImage

struct ScreenRectangle: Decodable {
  let sx: Double, sy: Double, sw: Double, sh: Double
  let dx: Double, dy: Double, dw: Double, dh: Double
}

struct ScreenLayout: Decodable {
  let width: Double, height: Double, sourceWidth: Double, sourceHeight: Double
  let regions: [ScreenRectangle]

  // Matches resolutionProblem in screenLayout.ts: H.264 needs even sides.
  static func isSide(_ value: Double) -> Bool {
    value >= 64 && value <= 4096 && value.truncatingRemainder(dividingBy: 2) == 0
  }

  static func parse(_ json: String) throws -> ScreenLayout {
    let layout = try JSONDecoder().decode(ScreenLayout.self, from: Data(json.utf8))
    guard isSide(layout.width), isSide(layout.height),
      layout.sourceWidth > 0, layout.sourceHeight > 0, layout.regions.count == 3,
      layout.regions.allSatisfy({ r in
        [r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh].allSatisfy { $0.isFinite && $0 >= 0 }
          && r.sw > 0 && r.sh > 0 && r.dw > 0 && r.dh > 0
      }) else { throw screenError("Configurația celor trei regiuni nu este validă.") }
    return layout
  }
}

func screenError(_ message: String) -> NSError {
  NSError(domain: "ScreenVideo", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}

final class ScreenInstruction: NSObject, AVVideoCompositionInstructionProtocol {
  let timeRange: CMTimeRange
  let enablePostProcessing = false
  let containsTweening = false
  let requiredSourceTrackIDs: [NSValue]?
  let passthroughTrackID = kCMPersistentTrackID_Invalid
  let trackID: CMPersistentTrackID
  let transform: CGAffineTransform
  let layout: ScreenLayout

  init(trackID: CMPersistentTrackID, duration: CMTime, transform: CGAffineTransform, layout: ScreenLayout) {
    self.trackID = trackID
    self.transform = transform
    self.layout = layout
    timeRange = CMTimeRange(start: .zero, duration: duration)
    requiredSourceTrackIDs = [NSNumber(value: trackID)]
  }
}

// One decoded frame is used three times. Preview and AVAssetReader share this compositor.
final class ScreenCompositor: NSObject, AVVideoCompositing {
  var sourcePixelBufferAttributes: [String: Any]? = [
    kCVPixelBufferPixelFormatTypeKey as String: [kCVPixelFormatType_32BGRA, kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange]
  ]
  var requiredPixelBufferAttributesForRenderContext: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferIOSurfacePropertiesKey as String: [:]
  ]
  private let queue = DispatchQueue(label: "camioane.screen.compositor")
  private let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
  private lazy var context = CIContext(options: [.workingColorSpace: colorSpace, .outputColorSpace: colorSpace])

  func renderContextChanged(_ newRenderContext: AVVideoCompositionRenderContext) {}

  func startRequest(_ request: AVAsynchronousVideoCompositionRequest) {
    queue.async {
      autoreleasepool {
        guard let instruction = request.videoCompositionInstruction as? ScreenInstruction else {
          request.finish(with: screenError("Configurația cadrului video nu este validă."))
          return
        }
        guard let target = request.renderContext.newPixelBuffer() else {
          request.finish(with: screenError("Nu există suficientă memorie pentru cadrul video."))
          return
        }
        let layout = instruction.layout
        let bounds = CGRect(x: 0, y: 0, width: layout.width, height: layout.height)
        var composed = CIImage(color: .black).cropped(to: bounds)
        // A valid MP4 can begin with an empty edit, have a gap, or have audio
        // extending beyond its last video frame. AVFoundation requests those
        // times without a source buffer. Preserve the timeline with black;
        // actual decoder failures still fail the AVAssetReader/AVPlayerItem.
        guard let source = request.sourceFrame(byTrackID: instruction.trackID) else {
          self.context.render(composed, to: target, bounds: bounds, colorSpace: self.colorSpace)
          request.finish(withComposedVideoFrame: target)
          return
        }
        var image = CIImage(cvPixelBuffer: source)
        // preferredTransform uses top-left video coordinates; Core Image uses bottom-left.
        image = image.transformed(by: CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: image.extent.height))
          .transformed(by: instruction.transform)
        image = image.transformed(by: CGAffineTransform(translationX: -image.extent.minX, y: -image.extent.minY))
        image = image.transformed(by: CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: image.extent.height))
        for r in layout.regions {
          let crop = CGRect(x: r.sx, y: layout.sourceHeight - r.sy - r.sh, width: r.sw, height: r.sh)
          let piece = image.cropped(to: crop)
            .transformed(by: CGAffineTransform(translationX: -crop.minX, y: -crop.minY))
            .transformed(by: CGAffineTransform(scaleX: r.dw / r.sw, y: r.dh / r.sh))
            .transformed(by: CGAffineTransform(translationX: r.dx, y: layout.height - r.dy - r.dh))
          composed = piece.composited(over: composed)
        }
        self.context.render(composed, to: target, bounds: bounds, colorSpace: self.colorSpace)
        request.finish(withComposedVideoFrame: target)
      }
    }
  }

  func cancelAllPendingVideoCompositionRequests() { queue.sync {} }
}

func makeScreenComposition(track: AVAssetTrack, duration: CMTime, transform: CGAffineTransform,
  frameDuration: CMTime, layout: ScreenLayout) -> AVMutableVideoComposition {
  let composition = AVMutableVideoComposition()
  composition.customVideoCompositorClass = ScreenCompositor.self
  composition.renderSize = CGSize(width: layout.width, height: layout.height)
  composition.frameDuration = frameDuration.isValid && frameDuration.seconds > 0 ? frameDuration : CMTime(value: 1, timescale: 30)
  composition.instructions = [ScreenInstruction(trackID: track.trackID, duration: duration, transform: transform, layout: layout)]
  composition.colorPrimaries = AVVideoColorPrimaries_ITU_R_709_2
  composition.colorTransferFunction = AVVideoTransferFunction_ITU_R_709_2
  composition.colorYCbCrMatrix = AVVideoYCbCrMatrix_ITU_R_709_2
  return composition
}
