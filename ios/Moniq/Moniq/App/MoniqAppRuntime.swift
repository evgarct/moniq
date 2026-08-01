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
    let balanceSync: any BalanceSyncing
    let biometricLock: BiometricLockService
    let demoMode: Bool
    private(set) var balanceRevision = 0

    private init() {
        demoMode = AppConfiguration.isDemoMode
        biometricLock = BiometricLockService()
#if DEBUG
        authClient = demoMode ? DemoAuthClient() : SupabaseAuthClient.shared
        balanceSync = demoMode ? DemoBalanceSyncService() : SupabaseBalanceSyncService(client: SupabaseAuthClient.shared.client)
#else
        authClient = SupabaseAuthClient.shared
        balanceSync = SupabaseBalanceSyncService(client: SupabaseAuthClient.shared.client)
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

    func runBalanceSync(userID: UUID) async {
        guard !demoMode else { return }
        await refreshBalance(userID: userID)
        for await snapshot in balanceSync.snapshots(userID: userID) {
            guard !Task.isCancelled else { return }
            persist(snapshot, userID: userID)
        }
    }

    func refreshBalance(userID: UUID) async {
        guard !demoMode, let snapshot = try? await balanceSync.refresh(userID: userID) else { return }
        guard !Task.isCancelled else { return }
        persist(snapshot, userID: userID)
    }

    private func persist(_ snapshot: BalanceSnapshot, userID: UUID) {
        guard (try? walletRepository.replaceSnapshot(snapshot, userID: userID)) != nil else { return }
        balanceRevision &+= 1
    }
}
