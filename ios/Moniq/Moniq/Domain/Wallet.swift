import Foundation

enum WalletType: String, Codable, CaseIterable, Sendable {
    case cash
    case saving
    case creditCard = "credit_card"
    case debt
}

struct Wallet: Identifiable, Codable, Sendable, Hashable {
    let id: UUID
    var name: String
    var type: WalletType
    /// `cash`/`saving` are stored positive; `creditCard`/`debt` are stored negative (liabilities).
    var balance: Decimal
    var currency: String
    var creditLimit: Decimal?
}

struct WalletAllocation: Identifiable, Codable, Sendable, Hashable {
    let id: UUID
    var walletId: UUID
    var name: String
    var amount: Decimal
    var targetAmount: Decimal?
}
