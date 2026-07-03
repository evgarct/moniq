# Astryx Migration Conventions

When migrating UI components to Astryx, we **MUST** strictly preserve Moniq's design language and visual guidelines.

---

## Core Visual Thesis

1. **No Cards. No Chips. Ever.**
   - Do **NOT** wrap individual list items, transactions, or category details in bordered or shadowed card containers (even using Astryx `Card` component).
   - Show items as flat rows inside a shared workspace `Surface` or `Layout` section.
   - Do **NOT** render metadata (such as category names, account types, or status indicators) as filled pills, rounded badges, or chip components. Display them as plain `type-body-12` (muted) text next to or below the primary label.
2. **No Icon Badges:**
   - Do **NOT** wrap icons in colored circles, squares, or rounded containers.
   - Render outline-only icons directly with the Lucide component or `CategoryIcon` at `h-[18px] w-[18px]` with `strokeWidth={1.75}` and `text-muted-foreground`.
3. **Warm Neutrals:**
   - Warm neutral custom tokens (`bg-background` #fafaf7, `bg-card` #f0f0eb, `bg-secondary` #e5e4df) carry the entire interface. Avoid bright brand colors or cold whites.

---

## Astryx Component Mapping Guidelines

- **Layout Structure:**
  - Leverage Astryx layout primitives (`AppShell`, `TopNav`, `SideNav`, `VStack`, `HStack`, `Grid`) to handle structure, spacing, and rhythm, avoiding arbitrary Tailwind margin/padding.
- **Surface Containment:**
  - Wrap content surfaces in the Astryx component matching the intended level (`canvas` for background, `panel` for default content, `floating` for popovers, sheets, and menus).
- **Typography:**
  - Keep display headings serif, sparse, and only where visual anchor is needed. Use sans-serif (`Inter`) for routine labels.
  - Numbers and currency amounts use tabular numerals (e.g. `tabular-nums`).
- **Interactive States:**
  - Hovers on list items and navigation rails should use background-color shifts (`hover:bg-secondary/50`) rather than border adjustments or filled accents.
- **Accessibility and Forms:**
  - Use Astryx form elements (`TextInput`, `TextArea`, `Switch`, `CheckboxInput`) with direct status props for error validation instead of injecting ad-hoc red border classes.
  - Wrap icon-only buttons with tooltips and specify descriptive `aria-label` properties.

---

## Mobile Viewport Rules

- Moniq utilizes a unified mobile layout for all viewports below `1024px`.
- Page container wrappers must adapt to mobile height restrictions (viewport-fitting).
- Hide secondary panels (like the transaction ledger register) by default on narrow screens, and focus on the main list. Utilize full-screen pages with back actions for detail/register views.
