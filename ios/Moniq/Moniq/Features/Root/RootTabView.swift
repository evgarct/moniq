import SwiftUI

enum AppTab: Hashable {
    case today
    case balance
    case budget
    case reports
    case profile
}

struct RootTabView: View {
    let userID: UUID
    let onSignOut: () async -> Void
    @State private var selection: AppTab

    init(userID: UUID, onSignOut: @escaping () async -> Void) {
        self.userID = userID
        self.onSignOut = onSignOut
#if DEBUG
        _selection = State(initialValue: ProcessInfo.processInfo.arguments.contains("-MONIQ_INITIAL_PROFILE") ? .profile : .balance)
#else
        _selection = State(initialValue: .balance)
#endif
    }

    var body: some View {
        TabView(selection: $selection) {
            Tab("navigation.today", systemImage: "calendar", value: .today) {
                NavigationStack { TodayView() }
            }

            Tab("navigation.balance", systemImage: "scale.3d", value: .balance) {
                NavigationStack { BalanceView(userID: userID) }
            }

            Tab("navigation.budget", systemImage: "creditcard", value: .budget) {
                NavigationStack { BudgetView() }
            }

            Tab("navigation.reports", systemImage: "chart.line.uptrend.xyaxis", value: .reports) {
                NavigationStack { ReportsView() }
            }

            Tab("navigation.profile", systemImage: "person", value: .profile) {
                NavigationStack { ProfileView(userID: userID, onSignOut: onSignOut) }
            }
        }
        .tint(MoniqColor.foreground)
        .accessibilityIdentifier("root.tabs")
    }
}
