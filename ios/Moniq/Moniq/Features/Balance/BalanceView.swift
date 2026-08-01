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

    func load() {
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
            model.load()
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
            LazyVStack(alignment: .leading, spacing: 30) {
                BalanceHeader(compact: hasScrolled)

                ForEach(groups, id: \.0) { type, title in
                    let wallets = snapshot.wallets.filter { $0.type == type }
                    if !wallets.isEmpty {
                        WalletGroup(title: title, wallets: wallets, snapshot: snapshot)
                    }
                }

                WalletGroup(title: "balance.group.investments", wallets: [], snapshot: snapshot)
            }
            .padding(.horizontal, 18)
            .padding(.top, 12)
            .padding(.bottom, 36)
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
        MoniqGlassSurface {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: compact ? 2 : 6) {
                    Text("balance.title")
                        .font(.system(compact ? .title : .largeTitle, design: .serif, weight: .semibold))
                    if !compact {
                        Text("balance.subtitle")
                            .font(.subheadline)
                            .foregroundStyle(MoniqColor.muted)
                    }
                }
                Spacer()
                Image(systemName: "eye.slash")
                    .font(.system(size: 18, weight: .thin))
                    .accessibilityLabel(Text("balance.hideMinorUnits"))
            }
            .padding(compact ? 16 : 20)
            .animation(.easeOut(duration: 0.18), value: compact)
        }
    }
}

private struct WalletGroup: View {
    let title: LocalizedStringKey
    let wallets: [Wallet]
    let snapshot: BalanceSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .tracking(0.8)
                .foregroundStyle(MoniqColor.muted)
                .padding(.leading, 6)

            MoniqGlassSurface {
                VStack(spacing: 0) {
                    if wallets.isEmpty {
                        Text("balance.investments.empty")
                            .font(.subheadline)
                            .foregroundStyle(MoniqColor.muted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(18)
                    } else {
                        ForEach(Array(wallets.enumerated()), id: \.element.id) { index, wallet in
                            NavigationLink(value: wallet) {
                                WalletRow(wallet: wallet, snapshot: snapshot)
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("balance.wallet.\(wallet.id.uuidString)")
                            if index < wallets.count - 1 { Divider().padding(.leading, 54) }
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }
}

private struct WalletRow: View {
    let wallet: Wallet
    let snapshot: BalanceSnapshot

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 14) {
                Image(systemName: wallet.symbol)
                    .font(.system(size: 19, weight: .thin))
                    .foregroundStyle(MoniqColor.muted)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(wallet.name).font(.body.weight(.medium))
                    if wallet.type == .creditCard, let limit = wallet.creditLimit {
                        MoneyText(amount: limit + wallet.balance, currency: wallet.currency, tone: .muted)
                            .font(.caption)
                    }
                }
                Spacer()
                MoneyText(amount: wallet.balance, currency: wallet.currency)
                    .font(.body.weight(.semibold))
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(MoniqColor.muted)
            }

            if wallet.type == .creditCard, let limit = wallet.creditLimit, limit > 0 {
                ProgressView(value: NSDecimalNumber(decimal: abs(wallet.balance) / limit).doubleValue)
                    .tint(MoniqColor.foreground)
                    .padding(.leading, 36)
            }

            if wallet.type == .saving {
                VStack(spacing: 8) {
                    ForEach(snapshot.allocations.filter { $0.walletId == wallet.id }) { allocation in
                        HStack {
                            Text(allocation.name).font(.caption).foregroundStyle(MoniqColor.muted)
                            Spacer()
                            MoneyText(amount: allocation.amount, currency: wallet.currency, tone: .muted).font(.caption)
                        }
                    }
                    HStack {
                        Text("balance.free").font(.caption.weight(.medium))
                        Spacer()
                        MoneyText(amount: snapshot.freeBalance(for: wallet.id), currency: wallet.currency).font(.caption.weight(.medium))
                    }
                }
                .padding(.leading, 36)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
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
                MoniqGlassSurface {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(wallet.name)
                            .font(.system(.title, design: .serif, weight: .semibold))
                        MoneyText(amount: wallet.balance, currency: wallet.currency)
                            .font(.title2.weight(.semibold))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                }

                if transactions.isEmpty {
                    ContentUnavailableView("balance.register.empty.title", systemImage: "list.bullet", description: Text("balance.register.empty.message"))
                } else {
                    ForEach(grouped, id: \.0) { date, items in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(date, format: .dateTime.day().month(.wide))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(MoniqColor.muted)
                                .padding(.leading, 6)
                            MoniqGlassSurface {
                                VStack(spacing: 0) {
                                    ForEach(Array(items.enumerated()), id: \.element.id) { index, transaction in
                                        TransactionRow(transaction: transaction, currency: wallet.currency)
                                        if index < items.count - 1 { Divider().padding(.leading, 18) }
                                    }
                                }
                                .padding(.vertical, 4)
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
        Text("\(amount.formatted(.number.precision(.fractionLength(0...2)))) \(currency)")
            .monospacedDigit()
            .foregroundStyle(tone == .negative ? MoniqColor.destructive : tone == .muted ? MoniqColor.muted : MoniqColor.foreground)
            .accessibilityLabel(Text("\(amount.formatted()) \(currency)"))
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
        switch kind {
        case .income, .refund: abs(amount)
        default: -abs(amount)
        }
    }
}

#if DEBUG
#Preview("Balance") {
    RootTabView(userID: AppConfiguration.demoUserID) {}
        .environment(MoniqAppRuntime.shared)
}
#endif
