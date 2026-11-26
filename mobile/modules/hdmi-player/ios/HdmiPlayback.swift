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
  private var preparingAssets: [AVURLAsset] = []
  private var assets: [AVURLAsset] = []
  private var itemIndexes: [ObjectIdentifier: Int] = [:]
  private var index: Int?
  private var count = 0
  private var endNotification: NSObjectProtocol?
  private var generation = 0
  private var observations: [NSKeyValueObservation] = []
  private var itemObservation: NSKeyValueObservation?
  private var sizeObservation: NSKeyValueObservation?
  private var videoSize = CGSize.zero
  private var placement = HdmiPlacement()
  private var patternEnabled = false
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
    scene.screen.overscanCompensation = .none
    let next = HdmiVideoController()
    let nextWindow = UIWindow(windowScene: scene)
    nextWindow.backgroundColor = .black
    nextWindow.rootViewController = next
    nextWindow.isHidden = false // Never make the external window the phone's key window.
    next.loadViewIfNeeded()
    next.video.playerLayer.player = player
    controller = next
    window = nextWindow
    next.applyPlacement(placement, videoSize: videoSize)
    next.showPattern(patternEnabled)
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
    var modes: [[String: Int]] = []
    if let screen = externalScene?.screen, window != nil {
      let size = screen.currentMode?.size ?? screen.nativeBounds.size
      display = ["name": "External display", "width": Int(size.width), "height": Int(size.height)]
      modes = screen.availableModes.map { ["width": Int($0.size.width), "height": Int($0.size.height)] }
    }
    return [
      "sessionId": sessionId ?? "",
      "display": display,
      "playback": playback,
      "error": error as Any? ?? NSNull(),
      "index": index as Any? ?? NSNull(),
      "count": count,
      "video": videoSize.width > 0 && videoSize.height > 0
        ? ["width": Double(videoSize.width), "height": Double(videoSize.height)] as Any : NSNull(),
      "placement": placement.status,
      "modes": modes,
      "pattern": patternEnabled,
    ]
  }

  func displayDidChange() {
    controller?.applyPlacement(placement, videoSize: videoSize)
    emitStatus()
  }

  private func validateSession(_ id: String, promise: Promise) -> Bool {
    guard sessionId == id else {
      promise.reject("ERR_HDMI_SESSION_ENDED", "The HDMI session has ended.")
      return false
    }
    guard !expireSessionIfNeeded() else {
      promise.reject("ERR_HDMI_SESSION_ENDED", expiryMessage)
      return false
    }
    return true
  }

  func setPlacement(sessionId: String, x: Double, y: Double, scale: Double, promise: Promise) {
    guard validateSession(sessionId, promise: promise) else { return }
    guard x.isFinite, y.isFinite, x.rounded() == x, y.rounded() == y,
          (-4096...4096).contains(x), (-4096...4096).contains(y),
          scale.isFinite, (0.1...4).contains(scale) else {
      promise.reject("ERR_HDMI_PLACEMENT", "X/Y must be integers from -4096 to 4096; scale must be from 0.1 to 4.")
      return
    }
    placement = HdmiPlacement(x: Int(x), y: Int(y), scale: CGFloat(scale))
    displayDidChange()
    promise.resolve()
  }

  func setPattern(sessionId: String, enabled: Bool, promise: Promise) {
    guard validateSession(sessionId, promise: promise) else { return }
    patternEnabled = enabled
    controller?.showPattern(enabled)
    emitStatus()
    promise.resolve()
  }

  func emitStatus() {
    if sessionId != nil { onStatus?(status()) }
  }

  func prepare(sessionId: String, uris: [String], startIndex: Int, promise: Promise) {
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
    count = uris.count
    index = uris.isEmpty ? nil : max(0, min(startIndex, uris.count - 1))
    playback = uris.isEmpty ? "idle" : "loading"
    emitStatus()
    if uris.isEmpty {
      preparationPromise = nil
      promise.resolve()
      return
    }
    var loadedAssets: [AVURLAsset] = []
    for (itemIndex, uri) in uris.enumerated() {
      guard let url = URL(string: uri), url.isFileURL, FileManager.default.isReadableFile(atPath: url.path) else {
        index = itemIndex
        fail("The selected video could not be read. Choose the file again.")
        return
      }
      do {
        let files = FileManager.default
        let cache = files.urls(for: .cachesDirectory, in: .userDomainMask).first
        var playlist = files.urls(for: .documentDirectory, in: .userDomainMask).first?
          .appendingPathComponent("hdmi-playlist", isDirectory: true)
        let path = url.resolvingSymlinksInPath().path
        let inPlaylist = playlist.map { path.hasPrefix($0.resolvingSymlinksInPath().path + "/") } ?? false
        let inCache = cache.map { path.hasPrefix($0.resolvingSymlinksInPath().path + "/") } ?? false
        // Only app-owned copies are changed, never original documents or bundles.
        if inCache || inPlaylist {
          try files.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.path)
        }
        if inPlaylist, var directory = playlist {
          var values = URLResourceValues()
          values.isExcludedFromBackup = true
          try directory.setResourceValues(values)
          playlist = directory
          // Include parent directories so traversal remains possible after lock.
          for parent in [directory, url.deletingLastPathComponent(), url.deletingLastPathComponent().deletingLastPathComponent()] {
            try files.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: parent.path)
          }
        }
      } catch {
        index = itemIndex
        fail("The video could not be prepared for playback while the iPhone is locked. Choose it again.")
        return
      }
      loadedAssets.append(AVURLAsset(url: url))
    }
    let expectedGeneration = generation
    let candidates = loadedAssets
    preparingAssets = candidates
    preparation = Task { @MainActor [weak self] in
      // Validate all assets concurrently, reporting the first failure in list order.
      let failures = await withTaskGroup(of: Int?.self) { group in
        for (itemIndex, asset) in candidates.enumerated() {
          group.addTask {
            do {
              async let playable = asset.load(.isPlayable)
              async let tracks = asset.loadTracks(withMediaType: .video)
              let result = try await (playable, tracks)
              return result.0 && !result.1.isEmpty ? nil : itemIndex
            } catch { return itemIndex }
          }
        }
        var failed: [Int] = []
        for await result in group { if let result { failed.append(result) } }
        return failed
      }
      guard let self, !Task.isCancelled, self.generation == expectedGeneration, self.sessionId == sessionId else { return }
      if let failed = failures.min() {
        self.index = failed
        self.fail("This file has no playable video track. Try a local H.264 MP4 video.")
        return
      }
      self.preparingAssets = []
      self.preparation = nil
      self.assets = candidates
      self.installPlayer(generation: expectedGeneration)
    }
  }

  private func installPlayer(generation: Int) {
    let next = AVQueuePlayer()
    next.isMuted = true
    next.audiovisualBackgroundPlaybackPolicy = .continuesIfPossible
    next.allowsExternalPlayback = false
    player = next
    rebuildQueue(from: index ?? 0)
    controller?.video.playerLayer.player = next
    observations.append(contentsOf: [
      next.observe(\.currentItem, options: [.initial, .new]) { [weak self, weak next] _, _ in
        DispatchQueue.main.async {
          guard let self, let next, self.generation == generation, self.player === next else { return }
          self.observeItem(next.currentItem, generation: generation)
        }
      },
      next.observe(\.timeControlStatus, options: [.new]) { [weak self, weak next] _, _ in
        DispatchQueue.main.async {
          guard let self, let next, self.generation == generation, self.player === next else { return }
          self.reconcilePlayback(next)
        }
      },
    ])
    if assets.count > 1 {
      endNotification = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: nil, queue: .main) { [weak self] event in
        guard let self, self.generation == generation, let item = event.object as? AVPlayerItem,
              let finished = self.itemIndexes.removeValue(forKey: ObjectIdentifier(item)),
              let player = self.player else { return }
        let replacement = AVPlayerItem(asset: self.assets[finished])
        self.itemIndexes[ObjectIdentifier(replacement)] = finished
        player.insert(replacement, after: nil)
      }
    }
  }

  private func rebuildQueue(from start: Int) {
    guard let player, assets.indices.contains(start) else { return }
    looper?.disableLooping()
    looper = nil
    itemObservation = nil
    sizeObservation = nil
    videoSize = .zero
    controller?.applyPlacement(placement, videoSize: videoSize)
    itemIndexes.removeAll()
    player.removeAllItems()
    index = start
    if assets.count == 1 {
      let loop = AVPlayerLooper(player: player, templateItem: AVPlayerItem(asset: assets[0]))
      looper = loop
      let expectedGeneration = generation
      observations.append(loop.observe(\.status, options: [.initial, .new]) { [weak self, weak loop] _, _ in
        DispatchQueue.main.async {
          guard let self, let loop, self.looper === loop, self.generation == expectedGeneration, loop.status == .failed else { return }
          self.fail("This video could not be looped. Try a local H.264 MP4 video.")
        }
      })
    } else {
      for offset in assets.indices {
        let itemIndex = (start + offset) % assets.count
        let item = AVPlayerItem(asset: assets[itemIndex])
        itemIndexes[ObjectIdentifier(item)] = itemIndex
        player.insert(item, after: nil)
      }
    }
  }

  func skip(sessionId: String, index: Int) {
    guard self.sessionId == sessionId, !expireSessionIfNeeded(), assets.indices.contains(index),
          ["ready", "playing", "buffering", "paused", "stopped"].contains(playback) else { return }
    let resume = wantsPlayback
    player?.pause()
    if assets.count == 1 {
      player?.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero)
    } else { rebuildQueue(from: index) }
    if resume {
      playback = "buffering"
      player?.play()
    }
    emitStatus()
  }

  private func observeItem(_ item: AVPlayerItem?, generation: Int) {
    sizeObservation = nil
    updateVideoSize(item?.presentationSize ?? .zero)
    if let item {
      index = assets.count == 1 ? 0 : itemIndexes[ObjectIdentifier(item)]
      emitStatus()
    }
    sizeObservation = item?.observe(\.presentationSize, options: [.initial, .new]) { [weak self, weak item] _, _ in
      DispatchQueue.main.async {
        guard let self, let item, self.generation == generation, self.player?.currentItem === item else { return }
        self.updateVideoSize(item.presentationSize)
      }
    }
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

  private func updateVideoSize(_ size: CGSize) {
    videoSize = size.width.isFinite && size.height.isFinite && size.width > 0 && size.height > 0 ? size : .zero
    controller?.applyPlacement(placement, videoSize: videoSize)
    emitStatus()
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
    controller?.showVideo(true)
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
    controller?.showVideo(false)
    patternEnabled = false
    controller?.showPattern(false)
    if assets.count > 1 { rebuildQueue(from: 0) }
    else { player?.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero) }
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
    patternEnabled = false
    controller?.showPattern(false)
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
    preparingAssets.forEach { $0.cancelLoading() }
    preparingAssets = []
    if let endNotification { NotificationCenter.default.removeObserver(endNotification) }
    endNotification = nil
    observations.removeAll()
    itemObservation = nil
    sizeObservation = nil
    videoSize = .zero
    controller?.applyPlacement(placement, videoSize: videoSize)
    controller?.showVideo(false)
    controller?.video.playerLayer.player = nil
    player?.pause()
    looper?.disableLooping()
    looper = nil
    player?.removeAllItems()
    player = nil
    assets = []
    itemIndexes.removeAll()
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
    index = nil
    count = 0
    placement = HdmiPlacement()
    patternEnabled = false
  }
}
