import Foundation
import SwiftData

/// Process-wide runtime owning shared singletons: the SwiftData container,
/// the wallet repository, and the auth client. Mirrors AnquiAppRuntime's role
/// in the second_brain project.
@MainActor
final class MoniqAppRuntime {
    static let shared = MoniqAppRuntime()

    let modelContainer: ModelContainer
    let walletRepository: WalletRepository
    let authClient = SupabaseAuthClient.shared

    private init() {
        do {
            modelContainer = try ModelContainer(for: WalletRecord.self, TransactionRecord.self)
        } catch {
            fatalError("Failed to create SwiftData ModelContainer: \(error)")
        }
        walletRepository = SwiftDataWalletRepository()
    }
}
