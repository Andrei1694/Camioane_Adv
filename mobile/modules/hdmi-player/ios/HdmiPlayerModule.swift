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

    AsyncFunction("prepare") { (sessionId: String, uri: String, promise: Promise) in
      HdmiPlayback.shared.prepare(sessionId: sessionId, uri: uri, promise: promise)
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
