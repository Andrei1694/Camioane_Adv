import ExpoModulesCore
import UIKit

public final class HdmiPlayerModule: Module {
  private var ownedSession: String?

  public func definition() -> ModuleDefinition {
    Name("HdmiPlayer")
    Events("onStatus")

    AsyncFunction("start") { (sessionId: String, expiresAt: Double?) -> [String: Any] in
      self.ownedSession = sessionId
      HdmiPlayback.shared.start(sessionId: sessionId, expiresAt: expiresAt) { [weak self] status in
        self?.sendEvent("onStatus", status)
      }
      return HdmiPlayback.shared.status()
    }.runOnQueue(.main)

    AsyncFunction("prepare") { (sessionId: String, uris: [String], startIndex: Int?, promise: Promise) in
      HdmiPlayback.shared.prepare(sessionId: sessionId, uris: uris, startIndex: startIndex ?? 0, promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("setPlacement") { (sessionId: String, x: Double, y: Double, scale: Double, promise: Promise) in
      HdmiPlayback.shared.setPlacement(sessionId: sessionId, x: x, y: y, scale: scale, promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("setPattern") { (sessionId: String, enabled: Bool, promise: Promise) in
      HdmiPlayback.shared.setPattern(sessionId: sessionId, enabled: enabled, promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("skip") { (sessionId: String, index: Int) in
      HdmiPlayback.shared.skip(sessionId: sessionId, index: index)
    }.runOnQueue(.main)

    AsyncFunction("play") { (sessionId: String) in
      HdmiPlayback.shared.play(sessionId: sessionId)
    }.runOnQueue(.main)

    AsyncFunction("pause") { (sessionId: String) in
      if HdmiPlayback.shared.sessionId == sessionId { HdmiPlayback.shared.pause() }
    }.runOnQueue(.main)

    AsyncFunction("stop") { (sessionId: String) in
      HdmiPlayback.shared.stop(sessionId: sessionId)
    }.runOnQueue(.main)

    AsyncFunction("release") { (sessionId: String) in
      if HdmiPlayback.shared.sessionId == sessionId { HdmiPlayback.shared.release() }
    }.runOnQueue(.main)

    OnDestroy {
      let sessionId = self.ownedSession
      DispatchQueue.main.async {
        if HdmiPlayback.shared.sessionId == sessionId { HdmiPlayback.shared.release() }
      }
    }
  }
}
