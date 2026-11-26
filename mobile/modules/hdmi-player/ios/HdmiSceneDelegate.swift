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
    HdmiPlayback.shared.displayDidChange()
  }
}

final class HdmiVideoView: UIView {
  override class var layerClass: AnyClass { AVPlayerLayer.self }
  var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .black
    playerLayer.videoGravity = .resize
  }

  required init?(coder: NSCoder) { nil }
}

final class HdmiVideoController: UIViewController {
  let video = HdmiVideoView(frame: .zero)
  private let pattern = HdmiCalibrationView(frame: .zero)
  private var placement = HdmiPlacement()
  private var videoSize = CGSize.zero
  private var videoVisible = false
  private var patternEnabled = false

  override func loadView() {
    view = UIView()
    view.backgroundColor = .black
    view.clipsToBounds = true
    view.addSubview(video)
    view.addSubview(pattern)
    video.isHidden = true
    pattern.isHidden = true
  }

  func applyPlacement(_ placement: HdmiPlacement, videoSize: CGSize) {
    self.placement = placement
    self.videoSize = videoSize
    view.setNeedsLayout()
    view.layoutIfNeeded()
  }

  func showVideo(_ visible: Bool) {
    videoVisible = visible
    video.isHidden = !visible || patternEnabled
  }

  func showPattern(_ enabled: Bool) {
    patternEnabled = enabled
    pattern.isHidden = !enabled
    video.isHidden = !videoVisible || enabled
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    let pixelsPerPoint = view.window?.screen.scale ?? 1
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    video.frame = CGRect(x: CGFloat(placement.x) / pixelsPerPoint, y: CGFloat(placement.y) / pixelsPerPoint,
                         width: (videoSize.width * placement.scale).rounded() / pixelsPerPoint,
                         height: (videoSize.height * placement.scale).rounded() / pixelsPerPoint)
    pattern.frame = view.bounds
    pattern.contentScaleFactor = pixelsPerPoint
    pattern.setNeedsDisplay()
    CATransaction.commit()
  }

  override var prefersStatusBarHidden: Bool { true }
  override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .all }
}
