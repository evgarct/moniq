import SwiftUI

@MainActor
@Observable
final class BalanceViewModel {
    enum State: Equatable {
        case loading
        case loaded(BalanceSnapshot)
        case failed
    }

    private(set) var state: State = .loading
    private let repository: any WalletRepository
    private let userID: UUID

    init(repository: any WalletRepository, userID: UUID) {
        self.repository = repository
        self.userID = userID
    }

    func loadLocal() {
        do {
            state = .loaded(try repository.fetchSnapshot(userID: userID))
        } catch {
            state = .failed
        }
    }

}

struct BalanceView: View {
    @Environment(MoniqAppRuntime.self) private var runtime
    let userID: UUID
    @State private var viewModel: BalanceViewModel?
    @State private var hasScrolled = false

    var body: some View {
        Group {
            if let viewModel {
                content(for: viewModel.state)
            } else {
                ProgressView()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .moniqCanvas()
        .task {
            guard viewModel == nil else { return }
            let model = BalanceViewModel(repository: runtime.walletRepository, userID: userID)
            viewModel = model
            model.loadLocal()
        }
        .onChange(of: runtime.balanceRevision) {
            viewModel?.loadLocal()
        }
    }

    @ViewBuilder
    private func content(for state: BalanceViewModel.State) -> some View {
        switch state {
        case .loading:
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed:
            ContentUnavailableView("balance.error.title", systemImage: "exclamationmark.triangle", description: Text("balance.error.message"))
        case .loaded(let snapshot):
            if snapshot.wallets.isEmpty {
                ContentUnavailableView("balance.empty.title", systemImage: "scale.3d", description: Text("balance.empty.message"))
            } else {
                BalanceInventory(snapshot: snapshot, hasScrolled: $hasScrolled)
            }
        }
    }
}

private struct BalanceInventory: View {
    let snapshot: BalanceSnapshot
    @Binding var hasScrolled: Bool

    private let groups: [(WalletType, LocalizedStringKey)] = [
        (.cash, "balance.group.cash"),
        (.saving, "balance.group.savings"),
        (.creditCard, "balance.group.creditCards"),
        (.debt, "balance.group.debts")
    ]

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 38) {
                BalanceHeader(compact: hasScrolled)

                ForEach(groups, id: \.0) { type, title in
                    let wallets = snapshot.wallets.filter { $0.type == type }
                    WalletGroup(title: title, wallets: wallets, snapshot: snapshot)
                }

                WalletGroup(title: "balance.group.investments", wallets: [], snapshot: snapshot)
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 44)
        }
        .onScrollGeometryChange(for: Bool.self) { geometry in
            geometry.contentOffset.y > 16
        } action: { _, newValue in
            hasScrolled = newValue
        }
        .navigationDestination(for: Wallet.self) { wallet in
            WalletDetailView(wallet: wallet, snapshot: snapshot)
        }
        .accessibilityIdentifier("balance.inventory")
    }
}

private struct BalanceHeader: View {
    let compact: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("balance.title")
                .font(.system(compact ? .title : .largeTitle, design: .serif, weight: .regular))
            Image(systemName: "info.circle")
                .font(.system(size: 17, weight: .regular))
                .foregroundStyle(MoniqColor.muted)
                .accessibilityHidden(true)
            Spacer()
            Image(systemName: "eye.slash")
                .font(.system(size: 19, weight: .light))
                .foregroundStyle(MoniqColor.muted)
                .accessibilityLabel(Text("balance.hideMinorUnits"))
        }
        .animation(.easeOut(duration: 0.18), value: compact)
    }
}

private struct WalletGroup: View {
    let title: LocalizedStringKey
    let wallets: [Wallet]
    let snapshot: BalanceSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(title)
                .font(.system(.title2, design: .serif, weight: .regular))

            VStack(spacing: 14) {
                if wallets.isEmpty {
                    Text("balance.group.empty")
                        .font(.body)
                        .foregroundStyle(MoniqColor.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    ForEach(wallets) { wallet in
                        NavigationLink(value: wallet) {
                            WalletRow(wallet: wallet, snapshot: snapshot)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("balance.wallet.\(wallet.id.uuidString)")
                    }
                }
            }
        }
    }
}

private struct WalletRow: View {
    let wallet: Wallet
    let snapshot: BalanceSnapshot

