import Foundation
import SwiftData

/// Repository boundary between the local SwiftData cache and the rest of the app.
/// Skeleton only — no CRUD wired up yet; feature screens are placeholders until
/// the ranked feature slice from `docs/features/` picks what to build next.
struct BalanceSnapshot: Sendable, Equatable {
    var wallets: [Wallet]
    var allocations: [WalletAllocation]
    var transactions: [Transaction]

    static let empty = BalanceSnapshot(wallets: [], allocations: [], transactions: [])

    func transactions(for walletID: UUID) -> [Transaction] {
        transactions
            .filter { $0.walletId == walletID }
            .sorted { $0.occurredAt > $1.occurredAt }
    }

    func wallets(of type: WalletType) -> [Wallet] {
        wallets.filter { $0.type == type }.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    func creditUtilization(for walletID: UUID) -> Decimal? {
        guard let wallet = wallets.first(where: { $0.id == walletID }),
              wallet.type == .creditCard,
              let limit = wallet.creditLimit,
              limit > 0 else { return nil }
        return min(max(abs(wallet.balance) / limit, 0), 1)
    }

    func freeBalance(for walletID: UUID) -> Decimal {
        guard let wallet = wallets.first(where: { $0.id == walletID }) else { return 0 }
        let allocated = allocations.filter { $0.walletId == walletID }.reduce(Decimal.zero) { $0 + $1.amount }
        return wallet.balance - allocated
    }
}

@MainActor
protocol WalletRepository {
    func fetchSnapshot(userID: UUID) throws -> BalanceSnapshot
    func clear(userID: UUID) throws
}

@MainActor
final class SwiftDataWalletRepository: WalletRepository {
    private let context: ModelContext

    init(context: ModelContext) {
        self.context = context
    }

    func fetchSnapshot(userID: UUID) throws -> BalanceSnapshot {
        let walletRecords = try context.fetch(FetchDescriptor<WalletRecord>(
            predicate: #Predicate { $0.userID == userID },
            sortBy: [SortDescriptor(\.name)]
        ))
        let allocationRecords = try context.fetch(FetchDescriptor<WalletAllocationRecord>(
            predicate: #Predicate { $0.userID == userID },
            sortBy: [SortDescriptor(\.name)]
        ))
        let transactionRecords = try context.fetch(FetchDescriptor<TransactionRecord>(
            predicate: #Predicate { $0.userID == userID },
            sortBy: [SortDescriptor(\.occurredAt, order: .reverse)]
        ))

        return BalanceSnapshot(
            wallets: walletRecords.map(\.domain),
            allocations: allocationRecords.map(\.domain),
            transactions: transactionRecords.map(\.domain)
        )
    }

    func clear(userID: UUID) throws {
        try context.delete(model: WalletRecord.self, where: #Predicate { $0.userID == userID })
        try context.delete(model: WalletAllocationRecord.self, where: #Predicate { $0.userID == userID })
        try context.delete(model: TransactionRecord.self, where: #Predicate { $0.userID == userID })
        try context.save()
    }
}

private extension WalletRecord {
    var domain: Wallet { Wallet(id: id, name: name, type: type, balance: balance, currency: currency, creditLimit: creditLimit) }
}

private extension WalletAllocationRecord {
    var domain: WalletAllocation { WalletAllocation(id: id, walletId: walletID, name: name, amount: amount, targetAmount: targetAmount) }
}

private extension TransactionRecord {
    var domain: Transaction {
        Transaction(id: id, title: title, note: note, occurredAt: occurredAt, status: status, kind: kind, amount: amount, walletId: walletId, categoryId: categoryId)
    }
}
