# Budget Feature

## Overview

The Budget page (`/budget`) shows monthly cashflow across 13 rolling months and lets users drill into spending by category. It answers two questions at a glance:

1. **Is this month better or worse than the last?** — answered by the diverging bar chart at the top.
2. **Where is the money going?** — answered by the category grid below.

## Page Layout

The page is a **viewport-fitting, no-scroll-at-page-level** layout. The outer container is `h-full overflow-hidden`. Each section owns its own scroll independently:

```
┌──────────────────────────────────────┐
│  BudgetBarChart + month navigation   │  shrink-0, never scrolls
├──────────────────────────────────────┤
│  EXPENSES   (section total →)        │  flex-[3], overflow-y-auto
│   [tile] [tile] [tile] [tile] …      │
├──────────────────────────────────────┤
│  INCOME     (section total →)        │  flex-[2], overflow-y-auto
│   [tile] …                           │
└──────────────────────────────────────┘
```

When a category tile is selected, a **detail panel** opens to the right of the category panels on desktop (`lg:w-[340px]` left + `flex-1` right), also with its own internal scroll:

```
┌──────────────────┬───────────────────┐
│  chart + nav     (full width)        │
├──────────────────┬───────────────────┤
│  EXPENSES        │  Category name    │
│   [tile][tile]   │  ────────────     │
├──────────────────│  Subcategories    │
│  INCOME          │  ────────────     │
│   [tile]         │  Transactions     │
└──────────────────┴───────────────────┘
```

**Important:** the page does NOT use `PageContainer` or `Surface` as a full-page wrapper. Content renders directly on `bg-background`, matching the Balance page pattern. `Surface` is only for floating or inset panels — never for the page itself.

## Components

### `BudgetView`

Location: `features/budget/components/budget-view.tsx`

Top-level view. Owns month state, selected-category state, and all data derivation (filtering transactions to the current month, building the category tree, computing subcategory totals). Renders the chart, grid sections, and detail panel.

### `BudgetBarChart`

Location: `features/budget/components/budget-bar-chart.tsx`

A 13-month **diverging bar chart** showing net cashflow (income − expenses) per month. The zero line sits at the vertical midpoint; positive months extend upward in foreground color, negative months extend downward in destructive color. The current month is filled solid; past months use reduced opacity.

**Implementation notes:**
- The SVG uses `preserveAspectRatio="none"` so bars scale horizontally to fill any container width. This is safe because the SVG contains only `<rect>` elements — no text.
- Month labels live in a separate HTML `<div className="flex w-full">` below the SVG, not inside the SVG, to prevent text distortion.
- `CHART_H = 56` keeps the chart compact so labels sit close to the bars.
- Uses `type-body-12 leading-none` for labels (design-system typography, never arbitrary font sizes).

### `CategoryTile`

A grid cell button: centered icon (Lucide outline, `size-[18px]`) + `type-body-12` name + `type-body-12` amount. No border, no shadow. Selection state is `bg-secondary/60`; hover is `hover:bg-secondary/50`. Grid columns adapt when the detail panel is open (`grid-cols-3 lg:grid-cols-4`) vs. when it is closed (`grid-cols-4 sm:grid-cols-5 xl:grid-cols-6`).

### `SectionHeader`

Inline section label (ALL-CAPS 12px tracked) with the currency-split total for that section right-aligned. Totals are summed across all category nodes in the section, grouped by currency.

### `CategoryDetail`

Appears in the right panel when a tile is selected. Shows: category header row (icon + name + total), subcategory rows (flat, divided by `border-t border-border/40`), and a `<TransactionList>` for the category's settled transactions in the current month.

## Data Flow

```
useFinanceData()                   ← TanStack Query, fetches /api/finance/snapshot
  ↓
BudgetView
  ↓ filter to current month
  monthTransactions
  ↓ buildCategoryTree(categories, monthTransactions)
  categoryTree                     ← CategoryTreeNode[] with totals_by_currency
  ↓ split and sort by |total_amount|
  expenseNodes / incomeNodes
  ↓ getCategoryDescendantIds() for selected category
  selectedTransactions
```

`buildCategoryTree` aggregates transaction amounts into each category node and rolls up children into parents. Totals are split by currency — never mixed into a single number.

## Storybook

Stories: `stories/pages/budget-page.stories.tsx` → `Pages/Budget`

- `Default` — chart + grid, nothing selected
- `CategoryExpanded` — Core Bills selected, subcategory rows and transactions visible in the detail panel
- `CategoryCollapsed` — tile toggled off, panel closed

The story wrapper uses `<div className="h-screen">` (no padding) so the viewport-fitting layout renders correctly in the Storybook canvas. The `BudgetBarChart` component has its own isolated stories under `Features/Budget/BudgetBarChart`.
