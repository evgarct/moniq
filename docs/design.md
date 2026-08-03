---
name: Design principles — moniq
description: Single canonical design reference for moniq — product position, tokens, components, screen contracts, and Storybook discipline. Read this before building or modifying any UI.
type: reference
originSessionId: a724e347-5813-4f1e-81e3-b5b181fcbddb
---

# Design — moniq

This is the **single canonical design document** for moniq. It replaces `design-principles.md`, `design-language.md`, `design-system-spec.md`, `storybook.md`, and `ui-guidelines.md`, which previously duplicated and in places contradicted each other and the rules baked into `AGENTS.md` and `stories/foundations/design-language.stories.tsx`. Those files now only point back here.

## Source of truth, in order

1. This document (`docs/design.md`).
2. Global tokens in `app/globals.css`.
3. Reusable components in `components/` and `components/ui/`.
4. Storybook stories as the visual review layer (`stories/foundations/` for tokens/patterns, `stories/pages/` for realistic full-page states).

If a lower layer conflicts with this document, fix the lower layer — not the other way around.

## Product position

Moniq is a personal finance workspace for managing accounts, transactions, budgets, cashflow, goals, and imports. It should feel like a calm financial workspace — warm neutral, dense enough for repeated use, precise in alignment — not a marketing site or a generic SaaS dashboard.

- Calm instead of loud
- Tool-like instead of promotional
- Structured instead of card-stacked
- Confident instead of decorative

The closest external visual reference is Claude — not to clone it screen-by-screen, but to borrow its discipline: warm neutral canvases, compact intelligent chrome, typographic clarity, deliberate restraint.

**Anti-references**: generic fintech dashboards (navy/gold/neon/crypto-glow), SaaS card grids, badge-heavy metadata, icon-in-circle rows, gradients, glassmorphism, oversized hero metrics, decorative motion.

## No cards. No chips. Ever.

This is the single most important visual rule in Moniq. It applies to every page without exception — including settings, inbox, and admin-style screens. There is no "this is a settings page so cards are fine" exemption.

- **No card-per-item layout.** Transactions, accounts, categories, and other repeated data units live as flat rows inside a shared `Surface`, never as individually bordered/shadowed cards. A card is for a major content region, not a repeating data unit.
- **No chips or pills for metadata.** Category names, account types, statuses, and tags render as plain `type-body-12` muted text next to or below the primary label — never as `<Badge>`, pill, or rounded-chip elements. If a status needs visual distinction, use color on the text only.
- **No icon badges.** All icons (account type, category, status) are raw inline outline marks via `CategoryIcon` or Lucide, at the established size/stroke. Never wrap an icon in a colored circle, square, or filled container.

Wrong: every transaction row is its own rounded card with border and shadow. Wrong: category shown as a colored pill. Wrong: account type shown as a filled "CASH" pill.
Right: a flat row with icon + label + muted sub-text + right-aligned amount. Right: category shown as plain muted text below the transaction title.

## Core visual rules

- Warm neutrals carry almost everything: `bg-background`, `bg-card`, `bg-secondary`, `bg-popover`, `border`, `foreground`, `muted-foreground`.
- Use color as information, not decoration. Data visualization uses `chart-1`–`chart-5`; errors use `text-destructive`; positive/income moments may use the approved positive tone only when the domain says it is positive.
- `Surface` is the only container primitive for major regions. Do not recreate surface radius, shadow, tone, or padding locally unless extending `Surface` itself.
- Typography stays on the product scale: `type-h1`–`type-h6`, `type-body-14`, `type-body-12`. Avoid arbitrary text sizes like `text-[15px]`.
- Radius and shadow stay tokenized (see Radius below). Only `Surface` introduces shadow.
- Actions stay restrained: one filled primary action per surface, outline for escape/cancel, ghost for row-level or low-emphasis actions.
- Forms are sheets when they collect structured data. Dialogs are for focused confirmations, not multi-field data entry.
- Motion is tactile and short. Use named transitions for real state changes; avoid `transition-all`, decorative choreography, or page-load performance theater.
- Interaction feedback is immediate: deterministic create/edit/delete/state-change actions update local state in the same render cycle and persist in the background (see Optimistic mutations below).
- Loading states are reserved for operations whose result cannot be predicted locally: file parsing/upload, authentication, external integrations.

