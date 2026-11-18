import AVFoundation
import ExpoModulesCore
import UIKit

// Every entry point, callback and player operation runs on the main queue.
final class HdmiPlayback {
  static let shared = HdmiPlayback()
  private(set) var sessionId: String?
  private var playback = "idle"
  private var error: String?
  private var onStatus: (([String: Any]) -> Void)?
  private weak var externalScene: UIWindowScene?
  private var window: UIWindow?
  private var controller: HdmiVideoController?
  private weak var accessoryOwner: UIViewController?
  private var accessoryRegistration: AnyObject?
  private var player: AVQueuePlayer?
  private var wantsPlayback = false
  private var audioSessionActive = false
  private var sessionExpiresAt: Date?
  private var sessionExpiryTimer: Timer?
  private var sessionExpired = false
  private let expiryMessage = "Your session expired. Please sign in again."
  private var looper: AVPlayerLooper?
  private var preparation: Task<Void, Never>?
  private var preparationPromise: Promise?
  private var preparingAsset: AVURLAsset?
  private var generation = 0
  private var observations: [NSKeyValueObservation] = []
  private var itemObservation: NSKeyValueObservation?
  private var notifications: [NSObjectProtocol] = []

  func start(sessionId: String, expiresAt: Double?, onStatus: @escaping ([String: Any]) -> Void) {
    release()
    self.sessionId = sessionId
    self.onStatus = onStatus
    sessionExpiresAt = expiresAt.map { $0.isFinite ? Date(timeIntervalSince1970: $0 / 1000) : .distantPast }
    scheduleSessionExpiry()
    let center = NotificationCenter.default
    notifications = [
      center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
        guard let self, !self.expireSessionIfNeeded() else { return }
        self.offerExternalDisplay()
      },
      center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] event in
        guard let self, self.sessionId == sessionId,
              let rawType = event.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: rawType) else { return }
        if type == .began { self.pause() }
        // An end notification is not guaranteed: only a new Play restores intent.
        // Never activate audio or resume in response to an interruption ending.
      },
    ]
    offerExternalDisplay()
  }

  // JavaScript timers may be suspended while the phone is locked. Enforce the
  // existing login deadline in native playback as well, including before resume.
  private func scheduleSessionExpiry() {
    sessionExpiryTimer?.invalidate()
    sessionExpiryTimer = nil
    guard let deadline = sessionExpiresAt, let expectedSession = sessionId,
          !expireSessionIfNeeded() else { return }
    let timer = Timer(timeInterval: max(0.1, deadline.timeIntervalSinceNow), repeats: false) { [weak self] _ in
      guard let self, self.sessionId == expectedSession else { return }
      if !self.expireSessionIfNeeded() { self.scheduleSessionExpiry() }
    }
    sessionExpiryTimer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  private func expireSessionIfNeeded() -> Bool {
    if sessionExpired { return true }
    guard let deadline = sessionExpiresAt, deadline <= Date() else { return false }
    sessionExpired = true
    sessionExpiryTimer?.invalidate()
    sessionExpiryTimer = nil
    fail(expiryMessage)
    return true
  }

  private func offerExternalDisplay() {
    guard sessionId != nil else { return }
    if #available(iOS 27.0, *) {
      if accessoryRegistration == nil {
        let mainScene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
          .first { $0.session.role == .windowApplication && $0.activationState == .foregroundActive }
        guard let root = mainScene?.windows.first(where: { $0.isKeyWindow })?.rootViewController else { return }
        let configuration = UISceneConfiguration()
        configuration.delegateClass = HdmiSceneDelegate.self
        let accessory = UISceneAccessory.externalNonInteractive(sceneConfiguration: configuration)
        accessoryOwner = root
        accessoryRegistration = root.registerSceneAccessory(accessory)
      }
    }
    // On iOS 16–26 UIKit connects the declared external scene automatically.
    // Also catches a cable that was already connected before this screen opened.
    if window == nil, let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
      .first(where: { $0.session.role == .windowExternalDisplayNonInteractive }) {
      connect(scene)
    }
    emitStatus()
  }

  func connect(_ scene: UIWindowScene) {
    guard sessionId != nil, scene.session.role == .windowExternalDisplayNonInteractive else { return }
    // This test owns one output. Additional displays never replace it mid-playback.
    if let current = externalScene, current !== scene { return }
    if window != nil { return }
    externalScene = scene
    let next = HdmiVideoController()
    let nextWindow = UIWindow(windowScene: scene)
    nextWindow.backgroundColor = .black
    nextWindow.rootViewController = next
    nextWindow.isHidden = false // Never make the external window the phone's key window.
    next.loadViewIfNeeded()
    next.video.playerLayer.player = player
    controller = next
    window = nextWindow
    (scene.delegate as? HdmiSceneDelegate)?.window = nextWindow
    emitStatus()
  }

  func disconnect(_ scene: UIScene) {
    guard externalScene === scene else { return }
    pause()
    removeWindow()
    emitStatus()
  }

  func status() -> [String: Any] {
    var display: Any = NSNull()
    if let screen = externalScene?.screen, window != nil {
      let size = screen.currentMode?.size ?? screen.nativeBounds.size
      display = ["name": "External display", "width": Int(size.width), "height": Int(size.height)]
    }
    return [
      "sessionId": sessionId ?? "",
      "display": display,
      "playback": playback,
      "error": error as Any? ?? NSNull(),
    ]
  }

  func emitStatus() {
    if sessionId != nil { onStatus?(status()) }
  }

  func prepare(sessionId: String, uri: String, promise: Promise) {
    guard self.sessionId == sessionId else {
      promise.reject("ERR_HDMI_SESSION_ENDED", "The HDMI session has ended.")
      return
    }
    guard !expireSessionIfNeeded() else {
      promise.reject("ERR_HDMI_PREPARE_FAILED", expiryMessage)
      return
    }
    clearPlayer()
    preparationPromise = promise
    error = nil
    playback = "loading"
    emitStatus()
    guard let url = URL(string: uri), url.isFileURL, FileManager.default.isReadableFile(atPath: url.path) else {
      fail("The selected video could not be read. Choose the file again.")
      return
    }
    do {
      // Only our cache copies need a protection class readable after the phone
      // locks. Never change the original document or a bundled asset.
      if let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first,
         url.resolvingSymlinksInPath().path.hasPrefix(cache.resolvingSymlinksInPath().path + "/") {
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                                              ofItemAtPath: url.path)
      }
    } catch {
      fail("The video could not be prepared for playback while the iPhone is locked. Choose it again.")
      return
    }
    let expectedGeneration = generation
    let asset = AVURLAsset(url: url)
    preparingAsset = asset
    preparation = Task { @MainActor [weak self] in
      do {
        let playable = try await asset.load(.isPlayable)
        let tracks = try await asset.loadTracks(withMediaType: .video)
        guard let self, !Task.isCancelled, self.generation == expectedGeneration, self.sessionId == sessionId else { return }
        guard playable, !tracks.isEmpty else {
          self.fail("This file has no playable video track. Try an H.264 MP4 video.")
          return
        }
        self.preparingAsset = nil
        self.preparation = nil
        self.installPlayer(asset: asset, generation: expectedGeneration)
      } catch {
        guard let self, !Task.isCancelled, self.generation == expectedGeneration, self.sessionId == sessionId else { return }
        self.fail("The selected video could not be opened. Try a local H.264 MP4 video.")
      }
    }
  }

  private func installPlayer(asset: AVAsset, generation: Int) {
    let next = AVQueuePlayer()
    next.isMuted = true
    next.audiovisualBackgroundPlaybackPolicy = .continuesIfPossible
    next.allowsExternalPlayback = false // The dedicated layer owns routing, not AirPlay video routing.
    player = next
    let loop = AVPlayerLooper(player: next, templateItem: AVPlayerItem(asset: asset))
    looper = loop
    controller?.video.playerLayer.player = next
    observations = [
      next.observe(\.currentItem, options: [.initial, .new]) { [weak self, weak next] _, _ in
        DispatchQueue.main.async {
          guard let self, let next, self.generation == generation else { return }
          self.observeItem(next.currentItem, generation: generation)
        }
      },
      next.observe(\.timeControlStatus, options: [.new]) { [weak self, weak next] _, _ in
        DispatchQueue.main.async {
          guard let self, let next, self.generation == generation, self.player === next else { return }
          self.reconcilePlayback(next)
        }
      },
      loop.observe(\.status, options: [.initial, .new]) { [weak self, weak loop] _, _ in
        DispatchQueue.main.async {
          guard let self, self.generation == generation, loop?.status == .failed else { return }
          self.fail("This video could not be looped. Try a local H.264 MP4 video.")
        }
      },
    ]
  }

  private func observeItem(_ item: AVPlayerItem?, generation: Int) {
    itemObservation = item?.observe(\.status, options: [.initial, .new]) { [weak self, weak item] _, _ in
      DispatchQueue.main.async {
        guard let self, let item, self.generation == generation, self.player?.currentItem === item else { return }
        if item.status == .failed {
          self.fail("This video could not be played. Try a local H.264 MP4 video.")
        } else if item.status == .readyToPlay && self.playback == "loading" {
          self.playback = "ready"
          self.emitStatus()
          let pending = self.preparationPromise
          self.preparationPromise = nil
          pending?.resolve()
        }
      }
    }
  }

  private func reconcilePlayback(_ player: AVQueuePlayer) {
    guard sessionId != nil, !expireSessionIfNeeded() else { return }
    guard wantsPlayback else {
      // A delayed native resume must not override Stop, Pause, or preparation.
      if player.timeControlStatus != .paused { player.pause() }
      return
    }
    // The external layer stays attached while the phone locks or backgrounds.
    guard window != nil else {
      pause()
      return
    }
    let next: String
    switch player.timeControlStatus {
    case .playing:
      next = "playing"
    case .waitingToPlayAtSpecifiedRate:
      next = "buffering"
    case .paused:
      pause()
      return
    @unknown default:
      pause()
      return
    }
    if playback != next {
      playback = next
      emitStatus()
    }
  }

  func play(sessionId: String) {
    guard self.sessionId == sessionId, !expireSessionIfNeeded() else { return }
    guard UIApplication.shared.applicationState == .active, window != nil else {
      error = "Connect an HDMI display and return to the app to press Play."
      emitStatus()
      return
    }
    guard ["ready", "paused", "stopped"].contains(playback), let player else { return }
    do {
      let audio = AVAudioSession.sharedInstance()
      // Background media eligibility needs a playback session even though our
      // video stays muted. Mixing lets other apps keep their own audio.
      try audio.setCategory(.playback, mode: .moviePlayback, options: [.mixWithOthers])
      try audio.setActive(true)
      audioSessionActive = true
    } catch {
      self.error = "The iPhone could not enable background playback. Try Play again."
      emitStatus()
      return
    }
    error = nil
    wantsPlayback = true
    playback = "buffering"
    controller?.video.isHidden = false
    emitStatus()
    player.play()
  }

  func pause() {
    let wasPlaying = wantsPlayback || ["playing", "buffering"].contains(playback)
    wantsPlayback = false
    if wasPlaying { playback = "paused" }
    player?.pause()
    deactivateAudioSession()
    emitStatus()
  }

  func stop(sessionId: String) {
    guard self.sessionId == sessionId else { return }
    wantsPlayback = false
    if ["ready", "playing", "buffering", "paused", "stopped"].contains(playback) { playback = "stopped" }
    player?.pause()
    controller?.video.isHidden = true
    player?.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero)
    deactivateAudioSession()
    emitStatus()
  }

  private func deactivateAudioSession() {
    guard audioSessionActive else { return }
    do {
      try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
      audioSessionActive = false
    } catch {
      // Keep ownership so the next pause/release can retry deactivation.
    }
  }

  private func fail(_ message: String) {
    let pending = preparationPromise
    preparationPromise = nil
    clearPlayer()
    playback = "error"
    error = message
    emitStatus()
    pending?.reject("ERR_HDMI_PREPARE_FAILED", message)
  }

  private func clearPlayer() {
    wantsPlayback = false
    let pending = preparationPromise
    preparationPromise = nil
    generation += 1
    preparation?.cancel()
    preparation = nil
    preparingAsset?.cancelLoading()
    preparingAsset = nil
    observations.removeAll()
    itemObservation = nil
    controller?.video.isHidden = true
    controller?.video.playerLayer.player = nil
    player?.pause()
    looper?.disableLooping()
    looper = nil
    player?.removeAllItems()
    player = nil
    deactivateAudioSession()
    pending?.reject("ERR_HDMI_CANCELLED", "Video preparation was cancelled.")
  }

  private func removeWindow() {
    controller?.video.playerLayer.player = nil
    window?.isHidden = true
    (externalScene?.delegate as? HdmiSceneDelegate)?.window = nil
    window = nil
    controller = nil
    externalScene = nil
  }

  func release() {
    sessionExpiryTimer?.invalidate()
    sessionExpiryTimer = nil
    sessionExpiresAt = nil
    sessionExpired = false
    sessionId = nil
    onStatus = nil
    notifications.forEach(NotificationCenter.default.removeObserver)
    notifications.removeAll()
    clearPlayer()
    removeWindow()
    if #available(iOS 27.0, *), let registration = accessoryRegistration as? UISceneAccessoryRegistration {
      accessoryOwner?.unregisterSceneAccessory(registration)
    }
    accessoryRegistration = nil
    accessoryOwner = nil
    playback = "idle"
    error = nil
  }
}
