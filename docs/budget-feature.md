# Budget Feature

## Overview

The Budget page (`/budget`) shows retrospective monthly cashflow and lets users
drill into spending by envelope, category, and transaction. It answers three
questions at a glance:

1. **Is this month positive or negative?** The top timeline shows net cashflow by month in the user's default currency.
2. **Which envelopes used the income?** Expense and income sections show current-month category totals.
3. **Where is the money going?** Expanding a category reveals children and transactions inline.

All budget analytics use paid transactions only. Transfers are excluded. Debt payments keep the finance analytics rule that only `interest_amount` contributes to expense analytics. The top timeline converts every transaction with the historical rate for its transaction date. If any required rate is missing, that month is marked unavailable instead of publishing a partial cross-currency total.

## Page Layout

The page owns one vertical scroll container. The timeline and month navigation
lead into flat expense and income row sections; expanding a category reveals
its children and transactions inline.

```
+--------------------------------------+
|  Budget header + category management |
+--------------------------------------+
|  BudgetBarChart + month navigation   |
+--------------------------------------+
|  EXPENSES                            |
|   category row                       |
|   expanded children + transactions   |
+--------------------------------------+
|  INCOME                              |
|   category row                       |
+--------------------------------------+
```

The page does not use `PageContainer` or a full-page `Surface`. Content renders directly on `bg-background`, matching the Balance page pattern.

## Components

### `BudgetView`

Location: `features/budget/components/budget-view.tsx`

Top-level view. Owns selected month, expanded category state, and the category
management workspace. It renders the monthly timeline, month navigation, and
the expense and income row sections.

### `BudgetBarChart`

Location: `features/budget/components/budget-bar-chart.tsx`

A 13-month interactive timeline in `preferences.default_currency`. Every
operation is converted with the historical rate for its transaction date.
Positive months extend upward with a neutral chart color; negative months
extend downward with the destructive token. A month with any missing required
rate is rendered unavailable instead of showing a partial total.

Hover opens a `Tooltip` with converted income, expenses, and net cashflow.

### Category rows

Categories use the same flat row language as Balance. Each row exposes the
converted current-month total in the default currency and expands inline.
There are no tile grids or nested independent scroll regions.

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
  -> buildConvertedBudgetMonths(transactions, defaultCurrency, exchangeRates)
  -> converted monthly timeline
  -> filter to selected month
  -> monthTransactions
  -> buildCategoryTree(categories, monthTransactions)
  -> manageable categories only
  -> categoryTree
  -> getConvertedCategoryTotal(...)
  -> split and sort by converted total
  -> expenseNodes / incomeNodes
  -> expanded children + TransactionList
```

`buildCategoryTree` powers the current-month rows. The pure Budget analytics
helper owns historical conversion and reports missing FX pairs. Original
transaction amounts remain visible in the expanded transaction rows.

## Storybook

Stories:

- `Pages/Budget` renders the full page, expanded rows, and the mobile category-management workspace.
- `Features/Budget/BudgetBarChart` covers default, previous-month, negative-month, and empty timeline states.

The full-page story wrapper uses `<div className="h-screen">` with no padding so the viewport-fitting layout renders correctly in Storybook.
