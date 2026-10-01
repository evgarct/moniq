# Budget Feature

## Overview

The Budget page (`/budget`) answers one question: **where am I against my plan this month?**
Each top-level expense category is an *envelope* with an optional monthly plan. The screen shows, for the
selected month and in the user's default currency:

1. **The month at a glance** — planned, spent and left across the envelopes that have a plan, the month's income, and what was spent without a plan.
2. **Every envelope as one flat row** — what is left (or by how much it is over), a thin plan track and "spent of planned".
3. **Detail one tap away** — plan (editable), spend, left, subcategories and the transactions.

A compact strip of the last 13 months (net cashflow) sits above the summary for context and month selection.

All budget analytics use paid transactions only. Transfers are excluded. Debt payments keep the finance analytics rule that only `interest_amount` contributes to expense analytics. Spend is converted with the historical rate for each transaction date; if any required rate is missing the envelope (and the summary) shows "—" instead of a partial cross-currency total.

## Planned budgets

A plan is one number in `preferences.default_currency`, stored as a `[budget: N]` prefix of the category description. Plans exist only on **top-level expense categories** (the same rule the MCP tools enforce); the category form hides the field elsewhere. Per envelope: `left = planned - spent`, `percentUsed = spent / planned`, status `ok`, `near` (>= 85%), `over` (spent > planned), `unplanned` (no plan) or `unavailable` (missing FX rate). Rows are sorted over-budget first (most over first), then closest to plan, then unplanned by spend, then unavailable.

## Page Layout

Mobile (below 1024px, one layout for every width) is a single list; desktop keeps the two-panel layout.

```
+--------------------------------------+
|  Budget header + category management |
+--------------------------------------+
|  Compact 13-month strip + month nav  |
+--------------------------------------+
|  Planned | Spent | Left   (+ track)   |
|  Income            No plan            |
+--------------------------------------+
|  EXPENSES                            |
|   Enjoy Life        over 13 153 Kč   |
|   ───────────────── 13 253 of 100    |
|   Core Bills        left  3 000 Kč   |
|   ...                                |
|   Wealth            spent 15 000 Kč  |
|   No plan                            |
+--------------------------------------+
|  INCOME                              |
|   Income            received ...     |
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

`buildEnvelopeBudgetRows` (per envelope: planned, converted spent incl. subcategories, left, percent, status), `summarizeEnvelopeBudget` (planned, spent of planned envelopes, unplanned, left; unavailable when any rate is missing) and `sumEnvelopeSpend` (converted income). Never merges currencies without a rate.

### `EnvelopeRow`, `BudgetSummary`, `EnvelopeDetail`

`envelope-row.tsx` is the flat row (name, left/over, `ProgressTrack`, "spent of planned"; unplanned rows show spent). `budget-summary.tsx` is the month figures. `envelope-detail.tsx` is the detail (plan input, spend, left, subcategory rows with share-of-envelope tracks, collapsed transactions) used both in the desktop panel and the mobile sheet.

### `BudgetBarChart`

Location: `features/budget/components/budget-bar-chart.tsx`

A 13-month interactive timeline in `preferences.default_currency`; `compact` renders the slim strip used on the Budget screen. Positive months extend upward with a neutral chart color; negative months extend downward with the destructive token. A month with any missing required rate is rendered unavailable. Hover opens a `Tooltip` with converted income, expenses and net; selecting a month opens the month analysis sheet (the report is built on click).

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

- `Pages/Budget` covers the default list, over-budget ordering, the desktop panel (expanded and collapsed), the mobile fullscreen detail (closed again and left open), mobile category management and inline category editing. The mock categories carry plans (Core Bills 33 200, Living Costs 10 000, Enjoy Life 100) so planned, over-budget and no-plan rows all render.
- `Features/Budget/BudgetBarChart` covers default, compact, previous-month, negative-month and empty timeline states.

The full-page story wrapper uses `<div className="h-screen">` with no padding so the viewport-fitting layout renders correctly in Storybook.
