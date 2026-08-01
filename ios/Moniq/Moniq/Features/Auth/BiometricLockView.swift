import SwiftUI

struct BiometricLockView: View {
    let unlock: () async -> Void

    var body: some View {
        GlassEffectContainer(spacing: 20) {
            VStack(spacing: 28) {
                VStack(spacing: 8) {
                    Text("Moniq")
                        .font(.system(.largeTitle, design: .serif, weight: .semibold))
                    Text("biometrics.lock.subtitle")
                        .font(.subheadline)
                        .foregroundStyle(MoniqColor.muted)
                }
                Button("biometrics.unlock.action", systemImage: "faceid") {
                    Task { await unlock() }
                }
                .foregroundStyle(MoniqColor.background)
                .buttonStyle(.glassProminent)
                .tint(MoniqColor.foreground)
                .controlSize(.large)
                .accessibilityIdentifier("biometrics.unlock")
            }
            .padding(32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .moniqCanvas()
    }
}
