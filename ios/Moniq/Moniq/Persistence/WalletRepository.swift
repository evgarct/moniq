import Foundation

/// Repository boundary between the local SwiftData cache and the rest of the app.
/// Skeleton only — no CRUD wired up yet; feature screens are placeholders until
/// the ranked feature slice from `docs/features/` picks what to build next.
protocol WalletRepository: Sendable {
    func fetchWallets() async throws -> [Wallet]
}

final class SwiftDataWalletRepository: WalletRepository {
    func fetchWallets() async throws -> [Wallet] {
        []
    }
}
