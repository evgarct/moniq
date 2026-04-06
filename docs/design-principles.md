# Moniq Design Principles

This document defines the product-level UI principles for Moniq. It sits above individual tokens and components. If a screen can satisfy a local component rule but still violates the product feeling, these principles win.

## Product Position

Moniq should feel like a personal finance desktop workspace:

- calm instead of loud
- tool-like instead of promotional
- structured instead of card-stacked
- confident instead of decorative

The closest external visual reference is Claude. That does not mean cloning Claude screen-by-screen. It means borrowing the same discipline:

- warm neutral canvases
- compact, intelligent chrome
- typographic clarity
- deliberate restraint

## Core Principles

### 1. Workspace Over Website

Every primary screen should read like a working surface, not a marketing page or a generic web dashboard.

- Prefer one dominant canvas with rails and split work areas.
- Avoid isolated card piles that make the product feel fragmented.
- Treat the left navigation and global add/menu layer as structural product furniture.

### 2. Calm Is The Default

Finance products already carry cognitive load. The UI should reduce it.

- The base state should rely on neutrals, not accent color.
- Visual weight comes from spacing, type, and grouping before color.
- Strong contrast should be saved for actions, selection, and financial state.

### 3. Desktop Precision

Moniq should feel closer to a native desktop finance tool than a generic responsive CRUD app.

- Floating panels should feel like precise tools.
- Menus should open quickly and close cleanly.
- Dense information is acceptable if alignment and rhythm remain disciplined.
- Rows and panels should support scanning before embellishment.

### 3a. Spacing Uses A Real Grid

Moniq should not drift into arbitrary spacing.

- Primary layout spacing uses an 8px grid.
- Compact internal rhythm may use 4px steps.
- Avoid ad-hoc values like 6px, 10px, 14px, or 1px-driven layout rhythm unless the value is solving a real alignment bug.
- When tightening a component, reduce spacing by one grid step, not by random nudges.

### 4. One Canonical Shell

The shell is not negotiable per page.

Canonical references:

1. Global add/menu behavior
2. Balance workspace layout
3. Sidebar navigation language

New pages should inherit this shell language rather than inventing their own chrome.

### 5. Reuse Before Reinvention

If a screen needs a row, a panel, a floating editor, or a summary unit, start from the existing product pattern.

- Product patterns belong in reusable components.
- Route files should assemble, not invent.
- A page-specific custom layout needs explicit justification.

### 6. Storybook Is A Design Tool

Storybook is not documentation after implementation. It is the living review surface for UI work.

- Every canonical screen should exist in Storybook.
- Every reusable pattern should exist one level below the page that uses it.
- Foundations should show the design system visually, not only in text docs.

## Canonical Screen Behaviors

### Balance

Balance is the anchor workspace.

- left navigation remains stable
- account grouping reads as structured finance inventory
- transaction activity remains secondary to balance structure
- the page should feel calm and deliberate, not busy

Balance is also the canonical reference for list density, account grouping, and account-state behavior across the app.

- The left panel is an inventory surface, not a dashboard card stack.
- The right panel is a ledger surface, not a second dashboard or a loose stack of stat cards.
- Header controls stay compact, icon-led, and typographically aligned with the page title.
- Icons inside content surfaces should stay quiet and inline. Do not wrap them in pills, chips, bordered badges, or decorative containers unless the pattern is explicitly canonical for that surface.
- Group spacing must be larger than item spacing so sections read before rows.
- Account rows stay quiet: no heavy borders, no decorative chips, and no duplicated metadata.
- Savings subgroups behave like lightweight ledger children, not like nested cards.
- Credit cards may extend the base row with one thin utilization track, but the base account-row pattern still wins.
- The register header stays minimal: just the current scope title and, when needed, one quiet clear-selection action.
- The transaction ledger itself should feel denser and more operational than the inventory panel beside it.
- On mobile, the account panel remains the primary screen and transaction activity opens as a full-screen follow-up surface.
- On mobile, ledger typography and spacing step down one level before scroll is accepted as necessary.

### Today

Today should operate as a planning and execution surface.

- calendar context and agenda should feel like one workspace
- day-level and month-level planned/overdue scope must remain understandable at a glance
- quick actions should appear as floating tooling, not page jumps

### Transaction Entry

Transaction entry is a productivity surface.

- entry should feel compact and precise
- floating panels beat full-page forms
- field order must reflect user intent, not database structure
- repeated entry for one transaction type should stay inside one working flow

## Anti-Patterns

Do not introduce these patterns unless the user explicitly asks for a different direction:

- bright SaaS gradients across core finance screens
- excessive colored badges and pills
- card-per-metric dashboard mosaics
- oversized empty whitespace that weakens scanability
- modal forms that feel like website overlays instead of product tools
- custom one-off controls when existing `components/ui` or product patterns already fit

## Review Checklist

Before closing a UI task, answer yes to all of these:

1. Does the screen still belong to the same product as Balance and the sidebar?
2. Does the layout read as a workspace with a clear dominant flow?
3. Are actions, state, and hierarchy expressed mostly through type, spacing, and surfaces?
4. Is the pattern represented in Storybook at the right level?
5. Did we reuse a product pattern where one already existed?
6. If the change touched Balance, does it still match the canonical Balance panel contract in Storybook and the design-system spec?
