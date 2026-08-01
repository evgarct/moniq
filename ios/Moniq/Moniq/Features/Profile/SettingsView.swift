import SwiftUI

struct SettingsView: View {
    @Environment(MoniqAppRuntime.self) private var runtime
    let userID: UUID
    @State private var faceIDEnabled = false
    @State private var showsBiometricError = false
    @State private var isUpdatingFaceID = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                MoniqGlassSurface {
                    VStack(alignment: .leading, spacing: 8) {
                        Toggle(isOn: $faceIDEnabled) {
                            Label("settings.faceID.title", systemImage: "faceid")
                        }
                        .tint(MoniqColor.foreground)
                        .disabled(isUpdatingFaceID)
                        .onChange(of: faceIDEnabled) { oldValue, newValue in
                            guard !isUpdatingFaceID, oldValue != newValue else { return }
                            updateFaceID(newValue)
                        }
                        .accessibilityIdentifier("settings.faceID.toggle")

                        Text("settings.faceID.description")
                            .font(.footnote)
                            .foregroundStyle(MoniqColor.muted)
                    }
                    .padding(18)
                }
            }
            .padding(24)
        }
        .navigationTitle("profile.settings")
        .navigationBarTitleDisplayMode(.inline)
        .moniqCanvas()
        .onAppear { faceIDEnabled = runtime.biometricLock.isEnabled }
        .alert("settings.faceID.error.title", isPresented: $showsBiometricError) {
            Button("common.ok", role: .cancel) {}
        } message: {
            Text("settings.faceID.error.message")
        }
    }

    private func updateFaceID(_ enabled: Bool) {
        isUpdatingFaceID = true
        Task {
            do {
                try await runtime.biometricLock.setEnabled(enabled)
                faceIDEnabled = runtime.biometricLock.isEnabled
            } catch {
                faceIDEnabled = runtime.biometricLock.isEnabled
                showsBiometricError = true
            }
            isUpdatingFaceID = false
        }
    }
}
