import SwiftUI

@main
@MainActor
struct MoniqApp: App {
    private let runtime = MoniqAppRuntime.shared

    var body: some Scene {
        WindowGroup {
            RootView(authClient: runtime.authClient)
                .modelContainer(runtime.modelContainer)
        }
    }
}

/// Switches between the auth skeleton and the tab shell based on session state.
private struct RootView: View {
    let authClient: SupabaseAuthClient
    @State private var isSignedIn = false
    @State private var isCheckingSession = true

    var body: some View {
        Group {
            if isCheckingSession {
                ProgressView()
            } else if isSignedIn {
                RootTabView()
            } else {
                LoginView(authClient: authClient) {
                    isSignedIn = true
                }
            }
        }
        .task {
            isSignedIn = await authClient.currentSession != nil
            isCheckingSession = false
        }
    }
}
