import UIKit

struct HdmiPlacement {
  var x = 0
  var y = 0
  var scale: CGFloat = 1

  var status: [String: Any] { ["x": x, "y": y, "scale": Double(scale)] }
}

// Draw in HDMI pixels, independently of the video's placement or dimensions.
final class HdmiCalibrationView: UIView {
  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .black
    isOpaque = true
    isUserInteractionEnabled = false
    contentMode = .redraw
  }

  required init?(coder: NSCoder) { nil }

  override func draw(_ rect: CGRect) {
    guard let context = UIGraphicsGetCurrentContext() else { return }
    let scale = window?.screen.scale ?? 1
    let width = Int((bounds.width * scale).rounded())
    let height = Int((bounds.height * scale).rounded())
    guard width > 0, height > 0 else { return }
    context.saveGState()
    context.scaleBy(x: 1 / scale, y: 1 / scale)
    context.setShouldAntialias(false)
    let accents: [UIColor] = [.cyan, .yellow, .magenta, .green]
    for vertical in [true, false] {
      for position in stride(from: 0, to: vertical ? width : height, by: 64) {
        let color = position.isMultiple(of: 512) ? accents[(position / 512) % accents.count]
          : UIColor(white: position.isMultiple(of: 128) ? 0.7 : 0.3, alpha: 1)
        context.setStrokeColor(color.cgColor)
        context.setLineWidth(1)
        let offset = CGFloat(position) + 0.5
        context.move(to: vertical ? CGPoint(x: offset, y: 0) : CGPoint(x: 0, y: offset))
        context.addLine(to: vertical ? CGPoint(x: offset, y: CGFloat(height)) : CGPoint(x: CGFloat(width), y: offset))
        context.strokePath()
      }
    }
    context.setShouldAntialias(true)
    let attributes: [NSAttributedString.Key: Any] = [
      .font: UIFont.monospacedSystemFont(ofSize: 12, weight: .medium),
      .foregroundColor: UIColor.white, .backgroundColor: UIColor.black,
    ]
    for y in stride(from: 0, to: height, by: 128) {
      for x in stride(from: 0, to: width, by: 128) {
        let label = "\(x),\(y)" as NSString
        let size = label.size(withAttributes: attributes)
        label.draw(at: CGPoint(x: max(2, min(CGFloat(x + 4), CGFloat(width) - size.width - 2)),
                               y: max(2, min(CGFloat(y + 4), CGFloat(height) - size.height - 2))),
                   withAttributes: attributes)
      }
    }
    context.setShouldAntialias(false)
    context.setStrokeColor(UIColor.white.cgColor)
    context.setLineWidth(2)
    context.stroke(CGRect(x: 1, y: 1, width: width - 2, height: height - 2))
    context.restoreGState()
  }
}
