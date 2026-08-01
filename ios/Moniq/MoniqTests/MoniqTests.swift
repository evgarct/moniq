import Foundation
import SwiftData
import Testing
@testable import Moniq

struct MoniqTests {
    @Test func domainRawValuesMatchPostgresEnums() {
        #expect(WalletType.creditCard.rawValue == "credit_card")
        #expect(TransactionKind.saveToGoal.rawValue == "save_to_goal")
        #expect(TransactionKind.spendFromGoal.rawValue == "spend_from_goal")
        #expect(TransactionKind.debtPayment.rawValue == "debt_payment")
    }

    @Test func balanceSnapshotGroupsAndSortsWallets() {
        let userWallets = [
            Wallet(id: UUID(), name: "Zulu", type: .cash, balance: 1, currency: "EUR", creditLimit: nil),
            Wallet(id: UUID(), name: "Alpha", type: .cash, balance: 2, currency: "CZK", creditLimit: nil),
            Wallet(id: UUID(), name: "Reserve", type: .saving, balance: 3, currency: "EUR", creditLimit: nil)
        ]
        let snapshot = BalanceSnapshot(wallets: userWallets, allocations: [], transactions: [])
        #expect(snapshot.wallets(of: .cash).map(\.name) == ["Alpha", "Zulu"])
        #expect(snapshot.wallets(of: .cash).map(\.currency) == ["CZK", "EUR"])
    }

    @Test func freeBalanceSubtractsOnlyWalletAllocations() {
        let walletID = UUID()
        let otherID = UUID()
        let snapshot = BalanceSnapshot(
            wallets: [Wallet(id: walletID, name: "Reserve", type: .saving, balance: 10_000, currency: "EUR", creditLimit: nil)],
            allocations: [
                WalletAllocation(id: UUID(), walletId: walletID, name: "Trip", amount: 2_500, targetAmount: 4_000),
                WalletAllocation(id: UUID(), walletId: otherID, name: "Other", amount: 9_000, targetAmount: nil)
            ],
            transactions: []
        )
        #expect(snapshot.freeBalance(for: walletID) == 7_500)
    }

    @Test func creditUtilizationIsClamped() {
        let walletID = UUID()
        let snapshot = BalanceSnapshot(
            wallets: [Wallet(id: walletID, name: "Card", type: .creditCard, balance: -120, currency: "EUR", creditLimit: 100)],
            allocations: [],
            transactions: []
        )
        #expect(snapshot.creditUtilization(for: walletID) == 1)
    }

    @MainActor
    @Test func replacingSnapshotIsAtomicAndUserNamespaced() throws {
        let configuration = ModelConfiguration(isStoredInMemoryOnly: true)
        let container = try ModelContainer(for: WalletRecord.self, WalletAllocationRecord.self, TransactionRecord.self, configurations: configuration)
        let repository = SwiftDataWalletRepository(context: container.mainContext)
        let firstUser = UUID()
        let secondUser = UUID()
        let firstWallet = Wallet(id: UUID(), name: "First", type: .cash, balance: 10, currency: "EUR", creditLimit: nil)
        let secondWallet = Wallet(id: UUID(), name: "Second", type: .saving, balance: 20, currency: "CZK", creditLimit: nil)

        try repository.replaceSnapshot(BalanceSnapshot(wallets: [firstWallet], allocations: [], transactions: []), userID: firstUser)
        try repository.replaceSnapshot(BalanceSnapshot(wallets: [secondWallet], allocations: [], transactions: []), userID: secondUser)
        try repository.replaceSnapshot(.empty, userID: firstUser)

        #expect(try repository.fetchSnapshot(userID: firstUser) == .empty)
        #expect(try repository.fetchSnapshot(userID: secondUser).wallets == [secondWallet])
    }

    @MainActor
    @Test func biometricPreferenceRequiresSuccessfulAuthentication() async throws {
        let suite = "MoniqTests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }

        let success = BiometricLockService(defaults: defaults, automationResult: true)
        try await success.setEnabled(true)
        #expect(success.isEnabled)
        success.reset()
        #expect(!success.isEnabled)

        let failure = BiometricLockService(defaults: defaults, automationResult: false)
        await #expect(throws: CancellationError.self) { try await failure.setEnabled(true) }
        #expect(!failure.isEnabled)
    }

    @Test func recurringScheduleProjectsRollingWindowWithoutMaterializedOccurrence() throws {
        let calendar = Calendar(identifier: .iso8601)
        let today = calendar.startOfDay(for: .now)
        let tomorrow = try #require(calendar.date(byAdding: .day, value: 1, to: today))
        let dayAfter = try #require(calendar.date(byAdding: .day, value: 2, to: today))
        let scheduleID = UUID()
        let walletID = UUID()
        let schedule = RemoteSchedule(
            id: scheduleID,
            title: "Rent",
            note: nil,
            startDate: localDate(today),
            frequency: "daily",
            intervalWeeks: 1,
            untilDate: localDate(dayAfter),
            kind: .expense,
            amount: 100,
            destinationAmount: nil,
            categoryID: nil,
            sourceAccountID: walletID,
            destinationAccountID: nil
        )

        let projected = schedule.projectedTransactions(
            excluding: ["\(scheduleID.uuidString)|\(localDate(tomorrow))"]
        )

        #expect(projected.map(\.occurredAt) == [localDate(today), localDate(dayAfter)])
        #expect(projected.allSatisfy { $0.status == .planned })
        #expect(projected.allSatisfy { $0.scheduleID == scheduleID })
    }

    private func localDate(_ date: Date) -> String {
        let parts = Calendar(identifier: .iso8601).dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}