## Tokens

### Color

Defined in `app/globals.css`. Primary light-theme palette:

- `--background: #fafaf7`
- `--foreground: #191919`
- `--card: #f0f0eb`
- `--secondary: #e5e4df`
- `--accent: #ebd8bc`
- `--muted-foreground: #666663`
- `--border: #bfbfba`
- `--destructive: #bf5d43`

Sidebar palette: `--sidebar: #191919`, `--sidebar-foreground: #fafaf7`, `--sidebar-accent: #262625`, `--sidebar-border: #40403e`.

Rules: neutrals carry the majority of the UI; accent is sparing and never becomes the primary identity color; destructive is only for destructive meaning; financial-state colors stay semantically scoped, never reused as decoration. Never use bright Tailwind semantic colors (`bg-blue-*`, `bg-indigo-*`, `emerald`, `purple`) as generic UI accents.

### Typography

Fonts: sans = Inter, heading serif = PT Serif, mono = JetBrains Mono. Utility classes (`app/globals.css`): `type-h1`–`type-h6`, `type-body-14`, `type-body-12`.

- Serif is for display anchors, not routine labels.
- Most application chrome uses sans.
- Body copy is short and supportive.
- Mono is selective — only where numeric alignment benefits.

### Radius

Base `--radius: 0.95rem`. Semantic scale — **always use these, never `rounded-xl`/`rounded-2xl`/arbitrary `rounded-[Xpx]`**:

| Token | Use |
|---|---|
| `--radius-tight` (0.25rem) | Tiny internal elements — never primary cards |
| `--radius-control` (0.375rem) | Buttons, inputs, menu items — default for interactive controls |
| `--radius-surface` (0.5rem) | Cards, rows, primary workspace blocks |
| `--radius-floating` (0.75rem) | Popovers, sheets, floating overlays |

Avoid round/pill-shaped controls unless the component's meaning explicitly requires it.

### Spacing

8px is the default system step for layout, section rhythm, and component padding. 4px is the compact step for dense internal spacing (rows, labels, tight groupings). Prefer values resolving to 4px/8px multiples; avoid ad-hoc values like 6px, 10px, 14px unless solving a real alignment bug. When tightening a component, reduce by one grid step, not a random nudge.

## Surface model

Three levels, implemented in `components/surface.tsx`:

1. **Canvas** — overall workspace background; warm, quiet, low-contrast.
2. **Panel** — primary working areas inside a screen; slightly brighter than canvas, large radius, subtle inset light. Default tone.
3. **Floating** — menus, sheets, popovers, quick-add surfaces; higher contrast, clearer edge, stronger shadow, tighter padding.

Do not invent a fourth ad-hoc surface when one of these fits. Each new finance workspace should clearly identify which level it uses.

## Building a new screen

1. Wrap content in the inner content area — no new shell wrappers.
2. Simple screens open with `Surface tone="panel" padding="lg"` containing `SurfaceHeader` → `SurfaceEyebrow` (ALL-CAPS 12px tracked) + `SurfaceTitle` (`type-h2`) + optional `SurfaceDescription` (`type-body-14`).
3. Full-bleed workspace views (Balance, Budget, Calendar) own the whole `main` area and must **not** be wrapped in an outer page card — render directly on `bg-background`, matching `AccountsView`. Pages with a full-height internal-scroll layout must not use `PageContainer` either — render the view directly from `page.tsx` so it controls its own padding/`h-full`.
4. Use `gap-6`/`gap-8` between top-level `Surface` blocks, `gap-4`–`gap-5` inside a `Surface`, `gap-1`–`gap-3` between rows.
5. Inventory/detail screens use the two-panel grid: `grid-cols-[280px_minmax(0,1fr)]` — left inventory, right register/detail.
6. Every list or register needs an `EmptyState`.

