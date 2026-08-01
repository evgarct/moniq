import SwiftData
import SwiftUI

@main
@MainActor
struct MoniqApp: App {
    private let runtime = MoniqAppRuntime.shared

    var body: some Scene {
        WindowGroup {
            RootView(runtime: runtime)
                .modelContainer(runtime.modelContainer)
                .environment(runtime)
        }
    }
}

/// Switches among session loading, biometric lock, login and the authenticated tab shell.
private struct RootView: View {
    @Environment(\.scenePhase) private var scenePhase
    let runtime: MoniqAppRuntime
    @State private var userID: UUID?
    @State private var isCheckingSession = true
    @State private var isLocked = false

    var body: some View {
        Group {
            if isCheckingSession {
                LaunchView()
            } else if isLocked {
                BiometricLockView {
                    isLocked = !(await runtime.biometricLock.unlock())
                }
            } else if let userID {
                RootTabView(userID: userID, onSignOut: signOut)
            } else {
                LoginView(authClient: runtime.authClient) {
                    Task { await loadSession() }
                }
            }
        }
        .task {
            await loadSession()
        }
        .task(id: userID) {
            guard let userID else { return }
            await runtime.runBalanceSync(userID: userID)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, userID != nil, runtime.biometricLock.isEnabled {
                Task { isLocked = !(await runtime.biometricLock.unlock()) }
            } else if phase == .active, let userID {
                Task { await runtime.refreshBalance(userID: userID) }
            } else if phase == .background, userID != nil, runtime.biometricLock.isEnabled {
                isLocked = true
            }
        }
    }

    private func loadSession() async {
        if runtime.demoMode {
            userID = AppConfiguration.demoUserID
        } else {
            userID = await runtime.authClient.currentSession?.user.id
        }
        isCheckingSession = false
        if userID != nil, runtime.biometricLock.isEnabled {
            isLocked = !(await runtime.biometricLock.unlock())
        }
    }

    private func signOut() async {
        if let userID { try? runtime.walletRepository.clear(userID: userID) }
        try? await runtime.authClient.signOut()
        runtime.biometricLock.reset()
        self.userID = runtime.demoMode ? AppConfiguration.demoUserID : nil
    }
}

private struct LaunchView: View {
    var body: some View {
        VStack(spacing: 18) {
            Text("Moniq")
                .font(.system(.largeTitle, design: .serif, weight: .semibold))
            ProgressView()
                .tint(MoniqColor.foreground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("launch.loading")
        .moniqCanvas()
    }
}
