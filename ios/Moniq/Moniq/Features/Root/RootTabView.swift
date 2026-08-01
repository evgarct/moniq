import SwiftUI

/// The 5-tab navigation shell described in docs/ios-swift-reference.md §2.
struct RootTabView: View {
    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Today", systemImage: "sun.horizon") }

            BalanceView()
                .tabItem { Label("Balance", systemImage: "wallet.pass") }

            TransactionsView()
                .tabItem { Label("Transactions", systemImage: "list.bullet.rectangle") }

            BudgetView()
                .tabItem { Label("Budget", systemImage: "chart.bar") }

            CalendarView()
                .tabItem { Label("Calendar", systemImage: "calendar") }
        }
    }
}
