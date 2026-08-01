# Moniq iOS Swift Implementation Reference

This document serves as the canonical technical and architectural blueprint for building the native iOS client for Moniq using **Swift**, **SwiftUI**, and local-first architecture (e.g., Supabase Swift SDK + SwiftData / SQLite / PowerSync Swift SDK).

---

## 1. Core Visual Identity & SwiftUI Design Language

The iOS app must strictly follow the Moniq design principles outlined in [`docs/design.md`](./design.md), the web client's single canonical design reference.

### 🚫 The Ultimate Rule: No Cards, No Chips, No Icon Badges
*   **No Card-per-Item Layout**: List items, transactions, accounts, and categories must live as flat rows inside a shared scrollable canvas or surface. Do not wrap individual rows in rounded border/shadow card containers.
*   **No Chips or Pills**: Category names, account types, and metadata tags must be shown as plain `caption` / `subheadline` text (muted color) next to or below primary labels. Do not use filled or bordered pills.
*   **No Icon Badges**: Render category or account icons as raw, thin-stroke outline marks (using SF Symbols with `ultraLight` or `thin` configurations, or Lucide SVG assets). Never wrap icons in colored circles, squares, or filled backgrounds.

### Color Palette (Warm Neutrals)
*   **Background / Canvas**: `#fafaf7` (Dark Mode: `#1a1a19`)
*   **Surface / Card Card**: `#f0f0eb` (Dark Mode: `#262624`)
*   **Secondary Surface**: `#e5e4df` (Dark Mode: `#30302e`)
*   **Status Color**: Color must apply to text/icons only. For negative amounts or error messages, use `red` (destructive tint). Never use bright fills for buttons or layout blocks.
*   **Data Visualization**: Use a cohesive warm color palette for charts (similar to `chart-1` `#cc785c` through `chart-5` `#40403e`).

### Mobile Shell & Safe Area Blending
*   The status bar and navigation bar background must blend seamlessly with the main content area. On iOS, configure the hosting view controller or SwiftUI `.background` to use the surface background `#f0f0eb` (or `#fafaf7` depending on screen context) and set navigation bar styles to transparent or matching background colors.
*   **Mobile Bottom Navigation Bar**: Height must be `49pt` (standard iOS bottom bar) + safe area bottom inset. The scrollable content below must apply bottom safe area insets and scroll clearance (e.g., bottom padding of `76pt` or custom scroll-padding) so that lists can be fully scrolled above the bottom navigation bar.

---

## 2. SwiftUI Screen Layout Specifications

The app contains five core tabs: **Today**, **Balance (Accounts)**, **Budget**, **Calendar**, and **Settings/Inbox**.

```
  +-------------------------------------------------------------+
  |  [Today]   [Balance/Accounts]   [Budget]  [Calendar] [Inbox] |  <-- Tab Bar (Bottom)
  +-------------------------------------------------------------+
```

### Tab 1: Today Screen
*   **Header**: Date display (large serif/editorial styling) + Quick add transaction button (raw outline icon).
*   **Daily Summary**: Grouped hero balance totals, separated by currency (e.g. EUR, RUB, USD) in `tabular-nums`. **Never sum different currencies**.
*   **Rolling Agenda List**: List of settled (`paid`) and upcoming (`planned`) transactions for the next 7 days.
    *   Row visual structure: `[Category Icon (Outline)] [Title / Muted Category Title Below]  [Right-aligned MoneyAmount]`.
    *   Row actions: Swipe-to-action to mark `planned` transactions as `paid` or `skipped`.

### Tab 2: Balance & Accounts Workspace
*   **Inventory Screen**: A single flat scroll list displaying wallets categorized by type:
    *   **Cash / Debit Card** (Normalized positive)
    *   **Credit Cards** (Normalized negative, displaying credit limit detail)
    *   **Savings**
    *   **Investments** (Displays unit balance; market value kept separate from totals)
    *   **Debts** (Normalized negative, personal loans/mortgages)
*   **Savings Wallet Detail (Allocations)**:
    *   Tapping a savings wallet navigates to its details panel.
    *   Displays targeted allocations (goals) and open allocations.
    *   Calculates a **"Free Balance"** bucket (Computed: `Wallet Balance - Sum of Allocations`). This bucket is virtual and is not persisted in the DB.

### Tab 3: Transactions & Ledger
*   **Ledger view**: A full scrollable ledger list with a search bar at the top (filtering by title, category, or note).
*   **Filters**: Horizontal scroll of filter buttons (by wallet, by category).
*   **Transaction Editor Sheet**:
    *   Opens from the bottom as an interactive sheet.
    *   Fields: Title, Amount, Date, Category Picker, Wallet Picker, Status (`paid`, `planned`), Kind (`income`, `expense`, `transfer`, `debt_payment`).
    *   Special Fields: Destination Wallet (for `transfer`), Debt breakdown (Principal, Interest, Extra Principal for `debt_payment`).

