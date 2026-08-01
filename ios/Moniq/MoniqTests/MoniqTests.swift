import Testing
@testable import Moniq

struct MoniqTests {
    @Test func walletTypeRawValuesMatchPostgresEnum() {
        #expect(WalletType.creditCard.rawValue == "credit_card")
    }

    @Test func transactionKindRawValuesMatchPostgresEnum() {
        #expect(TransactionKind.saveToGoal.rawValue == "save_to_goal")
        #expect(TransactionKind.spendFromGoal.rawValue == "spend_from_goal")
        #expect(TransactionKind.debtPayment.rawValue == "debt_payment")
    }
}
