import Foundation
import Supabase

protocol BalanceSyncing: Sendable {
    func refresh(userID: UUID) async throws -> BalanceSnapshot
    func snapshots(userID: UUID) -> AsyncStream<BalanceSnapshot>
}

/// Keeps SwiftData as a fast local mirror while Supabase remains authoritative.
/// Every realtime notification triggers a complete, user-scoped reconciliation;
/// this deliberately favours correctness over fragile event-by-event patching.
final class SupabaseBalanceSyncService: BalanceSyncing, Sendable {
    private let client: SupabaseClient

    init(client: SupabaseClient) {
        self.client = client
    }

    func refresh(userID: UUID) async throws -> BalanceSnapshot {
        async let wallets: [RemoteWallet] = client
            .from("wallets")
            .select("id,user_id,name,type,balance,currency,credit_limit")
            .eq("user_id", value: userID.uuidString)
            .execute()
            .value
        async let allocations: [RemoteAllocation] = client
            .from("wallet_allocations")
            .select("id,user_id,wallet_id,name,amount,target_amount")
            .eq("user_id", value: userID.uuidString)
            .execute()
            .value
        async let transactions: [RemoteTransaction] = client
            .from("finance_transactions")
            .select("id,user_id,title,note,occurred_at,status,kind,amount,destination_amount,category_id,source_account_id,destination_account_id")
            .eq("user_id", value: userID.uuidString)
            .order("occurred_at", ascending: false)
            .limit(500)
            .execute()
            .value

        let (remoteWallets, remoteAllocations, remoteTransactions) = try await (wallets, allocations, transactions)
        return BalanceSnapshot(
            wallets: remoteWallets.map(\.domain),
            allocations: remoteAllocations.map(\.domain),
            transactions: remoteTransactions.flatMap(\.domainEntries)
        )
    }

    func snapshots(userID: UUID) -> AsyncStream<BalanceSnapshot> {
        AsyncStream { continuation in
            let task = Task {
                let channel = client.channel("balance-\(userID.uuidString)")
                let filter = RealtimePostgresFilter.eq("user_id", value: userID.uuidString)
                let walletChanges = channel.postgresChange(AnyAction.self, schema: "public", table: "wallets", filter: filter)
                let allocationChanges = channel.postgresChange(AnyAction.self, schema: "public", table: "wallet_allocations", filter: filter)
                let transactionChanges = channel.postgresChange(AnyAction.self, schema: "public", table: "finance_transactions", filter: filter)

                await channel.subscribe()
                await withTaskGroup(of: Void.self) { group in
                    for changes in [walletChanges, allocationChanges, transactionChanges] {
                        group.addTask {
                            for await _ in changes {
                                guard !Task.isCancelled else { return }
                                if let snapshot = try? await self.refresh(userID: userID) {
                                    continuation.yield(snapshot)
                                }
                            }
                        }
                    }
                    group.addTask {
                        let clock = ContinuousClock()
                        while !Task.isCancelled {
                            try? await clock.sleep(for: .seconds(30))
                            guard !Task.isCancelled else { return }
                            if let snapshot = try? await self.refresh(userID: userID) {
                                continuation.yield(snapshot)
                            }
                        }
                    }
                    await group.waitForAll()
                }
                await client.removeChannel(channel)
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

#if DEBUG
struct DemoBalanceSyncService: BalanceSyncing {
    func refresh(userID: UUID) async throws -> BalanceSnapshot { .empty }
    func snapshots(userID: UUID) -> AsyncStream<BalanceSnapshot> { AsyncStream { $0.finish() } }
}
#endif

private struct RemoteWallet: Decodable, Sendable {
    let id: UUID
    let userID: UUID
    let name: String
    let type: WalletType
    let balance: Decimal
    let currency: String
    let creditLimit: Decimal?

    enum CodingKeys: String, CodingKey {
        case id, name, type, balance, currency
        case userID = "user_id"
        case creditLimit = "credit_limit"
    }

    var domain: Wallet { Wallet(id: id, name: name, type: type, balance: balance, currency: currency, creditLimit: creditLimit) }
}

private struct RemoteAllocation: Decodable, Sendable {
    let id: UUID
    let userID: UUID
    let walletID: UUID
    let name: String
    let amount: Decimal
    let targetAmount: Decimal?

    enum CodingKeys: String, CodingKey {
        case id, name, amount
        case userID = "user_id"
        case walletID = "wallet_id"
        case targetAmount = "target_amount"
    }

    var domain: WalletAllocation { WalletAllocation(id: id, walletId: walletID, name: name, amount: amount, targetAmount: targetAmount) }
}

private struct RemoteTransaction: Decodable, Sendable {
    let id: UUID
    let title: String
    let note: String?
    let occurredAt: String
    let status: TransactionStatus
    let kind: TransactionKind
    let amount: Decimal
    let destinationAmount: Decimal?
    let categoryID: UUID?
    let sourceAccountID: UUID?
    let destinationAccountID: UUID?

    enum CodingKeys: String, CodingKey {
        case id, title, note, status, kind, amount
        case occurredAt = "occurred_at"
        case destinationAmount = "destination_amount"
        case categoryID = "category_id"
        case sourceAccountID = "source_account_id"
        case destinationAccountID = "destination_account_id"
    }

    var domainEntries: [Transaction] {
        let date = parsedDate
        var entries: [Transaction] = []
        if let sourceAccountID {
            entries.append(Transaction(id: derivedID(for: "source"), title: title, note: note, occurredAt: date, status: status, kind: kind, amount: -amount, walletId: sourceAccountID, categoryId: categoryID))
        }
        if let destinationAccountID {
            entries.append(Transaction(id: derivedID(for: "destination"), title: title, note: note, occurredAt: date, status: status, kind: kind, amount: destinationAmount ?? amount, walletId: destinationAccountID, categoryId: categoryID))
        }
        return entries
    }

    private func derivedID(for side: String) -> UUID {
        let bytes = Array(id.uuidString.utf8) + Array(side.utf8)
        var hash: UInt64 = 0xcbf29ce484222325
        for byte in bytes { hash = (hash ^ UInt64(byte)) &* 0x100000001b3 }
        var uuid = id.uuid
        withUnsafeMutableBytes(of: &uuid) { raw in
            for index in 0..<8 { raw[8 + index] = UInt8(truncatingIfNeeded: hash >> (index * 8)) }
        }
        return UUID(uuid: uuid)
    }

    private var parsedDate: Date {
        let parts = occurredAt.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return .distantPast }
        return Calendar(identifier: .iso8601).date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) ?? .distantPast
    }
}
