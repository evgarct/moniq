import Foundation
import SwiftData

/// SwiftData mirror of the `wallets` table. Skeleton only — no sync logic yet.
@Model
final class WalletRecord {
    @Attribute(.unique) var id: UUID
    var userID: UUID
    var name: String
    var typeRawValue: String
    var balance: Decimal
    var currency: String
    var creditLimit: Decimal?

    init(id: UUID, userID: UUID, name: String, type: WalletType, balance: Decimal, currency: String, creditLimit: Decimal? = nil) {
        self.id = id
        self.userID = userID
        self.name = name
        self.typeRawValue = type.rawValue
        self.balance = balance
        self.currency = currency
        self.creditLimit = creditLimit
    }

    var type: WalletType {
        WalletType(rawValue: typeRawValue) ?? .cash
    }
}
