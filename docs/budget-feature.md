# Budget Feature

## Overview

The Budget page (`/budget`) shows retrospective monthly cashflow and lets users drill into spending by envelope, category, and transaction. It answers three questions at a glance:

1. **Is this month positive or negative?** The top timeline shows net cashflow by month.
2. **Which envelopes used the income?** The month analysis sheet shows root expense envelopes as percentages of income and total expenses.
3. **Where is the money going?** The category grid and detail panel show current-month category activity.

All budget analytics use paid transactions only. Transfers are excluded. Debt payments keep the finance analytics rule that only `interest_amount` contributes to expense analytics.

## Page Layout

The page is a viewport-fitting layout. The outer container is `h-full overflow-hidden`; each section owns its own scroll.

```
+--------------------------------------+
|  BudgetBarChart + month navigation   |  shrink-0, never scrolls
+--------------------------------------+
|  EXPENSES                            |  flex-[3], overflow-y-auto
|   [tile] [tile] [tile] [tile]        |
+--------------------------------------+
|  INCOME                              |  flex-[2], overflow-y-auto
|   [tile]                             |
+--------------------------------------+
```

When a category tile is selected, a detail panel opens to the right of the category panels on desktop. Month analysis opens as a right-side `Sheet` over the page and does not replace the category drill-in.

The page does not use `PageContainer` or a full-page `Surface`. Content renders directly on `bg-background`, matching the Balance page pattern.

## Components

### `BudgetView`

Location: `features/budget/components/budget-view.tsx`

Top-level view. Owns selected month, selected category, and selected month-analysis report state. It renders the monthly timeline, month navigation, category grids, category detail panel, and month analysis sheet.

### `BudgetBarChart`

Location: `features/budget/components/budget-bar-chart.tsx`

A 13-month interactive timeline. It keeps every currency in its own lane and shows net cashflow against a midpoint baseline. Positive months extend upward with neutral chart color; negative months extend downward with the destructive token. The current month is emphasized with a stronger fill.

Hover opens a `Tooltip` with income, expenses, net, paid transaction count, and top root envelopes. Click opens `BudgetMonthAnalysisSheet` for full detail.

### `BudgetMonthAnalysisSheet`

Location: `features/budget/components/budget-month-analysis-sheet.tsx`

Right-side sheet opened from a month in the timeline. It shows currency-local overview totals, root expense envelopes with percentages, nested category rows, income category breakdowns, uncategorized groups, and transaction rows for expanded groups.

The sheet follows the Moniq row language: no cards, no chips, no icon badges, no bright semantic fills, and no cross-currency aggregation.

### `CategoryTile`

A grid cell button: centered icon, `type-body-12` name, and amount. Selection state is `bg-secondary/60`; hover is `hover:bg-secondary/50`.

### `CategoryDetail`

Appears in the right panel when a category tile is selected. Shows the category header, subcategory rows, and a `TransactionList` for settled transactions in the current month.

## Data Flow

```
useFinanceData()
  -> BudgetView
  -> buildBudgetMonthlySummaries(transactions, currentMonth)
  -> monthly timeline summaries
  -> buildCategorySpendingReport(categories, transactions, month)
  -> month tooltip + month analysis sheet
  -> filter to selected month
  -> monthTransactions
  -> buildCategoryTree(categories, monthTransactions)
  -> categoryTree
  -> split and sort by |total_amount|
  -> expenseNodes / incomeNodes
  -> getCategoryDescendantIds() for selected category
  -> selectedTransactions
```

`buildCategoryTree` powers the current-month category grid and detail panel. `buildCategorySpendingReport` is the shared UI/MCP analytics contract. The MCP tools `get_category_spending_report` and `get_budget_month_analysis` return the same report shape, including the `summary` block used by the Budget page. Percentages are always calculated per currency.

## Storybook

Stories:

- `Pages/Budget` renders the full viewport-fitting page.
- `Features/Budget/BudgetBarChart` covers default, previous-month, negative-month, and empty timeline states.

The full-page story wrapper uses `<div className="h-screen">` with no padding so the viewport-fitting layout renders correctly in Storybook.
