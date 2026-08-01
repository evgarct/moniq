import Foundation

enum TransactionStatus: String, Codable, CaseIterable, Sendable {
    case planned
    case paid
    case skipped
}

enum TransactionKind: String, Codable, CaseIterable, Sendable {
    case income
    case expense
    case transfer
    case saveToGoal = "save_to_goal"
    case spendFromGoal = "spend_from_goal"
    case debtPayment = "debt_payment"
    case investment
    case refund
    case adjustment
}

struct Transaction: Identifiable, Codable, Sendable, Hashable {
    let id: UUID
    var title: String
    var note: String?
    var occurredAt: Date
    var status: TransactionStatus
    var kind: TransactionKind
    var amount: Decimal
    var walletId: UUID
    var categoryId: UUID?
}