New pages inherit the canonical shell (global add/menu, Balance workspace layout, sidebar nav language) rather than inventing their own chrome. Reuse before reinvention: start from an existing row/panel/floating-editor/summary pattern; a page-specific custom layout needs explicit justification.

## Rows and lists

- Row hover: `hover:bg-secondary/50`. Never border-based hover states.
- Account/category icons: Lucide outline at `h-[18px] w-[18px]` (desktop) / `16px` (mobile), `strokeWidth={1.75}`, `text-muted-foreground`. Canonical balance-panel icons: `cash → BanknoteArrowDown`, `saving → PiggyBank`, `credit_card → CreditCard`, `debt → Landmark`.
- Amounts always use `MoneyAmount` with `tabular-nums`. Hero balances: `text-[32px] font-semibold`. Row amounts: `text-sm font-medium tabular-nums`.
- Don't use `display="absolute"` for balances/allocations that can go negative (e.g. `Free`) — show them signed so deficits are clear.
- Align subgoal rows with the parent row's grid columns so amounts stay vertically aligned.
- Don't repeat group context (type/currency label) inside a row if the group heading already provides it.
- For read-only key/value metadata in sheets/review panels, use `DetailField`/`DetailFieldGrid` — don't recreate rounded label/value blocks locally.

## Buttons and actions

