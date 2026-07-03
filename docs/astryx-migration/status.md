# Astryx Migration Status

## Overview
- **Migration Started:** 2026-07-03
- **Primary Goal:** Transition from Tailwind/shadcn to the Astryx design system while preserving Moniq's unique warm neutral, borderless, cardless, and mobile-first design language.
- **Current Completion:** ~40% (Core setup, CSS layers, Storybook, global Theme integration, and key UI primitive wrappers: Button, Switch, Separator, Skeleton, Badge, Input, Textarea, Checkbox)

---

## Accomplished Phases

### Phase 1: Core Integration
1. **Dependency Installation:**
   - `@astryxdesign/core` (Design system components & primitives)
   - `@astryxdesign/theme-neutral` (Muted minimal default theme)
   - `@astryxdesign/cli` (CLI wizard, docs, and search tool)
2. **Coexistence CSS Setup:**
   - Modified `app/globals.css` with explicit layer declarations so Tailwind v4 utility classes and Astryx custom properties coexist.
3. **Storybook Configuration:**
   - Configured `.storybook/preview.tsx` to load Astryx stylesheets and wrapped all stories in the Astryx `<Theme>` provider.
4. **Setup Documentation:**
   - Created this dedicated documentation folder (`docs/astryx-migration/`) to record states, principles, and roadmap steps.
5. **Pilot Component Verification:**
   - Created `stories/astryx-demo.stories.tsx` to verify component compilation, styling override capabilities, and responsive mobile behavior in Storybook.

### Phase 2: Primitives Migration & Bug Resolution
1. **Button & Day Cell Rendering:**
   - Re-implemented `components/ui/button.tsx` using Astryx `Button` for all sizes (including `size="icon"`), resolving issues where text/numeric day children were broken when wrapped inside `IconButton`.
2. **Typography & Accessible Font Sizes:**
   - Remapped `--font-size-*` variables inside `:root` to preserve Moniq's original, accessible sizes (sm: 14px, base: 16px).
   - Mapped all sub-12px sizes (`4xs` to `xs`) to a minimum size of `12px` / `0.75rem` to guarantee accessibility and prevent layout text from becoming too small.
3. **Smart Button Layout Extraction (Global):**
   - Added automatic `icon` extraction in `Button` wrapper. If a button receives an icon child followed by text, it extracts the icon to the `icon` prop of `AstryxButton` to enforce side-by-side flex layout and prevent vertical text wrapping globally.
4. **Input Alignment & Layout Preservation:**
   - Refactored `components/ui/input.tsx` to render a styled native `<input>` element so layout classes (like `text-right` or custom padding/width) apply directly to the input field itself, fixing the amount input alignment.
5. **Global Theme & Color Scheme Resolution:**
   - Wrapped the application root in `<Theme theme={neutralTheme} mode="light">` inside `components/providers/app-providers.tsx`.
   - Statically declared `data-theme="light"` on the root `<html>` element in `app/layout.tsx`.
   - Forced `color-scheme: light` on `:root` in `app/globals.css` to prevent browser OS preference defaults from making light-dark() CSS variables resolve to white text inside portal dropdowns, sheets, and calendars.
6. **Transaction Sheet Layout & Sizing:**
   - Modified `TransactionFormSheet` in `features/transactions/components/transaction-form-sheet.tsx` to make the panel 100% full height on desktop, using high-specificity selector overrides (`data-[side=responsive]:sm:inset-y-0 data-[side=responsive]:sm:h-full data-[side=responsive]:sm:rounded-none`) to completely touch the window edges.
7. **Other Primitive Wrappers:**
   - Adapted `switch.tsx`, `separator.tsx`, `skeleton.tsx`, `badge.tsx`, and `textarea.tsx` using native Astryx components.
   - Re-implemented `components/ui/checkbox.tsx` using Astryx `CheckboxInput` to match Astryx aesthetics while maintaining the original checked/onChange contract.

---

## Next Steps
1. **Iterate on Overlay Components:** Assess and wrap Astryx Select / Dialog elements where they align with the current layout patterns.
2. **Continuous Visual Checks:** Run screenshots and devtools audits to guard against visual degradation.

