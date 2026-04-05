# Moniq Design Language

Related documents:

- `docs/design-principles.md` for product-level principles and screen expectations
- `docs/design-system-spec.md` for tokens, components, Storybook coverage, and implementation rules

## Intent

Moniq should feel like a calm desktop finance workspace, not a generic SaaS dashboard. The closest external reference for the visual language is Claude:

- warm ivory workspace instead of cold white
- restrained chrome and quiet borders
- strong typographic hierarchy
- rounded surfaces with soft depth
- sparse accent usage reserved for action and state

This document fixes the current source of truth for the product language and how UI work should be reviewed.

## Canonical References

These are the current reference surfaces for the product language:

1. Global add menu and top-level shell
2. Balance page left panel and wallet grouping
3. Sidebar navigation

If a new screen conflicts with these references, bring the new screen back toward them instead of introducing a parallel style.

## Visual Thesis

- Workspace first: the page should read as one coherent product surface, not a pile of cards.
- Soft warmth: default canvas tones should live in the ivory, parchment, sand, and graphite family.
- Sharp emphasis: use near-black for primary text and action, not colorful accents.
- Serif only for display moments: use the heading face for page-level emphasis, not routine labels.
- Minimal color count: one accent family at a time. Most UI should work in neutrals.

## Surface Hierarchy

Moniq uses three surface levels:

1. Canvas
   - The overall workspace background.
   - Warm, quiet, low-contrast.
2. Panel
   - Primary working areas inside a screen.
   - Slightly brighter than canvas, large radius, subtle inset light.
3. Floating
   - Menus, sheets, popovers, quick-add surfaces.
   - Higher contrast, clearer edge, stronger shadow, tighter padding.

Do not invent additional ad-hoc surface styles when one of these three already fits.

## Layout Language

- Prefer rails, splits, and grouped sections over dashboard-card mosaics.
- Use whitespace and alignment before adding decoration.
- Left navigation should feel structural, not decorative.
- The main workspace should have one dominant reading order.
- Floating panels should feel tool-like and compact, closer to a desktop app than a marketing modal.

## Typography

- Display headings: serif, sparse, only where the screen needs a single anchor.
- Product UI headings: sans serif, medium weight, compact.
- Body copy: quiet and short.
- Labels should explain the job of the control, not repeat marketing language.

## Motion And Interactions

- Motion should clarify hierarchy, not advertise animation.
- Menus and sheets should feel quick and precise.
- Use hover, focus, and selection states consistently across sidebar, list rows, and panels.
- Avoid animated novelty in the main finance workspace.

## Storybook As Source Of Truth

Storybook is the review surface for Moniq UI. Every meaningful UI change should keep these layers healthy:

1. Foundations
   - design language
   - surface hierarchy
   - canonical shell references
2. Atoms
   - money display
   - badges
   - primitive surfaces
3. Molecules
   - rows
   - cards
   - compact summary units
4. Organisms
   - sidebar
   - forms
   - lists
   - account groupings
5. Templates
   - reusable assembled work areas
6. Pages
   - realistic route-level screens

When a screen changes, update both the page story and the reusable lower-level stories it depends on.

## Component Approach

- Reuse the existing `components/ui` primitives first.
- Reuse product-level composition patterns before introducing new markup.
- Keep product-specific patterns in reusable components, not route files.
- Rows, panels, action menus, and floating forms should be shared across screens wherever possible.

## Review Rule

Before calling a UI change done, check:

1. Does it still look like Balance and the current sidebar language?
2. Does it feel like a desktop product surface rather than a website section?
3. Is the same behavior represented in Storybook at the right level?
4. Can the new pattern be reused instead of being trapped in one page?
