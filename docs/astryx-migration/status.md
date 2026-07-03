# Astryx Migration Status

## Overview
- **Migration Started:** 2026-07-03
- **Primary Goal:** Transition from Tailwind/shadcn to the Astryx design system while preserving Moniq's unique warm neutral, borderless, cardless, and mobile-first design language.
- **Current Completion:** ~25% (Core setup, CSS layers, Storybook, and key UI primitive wrappers: Button, Switch, Separator, Skeleton, Badge, Input, Textarea)

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

### Phase 2: Primitives Migration
1. **Button & IconButton Wrapper:**
   - Re-implemented `components/ui/button.tsx` using Astryx `Button` and `IconButton`.
2. **Switch Wrapper:**
   - Re-implemented `components/ui/switch.tsx` using Astryx `Switch` component.
3. **Separator Wrapper:**
   - Re-implemented `components/ui/separator.tsx` using Astryx `Divider`.
4. **Skeleton Wrapper:**
   - Re-implemented `components/ui/skeleton.tsx` using Astryx `Skeleton`.
5. **Badge Wrapper:**
   - Re-implemented `components/ui/badge.tsx` using Astryx `Badge`.
6. **Input & Textarea Wrappers:**
   - Re-implemented `components/ui/input.tsx` and `components/ui/textarea.tsx` using Astryx `TextInput` and `TextArea`.
