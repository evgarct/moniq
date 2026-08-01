import Foundation
import SwiftData

/// SwiftData mirror of the `finance_transactions` table. Skeleton only — no sync logic yet.
@Model
final class TransactionRecord {
    @Attribute(.unique) var id: UUID
    var title: String
    var note: String?
    var occurredAt: Date
    var statusRawValue: String
    var kindRawValue: String
    var amount: Decimal
    var walletId: UUID
    var categoryId: UUID?

    init(
        id: UUID,
        title: String,
        note: String?,
        occurredAt: Date,
        status: TransactionStatus,
        kind: TransactionKind,
        amount: Decimal,
        walletId: UUID,
        categoryId: UUID?
    ) {
        self.id = id
        self.title = title
        self.note = note
        self.occurredAt = occurredAt
        self.statusRawValue = status.rawValue
        self.kindRawValue = kind.rawValue
        self.amount = amount
        self.walletId = walletId
        self.categoryId = categoryId
    }

    var status: TransactionStatus {
        TransactionStatus(rawValue: statusRawValue) ?? .planned
    }

    var kind: TransactionKind {
        TransactionKind(rawValue: kindRawValue) ?? .expense
    }
}