### Tab 4: Budget & Cashflow
*   **Cashflow Chart**: A custom bar chart showing Income vs. Expense for the selected month.
*   **Category Spending List**: Nested list showing parent and child category expenditure totals.
    *   Tapping a parent category expands to reveal child categories.
    *   Totals are calculated dynamically from transactions in the parent and all child subtrees.

### Tab 5: Calendar
*   **Month Grid**: Custom calendar view where each day shows small indicators if transactions are scheduled.
*   **Day Agenda**: Selecting a day opens the Day Agenda panel at the bottom.
    *   Lists all transactions occurring on that date.
    *   Uses a scroll container with a bottom padding helper to avoid obstruction by the bottom tab bar.

---

## 3. Data Model & Backend Synchronizations

### SQLite / SwiftData Schema
The local storage must map directly to the PostgreSQL database schema:

```swift
enum WalletType: String, Codable {
    case cash, saving, credit_card, debt
}

enum TransactionStatus: String, Codable {
    case planned, paid, skipped
}

enum TransactionKind: String, Codable {
    case income, expense, transfer, debt_payment
}

struct Wallet {
    let id: UUID
    let name: String
    let type: WalletType
    let balance: Decimal
    let currency: String // Currency code (e.g. "EUR")
    let creditLimit: Decimal?
}

struct WalletAllocation {
    let id: UUID
    let walletId: UUID
    let name: String
    let amount: Decimal
    let targetAmount: Decimal?
}

struct Transaction {
    let id: UUID
    let title: String
    let note: String?
    let occurredAt: Date
    let status: TransactionStatus
    let kind: TransactionKind
    let amount: Decimal
    let walletId: UUID
    let categoryId: UUID?
}
```

### Recurring Schedules Expansion
*   **Rule**: Recurring transactions are stored in `finance_transaction_schedules` with recurrence parameters (e.g., frequency, interval, start/end dates).
*   **Client Projection**: The client repository must dynamically expand these schedules into individual `planned` occurrence rows in memory within a rolling 30-day horizon.

### Reversible Optimistic UI
*   Any database mutations must be **optimistic**.
*   When a user submits a form or swipes to change status:
    1. Apply the mutation directly to the local SwiftData/SQLite cache.
    2. Instantly update the UI and close the sheets/details panels.
    3. Trigger a background synchronization call to the Supabase REST API or sync queue.
    4. If the background call fails, roll back the local cache state and trigger a localized Toast/Banner notification informing the user of the sync failure.

---

## 4. Current status

A skeleton exists at `ios/Moniq/` (Supabase auth + 5-tab navigation shell + SwiftData model scaffolding for `Wallet`/`Transaction`). No tab has real data or CRUD yet — every screen except `Auth` renders `FeaturePlaceholderView`. See `ios/Moniq/Documentation/ARCHITECTURE.md` for the current layer breakdown and why it's deliberately minimal: the next features to build should come from `docs/features/`'s PostHog-usage-ranked `priority` field once that data exists (see `docs/features/README.md`), not be guessed up front.

## 5. Agent Guidelines & Documentation Discipline

To maintain visual and technical coherence, all developers and AI agents working on the iOS client must follow strict repository guidelines — see `ios/Moniq/Documentation/AI.md` for the full, iOS-specific contract. Summary:

> [!IMPORTANT]
> **Strict Documentation & Visual Alignment Rule**
> Any modification, extension, or implementation of a new feature or design pattern must be documented immediately.
> 1. **Markdown Sync**: Update the corresponding reference file (`docs/ios-swift-reference.md`, `ios/Moniq/Documentation/ARCHITECTURE.md`, and/or `ios/Moniq/Documentation/DESIGN_SYSTEM.md`) to reflect the current state, logic, and component API.
> 2. **Visual Proof**: Save a screenshot/recording of the UI state (SwiftUI Preview or Simulator) alongside the change.
> 3. **Native verification, not Storybook**: There is no Storybook equivalent for native Swift code — an earlier draft of this document wrongly copied that web-only rule. Verify UI changes with SwiftUI Previews and Simulator builds/tests via `ios/Moniq/scripts/remote-build.ps1` (Windows → `muse-mac` over SSH — see `ios/Moniq/README.md`) or directly on a Mac. Physical-device installs are capped by Apple's free-account 3-App-ID/7-day limit, shared with `second_brain` on the same device — check before assuming a device slot is free. Do not claim a build/run/test result that hasn't actually been checked.
