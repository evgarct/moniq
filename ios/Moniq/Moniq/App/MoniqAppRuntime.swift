import Foundation
import Observation
import SwiftData

/// Process-wide runtime owning shared singletons: the SwiftData container,
/// the wallet repository, and the auth client. Mirrors AnquiAppRuntime's role
/// in the second_brain project.
@MainActor
@Observable
final class MoniqAppRuntime {
    static let shared = MoniqAppRuntime()

    let modelContainer: ModelContainer
    let walletRepository: any WalletRepository
    let authClient: any AuthClient
    let biometricLock: BiometricLockService
    let demoMode: Bool

    private init() {
        demoMode = AppConfiguration.isDemoMode
        biometricLock = BiometricLockService()
#if DEBUG
        authClient = demoMode ? DemoAuthClient() : SupabaseAuthClient.shared
#else
        authClient = SupabaseAuthClient.shared
#endif
        do {
            let configuration = ModelConfiguration(isStoredInMemoryOnly: demoMode)
            modelContainer = try ModelContainer(
                for: WalletRecord.self, WalletAllocationRecord.self, TransactionRecord.self,
                configurations: configuration
            )
        } catch {
            fatalError("Failed to create SwiftData ModelContainer: \(error)")
        }
        walletRepository = SwiftDataWalletRepository(context: modelContainer.mainContext)
        if demoMode {
            do {
                try DemoDataSeeder.seedIfNeeded(context: modelContainer.mainContext, userID: AppConfiguration.demoUserID)
            } catch {
                assertionFailure("Failed to seed demo data: \(error)")
            }
        }
    }
}
