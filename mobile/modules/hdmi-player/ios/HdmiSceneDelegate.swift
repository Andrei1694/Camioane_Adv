import AVFoundation
import UIKit

// A separate delegate is essential: Expo's delegate starts React Native in every
// scene it owns. This scene must contain only the external video surface.
@objc(CamioaneHdmiSceneDelegate)
final class HdmiSceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
    guard let scene = scene as? UIWindowScene else { return }
    HdmiPlayback.shared.connect(scene)
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    HdmiPlayback.shared.disconnect(scene)
    window = nil
  }

  func windowScene(_ windowScene: UIWindowScene, didUpdate previousCoordinateSpace: UICoordinateSpace,
                   interfaceOrientation previousInterfaceOrientation: UIInterfaceOrientation,
                   traitCollection previousTraitCollection: UITraitCollection) {
    HdmiPlayback.shared.emitStatus()
  }
}

final class HdmiVideoView: UIView {
  override class var layerClass: AnyClass { AVPlayerLayer.self }
  var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .black
    playerLayer.videoGravity = .resizeAspect
  }

  required init?(coder: NSCoder) { nil }
}

final class HdmiVideoController: UIViewController {
  let video = HdmiVideoView(frame: .zero)

  override func loadView() {
    view = UIView()
    view.backgroundColor = .black
    video.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(video)
    NSLayoutConstraint.activate([
      video.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      video.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      video.topAnchor.constraint(equalTo: view.topAnchor),
      video.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
    video.isHidden = true
  }

  override var prefersStatusBarHidden: Bool { true }
  override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .all }
}
