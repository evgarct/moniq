---
name: Design principles — moniq
description: Core visual and architectural design decisions for the moniq product. Reference when building new UI or modifying existing components.
type: reference
originSessionId: a724e347-5813-4f1e-81e3-b5b181fcbddb
---
# Design Principles

## Visual style memory

Moniq is a restrained product UI, not a marketing surface. It should feel like a calm financial workspace: warm neutral, dense enough for repeated use, and precise in alignment. The main scene is a person reviewing money, correcting imports, or entering transactions in a focused desktop or mobile workspace, so the design should reduce hesitation and keep financial structure easy to scan.

### Core visual rules

- Warm neutrals carry almost everything: `bg-background`, `bg-card`, `bg-secondary`, `bg-popover`, `border`, `foreground`, and `muted-foreground`.
- Use color as information, not decoration. Data visualization uses `chart-1` through `chart-5`; errors use `text-destructive`; income/positive moments may use the approved positive tone only when the domain says it is positive.
- Repeated data is row language. Rows are flat, quiet, and grouped inside a shared region. Do not make card-per-row layouts, category chips, account type pills, status pills, or icon badges.
- Icons are raw outline marks. Use Lucide or `CategoryIcon` inline at the established size and stroke, without colored circles, squares, badge backgrounds, or filled treatments.
- `Surface` is the only container primitive for major regions. Do not recreate surface radius, shadow, tone, or padding locally unless extending `Surface` itself.
- Surface elevation follows one physical model: `base` is `#e5e4df`, `raised` is `#f0f0eb`, and `floating` is `#fafaf7`. Higher layers are lighter and cast a tokenized shadow onto lower layers.
- Structural panel seams use elevation, never `border-left`, `border-right`, or divider borders. Borders remain valid for controls and semantic separators inside a region.
- Typography stays on the product scale. Use `type-h1` through `type-h6`, `type-body-14`, and `type-body-12`; avoid arbitrary text sizes in feature code.
- Radius and shadow stay tokenized. Use radius variables/classes and existing UI primitives; do not introduce new `rounded-*` or `shadow-*` styling for ordinary product UI.
- Actions stay restrained: one filled primary action per surface, outline for escape/cancel, ghost for row-level or low-emphasis actions.
- Forms are sheets when they collect structured data. Dialogs are for focused confirmations, not multi-field data entry.
- Motion is tactile and short. Use named transitions for actual state changes; avoid `transition-all`, decorative choreography, and page-load performance theater.
- Interaction feedback is immediate. Deterministic create, edit, delete, and state-change actions update local state in the same render cycle and persist in the background.
- Forms close after successful client validation and command dispatch, not after the network response. Failed persistence rolls back state and uses a localized toast.
- Loading states are reserved for operations whose result cannot be predicted locally, including file parsing/upload, authentication, and external integrations.

### Composition patterns to preserve

- New simple screens open with a `Surface tone="raised" padding="lg"` containing `SurfaceHeader`, `SurfaceEyebrow`, `SurfaceTitle`, and optional `SurfaceDescription`.
- Full-bleed workspace views such as Balance, Budget, and Calendar own the whole `main` area and should not be wrapped in an outer page card.
- On mobile, the system status and home-indicator safe areas use the base surface. The full-width raised workspace starts after a small top gap without side gutters.
- Inventory/detail screens use the two-panel grid: left inventory around 280px, right register/detail filling the remaining space.
- Lists and registers need an `EmptyState`; metadata is plain muted text near the primary label.
- Money must be rendered with `MoneyAmount` unless a shared-grid multi-amount layout is explicitly required.
- Stateful UI primitives need focused Storybook stories that open directly into the interaction state used for review.

### Anti-patterns I should reject

- Card-per-item finance lists, repeated bordered tiles, and nested card structures.
- Badge or pill metadata for categories, account types, statuses, or transaction kinds.
- Icon containers used as decoration.
- Bright blue, indigo, purple, emerald, or gradient accents as generic UI styling.
- Hardcoded unlocalized UI text in runtime components.
- Center modals for ordinary create/edit forms.
- One-off control styles when `components/ui`, shared form primitives, or `Surface` already cover the pattern.

## Design decision gate

Use this order for every new visual decision:

1. Reuse an existing product pattern from the UI Playbook or the Balance story.
2. Compose an existing `components/ui` or shared feature primitive.
3. Extend a design token or shared primitive when the need repeats.
4. Add feature-local styling only when the concept is genuinely unique and document why.

Ordinary product UI must use semantic color tokens and the Moniq radius scale. Raw palettes are reserved for explicitly documented data-visualization or committed workspace scenes such as the finance board; they are not a shortcut for controls, navigation, forms, or status treatment.

Interactive controls use at least a 44px target below `lg` and 40px at desktop widths. Icon-only controls require one accurate accessible name and a visible tooltip. Do not duplicate the label with an additional hidden tooltip node.

The mobile shell is the same product language at a smaller viewport. It uses warm opaque surfaces, semantic selected states, and tokenized borders/radii. Do not introduce glassmorphism, floating gradient decoration, or a separate mobile brand treatment.

Run `npm run check:design-system` before completing UI work. The guard scans runtime product code for copied warm-neutral hex values, generic Tailwind radii, and decorative glassmorphism.

## Money display

**Rule: currency symbol always after the number, with a small gap.**

The unified component is `MoneyAmount` in `components/money-amount.tsx`. Never create parallel money display components — extend this one.

