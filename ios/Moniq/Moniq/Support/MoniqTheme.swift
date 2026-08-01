import SwiftUI

/// Warm-neutral tokens ported from `docs/design.md` / `docs/ios-swift-reference.md`.
/// Keep this file in sync with the web tokens in `app/globals.css` when either changes.
enum MoniqColor {
    static let background = Color(light: "#fafaf7", dark: "#1a1a19")
    static let surface = Color(light: "#f0f0eb", dark: "#262624")
    static let secondarySurface = Color(light: "#e5e4df", dark: "#30302e")
    static let destructive = Color(light: "#bf5d43", dark: "#bf5d43")
    static let foreground = Color(light: "#191919", dark: "#fafaf7")
    static let muted = Color(light: "#666663", dark: "#bfbfba")
    static let border = Color(light: "#bfbfba", dark: "#40403e")
    static let accent = Color(light: "#ebd8bc", dark: "#5a4938")
    static let glassTint = Color(light: "#f0f0eb", dark: "#30302e")
}

extension Color {
    init(light: String, dark: String) {
        self.init(UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

private extension UIColor {
    convenience init(hex: String) {
        let hexValue = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var rgb: UInt64 = 0
        Scanner(string: hexValue).scanHexInt64(&rgb)
        let r = CGFloat((rgb & 0xFF0000) >> 16) / 255
        let g = CGFloat((rgb & 0x00FF00) >> 8) / 255
        let b = CGFloat(rgb & 0x0000FF) / 255
        self.init(red: r, green: g, blue: b, alpha: 1)
    }
}
