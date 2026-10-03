# Budget Feature

## Overview

The Budget page (`/budget`) answers one question: **where am I against my plan this month?**
Each top-level expense category is an *envelope* with an optional monthly plan. The screen shows, for the
selected month and in the user's default currency:

1. **The month at a glance** — what the planned envelopes will have left at month end (plan − spent − upcoming), with spent, upcoming and planned under it, the month's income (received and still expected) and what was spent without a plan.
2. **Every envelope as one flat row** — what will be left at month end (or by how much it is / will be over), a full-width track with the actual spend (solid) and the upcoming spend (light), and "spent of planned · +upcoming".
3. **Upcoming this month** — the month's planned, not yet paid operations grouped by date (overdue first), with mark paid / skip / edit.
4. **Detail one tap away** — plan (editable), spent, upcoming, left at month end, subcategories, the envelope's planned operations and (collapsed) its paid transactions.

A compact 13-month strip (net cashflow) sits above the summary and is the month picker: clicking a month switches the whole page to it (no side sheet). The window keeps two future months in view and always contains the selected month.

**Spent** counts paid transactions only; **upcoming** counts `status: "planned"` transactions of the month (skipped ones are ignored). Planned amounts dated in the future are converted with the latest known rate. Upcoming never changes an envelope's *status* (which follows actual spend); an envelope that the upcoming operations will take over its plan is flagged `atRisk` ("will be over") and sorts right after the ones already over. Transfers are excluded. Debt payments keep the finance analytics rule that only `interest_amount` contributes to expense analytics. Spend is converted with the historical rate for each transaction date; if any required rate is missing the envelope (and the summary) shows "—" instead of a partial cross-currency total.

## Planned budgets

A plan is one number in `preferences.default_currency`, stored as a `[budget: N]` prefix of the category description. Plans exist only on **top-level expense categories** (the same rule the MCP tools enforce); the category form hides the field elsewhere. Per envelope: `left = planned - spent`, `percentUsed = spent / planned`, status `ok`, `near` (>= 85%), `over` (spent > planned), `unplanned` (no plan) or `unavailable` (missing FX rate). Rows are sorted over-budget first (most over first), then closest to plan, then unplanned by spend, then unavailable.

## Page Layout

Mobile (below 1024px, one layout for every width) is a single list; desktop keeps the two-panel layout.

```
+--------------------------------------+
|  Budget header + category management |
+--------------------------------------+
|  13-month strip (click = select month) |
|  ‹  October 2026  ›                  |
+--------------------------------------+
|  Left at month end   1 965 Kč        |
|  ████████████░░░░░░──  (spent|upcoming)|
|  Spent | Upcoming | Planned           |
|  Income (+expected)   No plan         |
+--------------------------------------+
|  EXPENSES                            |
|   Enjoy Life           over 25 Kč    |
|   ████████████████████████████████   |
|   125 of 100 Kč                      |
|   Living Costs  will be over 1 160   |
|   ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░   |
|   2 160 of 10 000 Kč   +9 000 upcoming|
|   ...                                |
+--------------------------------------+
|  INCOME                              |
|   Income            received ...     |
+--------------------------------------+
|  UPCOMING THIS MONTH    3 operations |
|   Oct 1  Core Bills  Overdue   900   |
|   Oct 6  Living Costs        9 000   |
+--------------------------------------+
```

Tapping an envelope opens a **fullscreen sheet** below `lg` (back action returns to the list or to the parent category), the same pattern as the Balance register. On desktop the detail renders in the right-hand panel and toggles with the row.

The page does not use `PageContainer` or a full-page `Surface`. Content renders directly on `bg-card lg:bg-background`, matching the Balance page pattern. There are no tiles, icon circles or rings.

## Components

### `BudgetView`

Location: `features/budget/components/budget-view.tsx`

Owns the selected month, selected category, the category-management workspace and the viewport switch (fullscreen sheet vs right panel). Builds the envelope rows and the summary with the pure helpers below.

### `envelope-budget.ts`