### Layout
```
inline-grid grid-cols-[minmax(0,max-content)_2.25ch] items-baseline justify-end gap-[0.35em]
```
- Column 1 — number: `justify-self-end tabular-nums whitespace-nowrap tracking-[-0.025em]`
- Column 2 — currency symbol: `justify-self-center text-[0.8em] opacity-70`

### Font size
**Never hardcode a font size inside `MoneyAmount`.** The component inherits from its parent. Caller controls size via `className`:
```tsx
<MoneyAmount amount={4820} currency="EUR" className="text-2xl font-semibold" />
```

### Color / tone
- `tone="default"` → positive amount = `text-foreground`, negative = `text-destructive`
- `tone="positive"` → `text-emerald-600`
- `tone="negative"` → `text-destructive`
- `tone="muted"` → `text-muted-foreground`

Color is set on the **outer span**. Both number and currency symbol inherit it. Passing a text color in `className` overrides the tone (because `className` comes last in `cn()`). Example: `className="text-[#f4f8f7]"` makes both number and currency that color.

### Stacking two amounts with different sizes (e.g. FX transfer row)
**Never** stack two separate `MoneyAmount` elements — each has its own grid and the currency columns won't align. Instead put both rows in **one shared grid**:
```tsx
<span className="inline-grid grid-cols-[minmax(0,max-content)_2.25ch] items-baseline justify-end gap-x-[0.35em] gap-y-0.5">
  {/* Row 1 — primary, inherits parent font size */}
  <span className="justify-self-end tabular-nums ...">4 820,00</span>
  <span className="justify-self-center text-[0.8em] opacity-70">Kč</span>

  {/* Row 2 — secondary, smaller; sizes in em so ch column stays consistent */}
  <span className="justify-self-end tabular-nums text-[0.86em] text-muted-foreground ...">5 000,00</span>
  <span className="justify-self-center text-[0.69em] opacity-70 text-muted-foreground">€</span>
</span>
```
`text-[0.86em]` ≈ compact row size, `text-[0.69em]` = 0.8 × 0.86em (keeps the 80% ratio for the currency symbol). All sizes are relative to the same parent `em`, so `2.25ch` is identical for both rows.

---

## Border radius

Use design-system CSS variables, never hardcode Tailwind radius classes like `rounded-xl`:

| Token | Use |
|---|---|
| `rounded-[var(--radius-floating)]` | Popover/dropdown/context-menu container |
| `rounded-[var(--radius-control)]` | Menu items, buttons, inputs |
| `rounded-[var(--radius-sm)]` | Badges, small chips |

---

## Context menus (right-click)

**Use Base UI `Popover`, not `Menu`.** Menu closes when the pointer leaves the trigger; Popover stays open until explicitly dismissed.

Pattern:
```tsx
// State: null = closed, {x,y} = open at cursor
const [contextAnchor, setContextAnchor] = useState<{x: number; y: number} | null>(null);

// Invisible 1px div anchors the popover at the cursor position
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

Menu item and separator helpers live in the component file that needs them (not a shared file) and use `rounded-[var(--radius-control)]`.

---

## Transaction kinds — architecture

Each kind defines which accounts are involved and what data is required:

| Kind | Source account | Destination account | Category | Notes |
|---|---|---|---|---|
| `expense` | ✅ required | — | ✅ expense | |
| `income` | — | ✅ required | ✅ income | |
| `transfer` | ✅ required | ✅ required | — | may have `destination_amount` for FX |
| `save_to_goal` | ✅ required | ✅ required | — | destination is savings wallet |
| `spend_from_goal` | ✅ required | ✅ required | — | source is savings wallet |
| `debt_payment` | ✅ required | ✅ debt account | — | has `principal_amount`, `interest_amount` |
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

**Amount tone by kind:**
- Positive (green): `income`, `refund`, `save_to_goal`
- Default (foreground / neutral): everything else

---

## Import → transaction mapping

When a bank import is confirmed, fields map as follows:

| Transaction field | Source |
|---|---|
| `title` | Category name (if set), else `merchant_clean`, else `merchant_raw` |
| `note` | `merchant_clean` (the restaurant / store / taxi name) — expense & income only |
| `note` (transfer / debt_payment) | `null` — title already describes the transaction |
| `amount` | `Math.abs(import.amount)` |
| `status` | always `"paid"` |

**Never** set note to "Imported from CSV file (…)" or any file/source metadata — that information is useless to the user.

---

## Component architecture principles

- **One component per concept.** If a new variant is needed, add a prop — don't create a parallel component.
- **Size flows down, never up.** Components inherit font size from their parent. Never put `text-[14px]` inside a leaf display component — let callers decide via `className`.
- **Color on the outer span.** Set tone/color on the container; children inherit. `className` always comes last in `cn()` so callers can override tone.
- **Shared grids for aligned columns.** When two rows must share column widths, they must be children of the same CSS grid element.

---

## Storybook conventions

- Every new component variant gets a story.
- Add `AllKinds` / `AllTones` / `AllSizes` stories when the component has enumerable states.
- Story surface for full-page stories: `<div className="min-h-screen bg-[#f4efe9] p-6">` (warm off-white).
- Mobile stories: wrap in `max-w-[390px]` rounded phone shell with `shadow-[0_24px_80px_rgba(15,23,42,0.14)]`.
- Update stories **in the same commit** as the component change.
