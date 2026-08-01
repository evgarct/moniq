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
        let calendar = Calendar(identifier: .iso8601)
        let futureBoundary = calendar.date(byAdding: .day, value: 30, to: calendar.startOfDay(for: .now)) ?? .now
        let futureBoundaryString = LocalDate.string(from: futureBoundary)
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
            .select("id,user_id,title,note,occurred_at,status,kind,amount,destination_amount,category_id,source_account_id,destination_account_id,schedule_id,schedule_occurrence_date")
            .eq("user_id", value: userID.uuidString)
            .lte("occurred_at", value: futureBoundaryString)
            .order("occurred_at", ascending: false)
            .limit(1_000)
            .execute()
            .value
        async let schedules: [RemoteSchedule] = client
            .from("finance_transaction_schedules")
            .select("id,user_id,title,note,start_date,frequency,interval_weeks,until_date,state,kind,amount,destination_amount,category_id,source_account_id,destination_account_id")
            .eq("user_id", value: userID.uuidString)
            .eq("state", value: "active")
            .execute()
            .value

        let (remoteWallets, remoteAllocations, remoteTransactions, remoteSchedules) = try await (wallets, allocations, transactions, schedules)
        let materializedOccurrences = Set(remoteTransactions.compactMap(\.scheduleOccurrenceKey))
        let projectedTransactions = remoteTransactions.filter { $0.status != .skipped }
            + remoteSchedules.flatMap { $0.projectedTransactions(excluding: materializedOccurrences) }
        return BalanceSnapshot(
            wallets: remoteWallets.map(\.domain),
            allocations: remoteAllocations.map(\.domain),
            transactions: projectedTransactions.flatMap(\.domainEntries)
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

struct RemoteTransaction: Decodable, Sendable {
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
    let scheduleID: UUID?
    let scheduleOccurrenceDate: String?

    enum CodingKeys: String, CodingKey {
        case id, title, note, status, kind, amount
        case occurredAt = "occurred_at"
        case destinationAmount = "destination_amount"
        case categoryID = "category_id"
        case sourceAccountID = "source_account_id"
        case destinationAccountID = "destination_account_id"
        case scheduleID = "schedule_id"
        case scheduleOccurrenceDate = "schedule_occurrence_date"
    }

    var scheduleOccurrenceKey: String? {
        guard let scheduleID, let scheduleOccurrenceDate else { return nil }
        return "\(scheduleID.uuidString)|\(scheduleOccurrenceDate)"
    }

    var domainEntries: [Transaction] {
        let date = LocalDate.date(from: occurredAt) ?? .distantPast
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

}

struct RemoteSchedule: Decodable, Sendable {
    let id: UUID
    let title: String
    let note: String?
    let startDate: String
    let frequency: String
    let intervalWeeks: Int
    let untilDate: String?
    let kind: TransactionKind
    let amount: Decimal
    let destinationAmount: Decimal?
    let categoryID: UUID?
    let sourceAccountID: UUID?
    let destinationAccountID: UUID?

    enum CodingKeys: String, CodingKey {
        case id, title, note, frequency, kind, amount
        case startDate = "start_date"
        case intervalWeeks = "interval_weeks"
        case untilDate = "until_date"
        case destinationAmount = "destination_amount"
        case categoryID = "category_id"
        case sourceAccountID = "source_account_id"
        case destinationAccountID = "destination_account_id"
    }

    func projectedTransactions(excluding materialized: Set<String>) -> [RemoteTransaction] {
        let calendar = Calendar(identifier: .iso8601)
        let lower = calendar.startOfDay(for: .now)
        guard var occurrence = LocalDate.date(from: startDate),
              let upper = calendar.date(byAdding: .day, value: 30, to: lower) else { return [] }
        let end = untilDate.flatMap(LocalDate.date(from:)) ?? upper
        var result: [RemoteTransaction] = []
        var safetyCounter = 0

        while occurrence <= min(upper, end), safetyCounter < 2_000 {
            let dateString = LocalDate.string(from: occurrence)
            let key = "\(id.uuidString)|\(dateString)"
            if occurrence >= lower, !materialized.contains(key) {
                result.append(RemoteTransaction(
                    id: stableUUID(base: id, label: dateString), title: title, note: note,
                    occurredAt: dateString, status: .planned, kind: kind, amount: amount,
                    destinationAmount: destinationAmount, categoryID: categoryID,
                    sourceAccountID: sourceAccountID, destinationAccountID: destinationAccountID,
                    scheduleID: id, scheduleOccurrenceDate: dateString
                ))
            }
            occurrence = next(after: occurrence, calendar: calendar) ?? .distantFuture
            safetyCounter += 1
        }
        return result
    }

    private func next(after date: Date, calendar: Calendar) -> Date? {
        switch frequency {
        case "daily": calendar.date(byAdding: .day, value: 1, to: date)
        case "weekly": calendar.date(byAdding: .weekOfYear, value: max(intervalWeeks, 1), to: date)
        case "monthly": calendar.date(byAdding: .month, value: 1, to: date)
        case "quarterly": calendar.date(byAdding: .month, value: 3, to: date)
        case "yearly": calendar.date(byAdding: .year, value: 1, to: date)
        default: nil
        }
    }
}

private enum LocalDate {
    static func date(from value: String) -> Date? {
        let parts = value.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return Calendar(identifier: .iso8601).date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    static func string(from date: Date) -> String {
        let parts = Calendar(identifier: .iso8601).dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}

private func stableUUID(base: UUID, label: String) -> UUID {
    let bytes = Array(base.uuidString.utf8) + Array(label.utf8)
    var hash: UInt64 = 0xcbf29ce484222325
    for byte in bytes { hash = (hash ^ UInt64(byte)) &* 0x100000001b3 }
    var uuid = base.uuid
    withUnsafeMutableBytes(of: &uuid) { raw in
        for index in 0..<8 { raw[8 + index] = UInt8(truncatingIfNeeded: hash >> (index * 8)) }
    }
    return UUID(uuid: uuid)
}