    var body: some View {
        VStack(spacing: 9) {
            HStack(spacing: 12) {
                Image(systemName: wallet.symbol)
                    .font(.system(size: 17, weight: .light))
                    .foregroundStyle(MoniqColor.muted)
                    .frame(width: 20)
                Text(wallet.name).font(.body.weight(.medium))
                Spacer()
                MoneyText(amount: wallet.balance, currency: wallet.currency)
                    .font(.body.weight(.medium))
            }

            if wallet.type == .creditCard, let limit = wallet.creditLimit, limit > 0 {
                ProgressView(value: NSDecimalNumber(decimal: abs(wallet.balance) / limit).doubleValue)
                    .tint(MoniqColor.foreground)
                    .padding(.leading, 32)
                HStack(spacing: 6) {
                    Text("balance.available")
                    MoneyText(amount: limit + wallet.balance, currency: wallet.currency, tone: .muted)
                }
                .font(.caption)
                .foregroundStyle(MoniqColor.muted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 32)
            }

            if wallet.type == .saving {
                Divider().padding(.leading, 32)
                VStack(spacing: 12) {
                    HStack {
                        Text("balance.free").foregroundStyle(MoniqColor.muted)
                        Spacer()
                        MoneyText(amount: snapshot.freeBalance(for: wallet.id), currency: wallet.currency, tone: .muted)
                    }
                    ForEach(snapshot.allocations.filter { $0.walletId == wallet.id }) { allocation in
                        VStack(spacing: 6) {
                            HStack(spacing: 10) {
                                Image(systemName: "scope")
                                    .font(.system(size: 15, weight: .light))
                                    .foregroundStyle(MoniqColor.muted)
                                    .frame(width: 18)
                                Text(allocation.name).font(.body.weight(.medium))
                                Spacer()
                                MoneyText(amount: allocation.amount, currency: wallet.currency).font(.body.weight(.medium))
                            }
                            if let target = allocation.targetAmount, target > 0 {
                                let progress = min(max(allocation.amount / target, 0), 1)
                                ProgressView(value: NSDecimalNumber(decimal: progress).doubleValue)
                                    .tint(MoniqColor.muted)
                                    .padding(.leading, 28)
                            }
                        }
                    }
                }
                .font(.body)
                .padding(.leading, 32)
            }
        }
        .padding(.vertical, 2)
        .padding(.bottom, wallet.type == .creditCard ? 18 : 0)
        .contentShape(.rect)
    }
}

private struct WalletDetailView: View {
    let wallet: Wallet
    let snapshot: BalanceSnapshot

    private var transactions: [Transaction] { snapshot.transactions(for: wallet.id) }
    private var grouped: [(Date, [Transaction])] {
        Dictionary(grouping: transactions) { Calendar.current.startOfDay(for: $0.occurredAt) }
            .sorted { $0.key > $1.key }
            .map { ($0.key, $0.value) }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(wallet.name)
                        .font(.system(.title, design: .serif, weight: .regular))
                    MoneyText(amount: wallet.balance, currency: wallet.currency)
                        .font(.title2.weight(.medium))
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if transactions.isEmpty {
                    ContentUnavailableView("balance.register.empty.title", systemImage: "list.bullet", description: Text("balance.register.empty.message"))
                } else {
                    ForEach(grouped, id: \.0) { date, items in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(date, format: .dateTime.day().month(.wide))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(MoniqColor.muted)
                                .padding(.leading, 6)
                            VStack(spacing: 10) {
                                ForEach(items) { transaction in
                                    TransactionRow(transaction: transaction, currency: wallet.currency)
                                }
                            }
                        }
                    }
                }
            }
            .padding(18)
        }
        .navigationTitle("balance.register.title")
        .navigationBarTitleDisplayMode(.inline)
        .moniqCanvas()
        .accessibilityIdentifier("balance.detail")
    }
}

private struct TransactionRow: View {
    let transaction: Transaction
    let currency: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.title).font(.body.weight(.medium))
                if let note = transaction.note {
                    Text(note).font(.caption).foregroundStyle(MoniqColor.muted)
                }
            }
            Spacer()
            MoneyText(amount: transaction.displayAmount, currency: currency, tone: transaction.displayAmount < 0 ? .negative : .default)
                .font(.body.weight(.medium))
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 13)
    }
}

private enum MoneyTone { case `default`, muted, negative }

private struct MoneyText: View {
    let amount: Decimal
    let currency: String
    var tone: MoneyTone = .default

    var body: some View {
        Text("\(amount.formatted(.number.precision(.fractionLength(0...2))))\u{00A0}\(currencySymbol)")
            .monospacedDigit()
            .foregroundStyle(tone == .negative ? MoniqColor.destructive : tone == .muted ? MoniqColor.muted : MoniqColor.foreground)
            .accessibilityLabel(Text("\(amount.formatted()) \(currency)"))
    }

    private var currencySymbol: String {
        switch currency {
        case "EUR": "€"
        case "CZK": "Kč"
        case "USD": "$"
        case "GBP": "£"
        case "JPY": "¥"
        case "RUB": "₽"
        case "CHF": "CHF"
        case "PLN": "zł"
        case "UAH": "₴"
        case "AED": "د.إ"
        case "TRY": "₺"
        case "CAD": "C$"
        default: currency
        }
    }
}

private extension Wallet {
    var symbol: String {
        switch type {
        case .cash: "banknote"
        case .saving: "banknote"
        case .creditCard: "creditcard"
        case .debt: "building.columns"
        }
    }
}

private extension Transaction {
    var displayAmount: Decimal {
        amount
    }
}

#if DEBUG
#Preview("Balance") {
    RootTabView(userID: AppConfiguration.demoUserID) {}
        .environment(MoniqAppRuntime.shared)
}
#endif
