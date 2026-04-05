# Moniq Design System Spec

This document translates the product design principles into concrete system rules for implementation and Storybook coverage.

## Source Of Truth

System layers, from highest to lowest:

1. `docs/design-principles.md`
2. `docs/design-language.md`
3. global tokens in `app/globals.css`
4. reusable components in `components/` and `components/ui/`
5. Storybook stories as the visual review layer

If a lower layer conflicts with a higher layer, fix the lower layer.

## Foundations

### Color Tokens

Current base tokens are defined in `app/globals.css`.

Primary light-theme palette:

- `--background: #fafaf7`
- `--foreground: #191919`
- `--card: #f0f0eb`
- `--secondary: #e5e4df`
- `--accent: #ebd8bc`
- `--muted-foreground: #666663`
- `--border: #bfbfba`
- `--destructive: #bf5d43`

Sidebar palette:

- `--sidebar: #191919`
- `--sidebar-foreground: #fafaf7`
- `--sidebar-accent: #262625`
- `--sidebar-border: #40403e`

Usage rules:

- neutrals carry the majority of the UI
- accent is sparing and should not become the primary identity color
- destructive is only for destructive meaning
- financial state colors must remain semantically scoped, not reused as general decoration

### Typography

Fonts:

- sans: Inter
- heading serif: PT Serif
- mono: JetBrains Mono

Utility classes defined in `app/globals.css`:

- `type-h1`
- `type-h2`
- `type-h3`
- `type-h4`
- `type-h5`
- `type-h6`
- `type-body-14`
- `type-body-12`

Rules:

- serif is for display anchors, not dense routine labels
- most application chrome should use sans
- body copy should be short and supportive
- numeric and money-heavy layouts can use mono selectively only when alignment benefits

### Radius And Depth

Current radius scale:

- base `--radius: 0.95rem`
- semantic `--radius-tight: 0.25rem`
- semantic `--radius-control: 0.375rem`
- semantic `--radius-surface: 0.5rem`
- semantic `--radius-floating: 0.75rem`
- derived: `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`

Rules:

- use semantic radius tokens before picking ad-hoc Tailwind radii
- `tight` is for tiny internal elements, never for primary cards
- `control` is the default for buttons and interactive controls inside content
- `surface` is the default for cards, rows, and primary workspace blocks
- `floating` is reserved for popovers, sheets, and floating overlays
- avoid round or pill-shaped controls unless the component meaning explicitly requires it

### Surface Model

Canonical surface levels:

1. `canvas`
2. `panel`
3. `floating`

Implementation reference: `components/surface.tsx`

Rules:

- do not invent a fourth ad-hoc surface when one of these fits
- each new finance workspace should clearly identify which surface level it uses
- floating panels should be compact and tool-like

## Component System

### Atomic Layer

Expected atomic coverage in Storybook:

- typography scale
- surface tokens
- money amount formatting
- badges
- empty state primitives
- inputs, buttons, switches, selects from `components/ui`

### Molecules

Expected molecule coverage:

- transaction row
- account card
- account type badge
- allocation item

### Organisms

Expected organism coverage:

- app sidebar
- transaction list
- account list
- transaction row actions
- transaction form sheet
- account form sheet

### Templates

Expected template coverage:

- workspace shell
- balance view
- other reusable assembled work areas as they stabilize

### Pages

Expected page coverage:

- Balance
- Today
- Calendar
- Dashboard
- transaction entry panel states when they act as route-level experiences

## Storybook Structure

Required top-level order:

1. Foundations
2. Atoms
3. Molecules
4. Organisms
5. Templates
6. Pages

Rules:

- every new page should point back to the lower-level stories it relies on
- if a page changes a reusable pattern, update the lower-level story in the same task
- foundations should remain visual and reviewable, not only textual

## Interaction Patterns

### Floating Panels

Use floating panels for:

- quick add
- transaction entry
- contextual edits
- compact review actions

Rules:

- compact header row
- tight field rhythm
- minimal explanatory copy
- action placement should feel immediate and desktop-like

### Lists And Rows

Rows should optimize scanability first.

Rules:

- align labels and numeric values aggressively
- avoid decorative container nesting inside rows
- state indicators should clarify, not compete with the amount

### Navigation

Navigation should feel structural.

Rules:

- sidebar remains visually quieter than main content
- active state should be obvious but restrained
- icons support recognition and should not become visual noise

## Balance Panel Contract

The left panel of Balance is a canonical product pattern. Future finance inventory screens should start from this contract instead of inventing new row and grouping logic.

### Header

- page title is `h1`
- adjacent info control is icon-only and vertically aligned to the title line
- header actions are compact icon controls with the same visual language as account selection states
- the profile trigger in the desktop sidebar uses the same size, icon weight, radius, and tooltip language as the primary nav items

### Group Rhythm

- section spacing is intentionally larger than item spacing
- account groups use heading-first hierarchy; rows should never compete with the group heading
- empty groups still exist in edit/add mode so insertion points remain predictable

### Account Rows

- account rows are the default inventory primitive
- rows do not use borders as their main state language
- hover and selected states are neutral background shifts, not accent-colored fills
- amount and currency stay tightly aligned as one value unit
- duplicate account-type subtitles should be removed when the group context already explains the type

### Savings Subgroups

- savings subgroups are not nested cards
- subgroup rows do not receive a filled hover or selected background
- the progress track must start on the same vertical axis as the subgroup label
- the savings track is the canonical thin-track reference for other inventory extensions

### Credit Card Rows

- credit cards inherit the base account-row layout first
- one thin track may be added below the main row
- full track represents the credit limit
- filled portion represents available spending room
- debt is shown once in the top row; do not duplicate it below the track
- supporting metric copy under the track should stay minimal

### Mobile Behavior

- the Balance page defaults to the account inventory view
- transaction activity is hidden by default on mobile
- tapping an account or savings subgroup opens a full-screen follow-up surface with a back action
- do not render the desktop split-view register permanently on mobile

## Implementation Rules

- reuse `components/ui` primitives first
- reuse product-level composition components before adding route-local markup
- keep design tokens in CSS/theme variables, not duplicated as random inline hex values in many files
- if a one-off visual treatment is needed, document why it cannot be expressed through an existing pattern

## Current System Gaps

These gaps should guide upcoming UI work:

1. Foundations need broader visual coverage for typography and token review.
2. Storybook still needs more canonical finance page states, especially for transaction-heavy flows.
3. Floating transaction entry needs a stricter design pass to fully match the target desktop-tool feeling.
4. Some older stories still describe screens in generic terms instead of product terms.

## Definition Of Done For UI Work

A UI task is not done until:

1. the product-level principle is still intact
2. the reusable component layer reflects the change
3. Storybook includes the changed state at the correct level
4. local verification passes for the affected build surface
5. if Balance inventory patterns changed, the canonical Balance panel Storybook reference and this contract were updated in the same task
