import Foundation
import SwiftData

@MainActor
enum DemoDataSeeder {
    static func seedIfNeeded(context: ModelContext, userID: UUID) throws {
        var descriptor = FetchDescriptor<WalletRecord>(predicate: #Predicate { $0.userID == userID })
        descriptor.fetchLimit = 1
        guard try context.fetch(descriptor).isEmpty else { return }

        let everydayID = UUID(uuidString: "22222222-2222-2222-2222-222222222221")!
        let reserveID = UUID(uuidString: "22222222-2222-2222-2222-222222222222")!
        let creditID = UUID(uuidString: "22222222-2222-2222-2222-222222222223")!
        let debtID = UUID(uuidString: "22222222-2222-2222-2222-222222222224")!

        [
            WalletRecord(id: everydayID, userID: userID, name: "Prague Everyday", type: .cash, balance: 48_260, currency: "CZK"),
            WalletRecord(id: reserveID, userID: userID, name: "Euro Reserve", type: .saving, balance: 8_720, currency: "EUR"),
            WalletRecord(id: creditID, userID: userID, name: "Travel Credit", type: .creditCard, balance: -18_450, currency: "CZK", creditLimit: 80_000),
            WalletRecord(id: debtID, userID: userID, name: "Home Loan", type: .debt, balance: -1_840_000, currency: "CZK")
        ].forEach(context.insert)

        [
            WalletAllocationRecord(id: UUID(), userID: userID, walletID: reserveID, name: "Summer trip", amount: 2_400, targetAmount: 5_000),
            WalletAllocationRecord(id: UUID(), userID: userID, walletID: reserveID, name: "Emergency fund", amount: 3_800, targetAmount: 8_000)
        ].forEach(context.insert)

        let calendar = Calendar(identifier: .gregorian)
        [
            TransactionRecord(id: UUID(), userID: userID, title: "Salary", note: nil, occurredAt: calendar.date(byAdding: .day, value: -1, to: .now)!, status: .paid, kind: .income, amount: 76_000, walletId: everydayID, categoryId: nil),
            TransactionRecord(id: UUID(), userID: userID, title: "Groceries", note: "Neighbourhood market", occurredAt: calendar.date(byAdding: .day, value: -2, to: .now)!, status: .paid, kind: .expense, amount: -2_180, walletId: everydayID, categoryId: nil),
            TransactionRecord(id: UUID(), userID: userID, title: "Train tickets", note: nil, occurredAt: calendar.date(byAdding: .day, value: -4, to: .now)!, status: .paid, kind: .expense, amount: -1_240, walletId: creditID, categoryId: nil)
        ].forEach(context.insert)
        try context.save()
    }
}