Location: `features/budget/lib/envelope-budget.ts`

`buildEnvelopeBudgetRows` (per envelope: planned, converted spent and upcoming incl. subcategories, forecast, left, forecastLeft, percent, status, atRisk), `summarizeEnvelopeBudget` (planned, spent of planned envelopes, unplanned, left, upcomingPlanned, upcoming, forecastLeft; unavailable when any rate is missing), `sumEnvelopeSpend` / `sumEnvelopeUpcoming` (converted income received / expected), `sumUncategorizedSpend` (paid or planned, by `status`) and `listMonthPlannedTransactions` (overdue + upcoming, oldest first). Never merges currencies without a rate.

### `EnvelopeRow`, `BudgetSummary`, `EnvelopeDetail`

`envelope-row.tsx` is the flat row (name, left/over/will be over at month end, a full-width two-segment `ProgressTrack` — `secondaryValue` is the upcoming share — and "spent of planned · +upcoming"; unplanned rows show spent and "+upcoming"). `budget-summary.tsx` is the month figures led by "left at month end". `budget-upcoming-list.tsx` is the month's planned operations (shared `TransactionList` with the standard row actions). `envelope-detail.tsx` is the detail (plan input, spent, upcoming, left at month end, subcategory rows with share-of-envelope tracks, planned operations, collapsed paid transactions) used both in the desktop panel and the mobile sheet. Row actions and the edit sheet come from `useBudgetTransactionEditor` (`features/budget/hooks`).

### `BudgetBarChart`

Location: `features/budget/components/budget-bar-chart.tsx`

A 13-month interactive timeline in `preferences.default_currency`; `compact` renders the slim strip used on the Budget screen. Solid bars are paid net (positive up in a neutral chart color, negative down in the destructive token); a light bar behind shows the net once the month's planned operations are paid, so future months show their planned net. A month with any missing required rate is rendered unavailable. Hover opens a `Tooltip` with converted income, expenses, net and planned; clicking a month calls `onMonthChange` and the Budget page switches to it in place (the former month-analysis side sheet was removed).

### Category management

The page header toggles an inline category-management mode. Expense and income
sections keep their row layout while exposing add and action controls; create,
edit, reparent, and icon selection render directly beneath the affected row.
Deletion still uses the focused confirmation sheet. System categories such as
balance adjustments remain visible on their transactions but are excluded from
the manageable category tree.

### Historical exchange rates

Budget detects missing rates for each paid transaction date in its 13-month
window and requests those dates in one authenticated refresh call. Returned
rates are merged into the current snapshot immediately and persisted when the
service role is configured, so currencies with incomplete history such as RUB
do not leave an otherwise convertible month unavailable.

## Data Flow

```
useFinanceData()
  -> BudgetView
  -> monthTransactions (settled, selected month)
  -> buildCategoryTree(manageable categories, monthTransactions)
  -> buildEnvelopeBudgetRows(expense roots / income roots)   // converted, with plans
  -> summarizeEnvelopeBudget / sumEnvelopeSpend
  -> EnvelopeRow list + BudgetSummary
  -> EnvelopeDetail (sheet below lg, panel on lg+)
```

The pure Budget analytics helper still owns historical conversion and reports missing FX pairs. Original transaction amounts remain visible in the detail's transaction rows.

## Storybook

Stories:

- `Pages/Budget` covers the default list, over-budget ordering, planned operations (`PlannedOperations`: forecast summary, "will be over" envelope, upcoming list with an overdue item — fixtures are dated relative to today), month selection from the strip (`MonthFromChart`), the desktop panel (expanded and collapsed), the mobile fullscreen detail (closed again and left open), mobile category management and inline category editing. The mock categories carry plans (Core Bills 33 200, Living Costs 10 000, Enjoy Life 100) so planned, over-budget and no-plan rows all render.
- `Features/Budget/BudgetBarChart` covers default, compact, previous-month, negative-month and empty timeline states.

The full-page story wrapper uses `<div className="h-screen">` with no padding so the viewport-fitting layout renders correctly in Storybook.