- Primary: default `Button` (black fill), one per surface.
- Secondary: `Button variant="outline"` — escape/cancel only.
- Ghost: `Button variant="ghost"` — in-row or low-emphasis actions, including page-header icon buttons.
- Icon-only buttons require an accurate `aria-label` and a visible tooltip (don't duplicate the label with a redundant hidden tooltip node).
- Interactive controls: at least 44px target below `lg`, 40px at desktop widths.

## Colors for data

Use `chart-1` (#cc785c) through `chart-5` (#40403e) for data visualization. `text-destructive` for negative/expense amounts and error states. Never Tailwind semantic colors (blue/green/indigo) for income/expense or category highlights.

## Money display

**Rule: currency symbol always after the number, with a small gap.** The unified component is `MoneyAmount` in `components/money-amount.tsx` — never create a parallel money display component; extend this one.

### Layout

```
inline-grid grid-cols-[minmax(0,max-content)_2.25ch] items-baseline justify-end gap-[0.35em]
```
- Column 1 (number): `justify-self-end tabular-nums whitespace-nowrap tracking-[-0.025em]`
- Column 2 (currency symbol): `justify-self-center text-[0.8em] opacity-70`

### Font size

**Never hardcode a font size inside `MoneyAmount`.** It inherits from its parent; callers control size via `className`:
```tsx
<MoneyAmount amount={4820} currency="EUR" className="text-2xl font-semibold" />
```

### Color / tone

- `tone="default"` → positive = `text-foreground`, negative = `text-destructive`
- `tone="positive"` → `text-emerald-600`
- `tone="negative"` → `text-destructive`
- `tone="muted"` → `text-muted-foreground`

Color is set on the **outer span**; both number and symbol inherit it. A `className` text color overrides tone (it comes last in `cn()`).

### Stacking two amounts with different sizes (e.g. FX transfer row)

**Never** stack two separate `MoneyAmount` elements — their grids won't align. Put both rows in one shared grid instead:
```tsx
<span className="inline-grid grid-cols-[minmax(0,max-content)_2.25ch] items-baseline justify-end gap-x-[0.35em] gap-y-0.5">
  <span className="justify-self-end tabular-nums ...">4 820,00</span>
  <span className="justify-self-center text-[0.8em] opacity-70">Kč</span>
  <span className="justify-self-end tabular-nums text-[0.86em] text-muted-foreground ...">5 000,00</span>
  <span className="justify-self-center text-[0.69em] opacity-70 text-muted-foreground">€</span>
</span>
```
`text-[0.86em]` ≈ compact row size; `text-[0.69em]` = 0.8 × 0.86em (keeps the 80% symbol ratio). All sizes are relative to the same parent `em`, so `2.25ch` stays identical across rows.

## Context menus (right-click)

**Use Base UI `Popover`, not `Menu`.** `Menu` closes when the pointer leaves the trigger; `Popover` stays open until explicitly dismissed.

```tsx
// State: null = closed, {x,y} = open at cursor
const [contextAnchor, setContextAnchor] = useState<{x: number; y: number} | null>(null);

<PopoverPrimitive.Root open={contextAnchor !== null} onOpenChange={(open) => { if (!open) setContextAnchor(null); }}>
  <PopoverPrimitive.Trigger render={
    <div className="pointer-events-none fixed h-px w-px"
         style={contextAnchor ? { left: contextAnchor.x, top: contextAnchor.y } : { left: -9999, top: -9999 }} />
  } />
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Positioner className="isolate z-50" align="start" side="bottom" sideOffset={0}>
      <PopoverPrimitive.Popup className="... rounded-[var(--radius-floating)] ...">
        {/* ContextMenuItems */}
      </PopoverPrimitive.Popup>
    </PopoverPrimitive.Positioner>
  </PopoverPrimitive.Portal>
</PopoverPrimitive.Root>
```

Menu item/separator helpers live in the component file that needs them (not a shared file) and use `rounded-[var(--radius-control)]`.

## Transaction kinds — architecture

| Kind | Source account | Destination account | Category | Notes |
|---|---|---|---|---|
| `expense` | ✅ required | — | ✅ expense | |
| `income` | — | ✅ required | ✅ income | |
| `transfer` | ✅ required | ✅ required | optional, expense-type only | category allowed only when `allocation_id` is set (transfer into a savings goal); may have `destination_amount` for FX |
| `save_to_goal` | ✅ required | ✅ required | — | destination is savings wallet |
| `spend_from_goal` | ✅ required | ✅ required | — | source is savings wallet |
| `debt_payment` | ✅ required | ✅ debt or credit card account | — | has `principal_amount`, `interest_amount` |
| `investment` | ✅ required | — | ✅ expense | money leaves; no special wallet tracked |
| `refund` | — | ✅ required | ✅ expense | money enters; uses expense categories |
| `adjustment` | conditional | conditional | — | user enters real balance; app computes diff |

**Adjustment logic:**
```ts
diff = targetBalance - account.balance
if (diff < 0)  → source_account_id = account.id  (money leaves)
if (diff > 0)  → destination_account_id = account.id  (money enters)
amount = Math.abs(diff)
```

**Amount tone by kind:** positive (green) for `income`, `refund`, `save_to_goal`; default (neutral) for everything else.

## Import → transaction mapping

| Transaction field | Source |
|---|---|
| `title` | Category name (if set), else `merchant_clean`, else `merchant_raw` |
| `note` | `merchant_clean` — expense & income only |
| `note` (transfer / debt_payment) | `null` — title already describes the transaction |
| `amount` | `Math.abs(import.amount)` |
| `status` | always `"paid"` |

**Never** set note to "Imported from CSV file (…)" or other file/source metadata — it's useless to the user.

## Component architecture principles

- **One component per concept.** A new variant is a prop, not a parallel component.
- **Size flows down, never up.** Components inherit font size from their parent; never hardcode `text-[14px]` inside a leaf display component.
- **Color on the outer span.** Set tone/color on the container; children inherit; `className` comes last in `cn()` so callers can override.
- **Shared grids for aligned columns.** Rows that must share column widths must be children of the same CSS grid element.

## Component system (expected Storybook coverage)

- **Atoms**: typography scale, surface tokens, money amount formatting, badges, empty-state primitives, `components/ui` inputs/buttons/switches/selects.
- **Molecules**: transaction row, account card, account type badge, allocation item.
- **Organisms**: app sidebar, transaction list, account list, transaction row actions, transaction form sheet, account form sheet.
- **Templates**: workspace shell, balance view, other reusable assembled work areas as they stabilize.
- **Pages**: Balance, Today, Calendar, Dashboard, and any route-level transaction-entry panel states.

Storybook top-level order: Foundations → Atoms → Molecules → Organisms → Templates → Pages. When a page changes a reusable pattern, update the lower-level story in the same task. Foundations stay visual and reviewable, not only textual.

## Interaction patterns

### Floating panels

Used for quick add, transaction entry, contextual edits, compact review actions. Compact header row, tight field rhythm, minimal explanatory copy, immediate desktop-like action placement.

### Lists and rows

Optimize scanability first: aggressively align labels and numeric values, avoid decorative container nesting, keep state indicators from competing with the amount, use the 8px/4px grid for density (not one-off vertical nudges).

### Navigation

Sidebar stays visually quieter than main content. Active state is obvious but restrained. Icons support recognition, not visual noise. Account/transaction icons in content surfaces stay inline — no bordered/filled containers unless the screen contract explicitly requires it.

## Canonical screen contracts

### Balance panel (inventory — left panel)

- Header: page title is `h1`; adjacent info control is icon-only, vertically aligned to the title line; header actions are compact icon controls matching account-selection visual language; the desktop sidebar profile trigger matches primary nav items' size/weight/radius/tooltip language.
- Group rhythm: section spacing > item spacing; account groups use heading-first hierarchy; empty groups still render in edit/add mode so insertion points stay predictable.
- Account rows: the default inventory primitive; no borders as the main state language; hover/selected states are neutral background shifts, not accent fills; amount+currency stay tightly aligned as one unit; drop duplicate account-type subtitles when the group heading already explains type.
- Savings subgroups: not nested cards; no filled hover/selected background; progress track starts on the same vertical axis as the subgroup label. The automatic-withdrawal goal uses a quiet localized `Default` text label beside its name, never a badge or chip.
- Credit card rows: inherit the base account-row layout first; one thin utilization track may be added below (full = credit limit, filled = available room); debt shown once in the top row, never duplicated below the track; minimal supporting copy under the track.
- Mobile: Balance defaults to the account inventory view; transaction activity is hidden by default; tapping an account/subgroup opens a full-screen follow-up surface with a back action; never render the desktop split-view register permanently on mobile. Mobile typography/density steps down one level before scroll is accepted, and date labels in grouped lists stay quiet/compact; mobile rows prioritize title, kind/context, then amount.

### Balance register (ledger — right panel)

- It's a ledger surface, not a mirrored second dashboard. Top section: selected balance-space title first, optional reset action second — no explanatory eyebrow/meta copy/summary cards by default.
- Header hands off directly into the transaction list; the list is denser than the inventory panel and optimized for scan speed; rows inherit the product row language, avoiding accent-heavy states; empty states explain current scope in plain language; grouped lists use one date label per day, rows rely on spacing rhythm not divider borders.

### Today

Planning/execution surface: calendar context and agenda feel like one workspace; day- and month-level planned/overdue scope stays understandable at a glance; quick actions are floating tooling, not page jumps.

### Transaction entry

Productivity surface: compact and precise; floating panels beat full-page forms; field order reflects user intent, not database structure; repeated entry for one transaction type stays inside one working flow.

## Anti-patterns

Do not introduce these unless the user explicitly asks for a different direction:

- Card-per-item finance lists, repeated bordered tiles, nested card structures, card-per-metric dashboard mosaics.
- Badge or pill metadata for categories, account types, statuses, or transaction kinds.
- Icon containers used as decoration.
- Bright blue, indigo, purple, emerald, or gradient accents as generic UI styling; bright SaaS gradients on core finance screens.
- Hardcoded unlocalized UI text in runtime components.
- Center modals for ordinary create/edit forms; modal forms that feel like website overlays instead of product tools.
- One-off control styles when `components/ui`, shared form primitives, or `Surface` already cover the pattern.
- Oversized empty whitespace that weakens scanability.

## Design decision gate

Use this order for every new visual decision:

1. Reuse an existing product pattern from the UI Playbook or the Balance story.
2. Compose an existing `components/ui` or shared feature primitive.
3. Extend a design token or shared primitive when the need repeats.
4. Add feature-local styling only when the concept is genuinely unique, and document why.

Ordinary product UI must use semantic color tokens and the Moniq radius scale. Raw palettes are reserved for explicitly documented data-visualization or committed workspace scenes (e.g. the finance board) — not a shortcut for controls, navigation, forms, or status treatment.

Run `npm run check:design-system` before completing UI work. The guard scans runtime product code for copied warm-neutral hex values, generic Tailwind radii, and decorative glassmorphism.

The mobile shell is the same product language at a smaller viewport: warm opaque surfaces, semantic selected states, tokenized borders/radii. No glassmorphism, no floating gradient decoration, no separate mobile brand treatment. This repo intentionally uses one mobile layout for every viewport below `1024px` (`sm`/`md` are normalized to `lg`) — don't introduce intermediate tablet variants without an explicit product decision.

## Optimistic mutations

Deterministic, reversible mutations are optimistic by default. After client validation, close the form and update state immediately; persistence continues in the background. A background failure rolls back the optimistic result and shows a localized toast — don't reopen the form automatically. Block the interface only when the client cannot predict the result: file parsing/upload, authentication, external integration responses.

## Storybook discipline

Storybook is not documentation after implementation — it's the living review surface for UI work, and all visual/UI development is Storybook-first. Direct editing of live app UI without a story is prohibited.

- **Story for every state**: every new screen, stateful component, panel, and edge case (pending, offline, error, empty) gets a story in `stories/pages/` or `features/**/components/`.
- **CI enforcement**: `npm run check:storybook-first` blocks PRs with runtime UI changes and no story edits, unless waived in `.storybook/non-visual-change.md`.
- **Foundations stay visual**: `stories/foundations/` (`DesignLanguage`, `UIPlaybook`, `Typography`, `RadiusSystem`, `VisualTokens`, `BalancePanelPatterns`) render the design system visually — they are reference-only; fix the component, not the foundation story, when a UI bug surfaces.
- **Isolated interaction stories**: when iterating on stateful primitives (date pickers, popovers, calendars, dropdowns, sheets), maintain a focused story that opens directly into the interaction state under review.
- **Offline/sync mocking**: stories use isolated mock data and cover offline/local-first-sync/storage-failure/expired-auth states without hitting Supabase or PowerSync.
- **Accessibility**: Storybook runs `axe-core` via Vitest on every story (`a11y: { test: "error" }` in `.storybook/preview.tsx`) — a violation fails the test run. Don't sign off a component that introduces one.
- **Portal-backed content**: `play` functions must target the portalled surface (Sheet/Dialog/Popover/DropdownMenu) explicitly, never query only the root canvas.
- Update stories **in the same commit** as the component change.

Commands: `npm run storybook` (dev, port 6008 unless occupied — read the actual port from startup output), `npm run build-storybook`, `npm run test-storybook`, `npm run preview:live` / `preview:refresh`.

## Definition of done for UI work

A UI task is not done until:

1. The product-level principle (this document) still holds.
2. The reusable component layer reflects the change.
3. Storybook includes the changed state at the correct level.
4. Local verification passes for the affected build surface.
5. If Balance inventory patterns changed, the canonical Balance panel Storybook reference and this document's contract were updated in the same task.

## Review checklist

Before closing a UI task, answer yes to all of these:

1. Does the screen still belong to the same product as Balance and the sidebar?
2. Does the layout read as a workspace with a clear dominant flow?
3. Are actions, state, and hierarchy expressed mostly through type, spacing, and surfaces?
4. Is the pattern represented in Storybook at the right level?
5. Did we reuse a product pattern where one already existed?
6. If the change touched Balance, does it still match the canonical Balance panel contract above?

## Current system gaps

Living list — update as gaps close:

1. Foundations need broader visual coverage for typography and token review.
2. Storybook still needs more canonical finance page states, especially transaction-heavy flows.
3. Floating transaction entry needs a stricter pass to fully match the target desktop-tool feeling.
4. Some older stories still describe screens in generic terms instead of product terms.
