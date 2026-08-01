import Foundation

enum AppConfiguration {
    static let demoUserID = UUID(uuidString: "11111111-1111-1111-1111-111111111111")!

    static var isDemoMode: Bool {
#if DEBUG
        ProcessInfo.processInfo.arguments.contains("-MONIQ_DEMO_MODE")
#else
        false
#endif
    }
}
