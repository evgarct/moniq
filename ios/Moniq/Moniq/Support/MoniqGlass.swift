import SwiftUI

enum MoniqGlassRole {
    case surface
    case interactive
}

struct MoniqGlassSurface<Content: View>: View {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorSchemeContrast) private var contrast

    let role: MoniqGlassRole
    let content: Content

    init(role: MoniqGlassRole = .surface, @ViewBuilder content: () -> Content) {
        self.role = role
        self.content = content()
    }

    var body: some View {
        if reduceTransparency {
            content
                .background {
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(MoniqColor.surface)
                }
        } else {
            content.glassEffect(
                .regular
                    .tint(MoniqColor.glassTint.opacity(contrast == .increased ? 0.9 : 0.62))
                    .interactive(role == .interactive),
                in: .rect(cornerRadius: 24)
            )
        }
    }
}

struct MoniqCanvas: ViewModifier {
    func body(content: Content) -> some View {
        content
            .foregroundStyle(MoniqColor.foreground)
            .background(MoniqColor.background.ignoresSafeArea())
    }
}

extension View {
    func moniqCanvas() -> some View {
        modifier(MoniqCanvas())
    }
}
