import AVFoundation
import ExpoModulesCore
import UIKit

final class ScreenSession {
  let asset: AVURLAsset
  let player = AVPlayer()
  var track: AVAssetTrack?
  var duration = CMTime.zero
  var transform = CGAffineTransform.identity
  var frameDuration = CMTime(value: 1, timescale: 30)
  var observer: Any?
  var failureObserver: NSKeyValueObservation?
  var promise: Promise?
  init(uri: URL) { asset = AVURLAsset(url: uri) }
  func release() {
    player.pause()
    if let observer = observer { player.removeTimeObserver(observer); self.observer = nil }
    failureObserver = nil
    player.replaceCurrentItem(with: nil)
    asset.cancelLoading()
    promise?.reject("ERR_SCREEN_CANCELLED", "Previzualizarea a fost închisă.")
    promise = nil
  }
}

final class ScreenStore {
  static let shared = ScreenStore()
  var sessions: [String: ScreenSession] = [:]
}

final class ScreenPreviewView: ExpoView {
  private let videoLayer = AVPlayerLayer()
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .black
    videoLayer.videoGravity = .resizeAspect
    layer.addSublayer(videoLayer)
  }
  func bind(_ id: String) { videoLayer.player = ScreenStore.shared.sessions[id]?.player }
  override func layoutSubviews() { super.layoutSubviews(); videoLayer.frame = bounds }
  deinit { videoLayer.player = nil }
}

public final class ScreenVideoModule: Module {
  private var exports: [String: ScreenExport] = [:]
  private var owned = Set<String>()
  private var backgroundObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("ScreenVideo")
    Events("onPlayback", "onProgress")
    View(ScreenPreviewView.self) { Prop("sessionId") { (view: ScreenPreviewView, id: String) in view.bind(id) } }

    OnCreate {
      self.backgroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
        self?.exports.values.forEach { $0.cancel() }
        self?.owned.forEach { ScreenStore.shared.sessions[$0]?.player.pause() }
      }
    }

    AsyncFunction("open") { (id: String, uri: String, promise: Promise) in
      guard let url = URL(string: uri), url.isFileURL else { promise.reject("ERR_SCREEN_FILE", "Alege un MP4 local."); return }
      let session = ScreenSession(uri: url)
      session.promise = promise
      ScreenStore.shared.sessions[id]?.release()
      ScreenStore.shared.sessions[id] = session
      self.owned.insert(id)
      DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
        guard ScreenStore.shared.sessions[id] === session, session.promise != nil else { return }
        session.promise?.reject("ERR_SCREEN_OPEN", "Pregătirea videoclipului a durat prea mult.")
        session.promise = nil
        session.release()
        ScreenStore.shared.sessions.removeValue(forKey: id)
        self.owned.remove(id)
      }
      Task { @MainActor in
        do {
          guard let track = try await session.asset.loadTracks(withMediaType: .video).first else { throw screenError("Fișierul nu are o pistă video.") }
          let size = try await track.load(.naturalSize)
          let transform = try await track.load(.preferredTransform)
          let duration = try await session.asset.load(.duration)
          let frameDuration = try await track.load(.minFrameDuration)
          let bounds = CGRect(origin: .zero, size: size).applying(transform)
          guard bounds.width > 0, bounds.height > 0, duration.seconds.isFinite, duration.seconds > 0 else { throw screenError("Videoclipul nu are dimensiuni sau durată valide.") }
          guard ScreenStore.shared.sessions[id] === session else { return }
          session.track = track
          session.transform = transform
          session.duration = duration
          session.frameDuration = frameDuration
          let item = AVPlayerItem(asset: session.asset)
          session.player.replaceCurrentItem(with: item)
          session.failureObserver = item.observe(\.status, options: [.new]) { [weak self, weak session] item, _ in
            guard item.status == .failed, session != nil else { return }
            self?.sendEvent("onPlayback", ["id": id, "time": 0, "playing": false,
              "error": item.error?.localizedDescription ?? "Acest MP4 nu poate fi redat."])
          }
          session.observer = session.player.addPeriodicTimeObserver(forInterval: CMTime(value: 1, timescale: 5), queue: .main) { [weak self, weak session] time in
            guard let session = session else { return }
            self?.sendEvent("onPlayback", ["id": id, "time": time.seconds.isFinite ? time.seconds : 0, "playing": session.player.rate > 0])
          }
          session.promise?.resolve(["width": abs(bounds.width), "height": abs(bounds.height), "duration": duration.seconds])
          session.promise = nil
        } catch {
          session.promise?.reject("ERR_SCREEN_OPEN", error.localizedDescription)
          session.promise = nil
        }
      }
    }.runOnQueue(.main)

    AsyncFunction("layout") { (id: String, json: String) in
      guard let session = ScreenStore.shared.sessions[id], let track = session.track else { return }
      let layout = try ScreenLayout.parse(json)
      session.player.currentItem?.videoComposition = makeScreenComposition(track: track, duration: session.duration,
        transform: session.transform, frameDuration: session.frameDuration, layout: layout)
      if session.player.rate == 0 { session.player.seek(to: session.player.currentTime(), toleranceBefore: .zero, toleranceAfter: .zero) }
    }.runOnQueue(.main)

    AsyncFunction("play") { (id: String) in
      guard let session = ScreenStore.shared.sessions[id] else { return }
      if session.player.currentTime() >= session.duration { session.player.seek(to: .zero) }
      session.player.play()
    }.runOnQueue(.main)
    AsyncFunction("pause") { (id: String) in ScreenStore.shared.sessions[id]?.player.pause() }.runOnQueue(.main)
    AsyncFunction("seek") { (id: String, seconds: Double) in
      guard let session = ScreenStore.shared.sessions[id], seconds.isFinite else { return }
      session.player.seek(to: CMTime(seconds: max(0, min(seconds, session.duration.seconds)), preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
    }.runOnQueue(.main)
    AsyncFunction("release") { (id: String) in
      ScreenStore.shared.sessions.removeValue(forKey: id)?.release()
      self.owned.remove(id)
    }.runOnQueue(.main)
    AsyncFunction("render") { (id: String, uri: String, output: String, json: String, promise: Promise) in
      do {
        guard UIApplication.shared.applicationState != .background else { throw screenError("Păstrează aplicația deschisă în timpul conversiei.") }
        let layout = try ScreenLayout.parse(json)
        let job = ScreenExport(id: id, promise: promise, onProgress: { [weak self] progress in
          self?.sendEvent("onProgress", ["id": id, "progress": progress])
        }, onFinish: { [weak self] in DispatchQueue.main.async { self?.exports.removeValue(forKey: id) } })
        self.exports[id] = job
        job.start(uri: uri, output: output, layout: layout)
      } catch { promise.reject("ERR_SCREEN_CONVERSION", error.localizedDescription) }
    }.runOnQueue(.main)
    AsyncFunction("cancel") { (id: String) in self.exports[id]?.cancel() }.runOnQueue(.main)
    OnDestroy {
      if let observer = self.backgroundObserver { NotificationCenter.default.removeObserver(observer) }
      let jobs = self.exports
      let sessions = self.owned
      DispatchQueue.main.async {
        jobs.values.forEach { $0.cancel() }
        sessions.forEach { ScreenStore.shared.sessions.removeValue(forKey: $0)?.release() }
      }
    }
  }
}
