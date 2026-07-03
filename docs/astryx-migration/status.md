# Astryx Migration Status

## Overview
- **Migration Started:** 2026-07-03
- **Primary Goal:** Transition from Tailwind/shadcn to the Astryx design system while preserving Moniq's unique warm neutral, borderless, cardless, and mobile-first design language.
- **Current Completion:** ~5% (Core setup, CSS coexistence layer structure, Storybook configuration, and demo story)

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
