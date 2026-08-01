import Foundation
import SwiftData

@Model
final class WalletAllocationRecord {
    @Attribute(.unique) var id: UUID
    var userID: UUID
    var walletID: UUID
    var name: String
    var amount: Decimal
    var targetAmount: Decimal?

    init(id: UUID, userID: UUID, walletID: UUID, name: String, amount: Decimal, targetAmount: Decimal?) {
        self.id = id
        self.userID = userID
        self.walletID = walletID
        self.name = name
        self.amount = amount
        self.targetAmount = targetAmount
    }
}
