# Astryx Migration Roadmap

This checklist tracks the ongoing incremental migration from Tailwind/shadcn to the Astryx design system.

---

## Phase 1: Core Setup & Storybook (Completed)
- [x] Install `@astryxdesign/core`, `@astryxdesign/theme-neutral`, `@astryxdesign/cli`
- [x] Configure `"astryx"` convenience CLI command wrapper in `package.json`
- [x] Run `npx astryx init` to initialize developer guidelines and rules
- [x] Set up CSS coexistence layers in `app/globals.css`
- [x] Mount Astryx `<Theme>` provider in `.storybook/preview.tsx` and import css sheets
- [x] Create proof-of-concept `stories/astryx-demo.stories.tsx` story

## Phase 2: Frame & Shell Migration (Next Phase)
- [ ] Replace existing app shell components (like `AppSidebar`) with Astryx `AppShell`, `TopNav`, and `SideNav`
- [ ] Implement responsive mobile drawer navigation using Astryx mobile shell guidelines
- [ ] Migrate global search / command palette trigger to Astryx `CommandPalette` component
- [ ] Update Storybook templates to use the new shell layout

## Phase 3: Shared Primitives Migration
- [ ] Replace `components/ui/button.tsx` and `components/ui/toggle.tsx` with Astryx `Button` and `IconButton`
- [ ] Replace existing text / number inputs and field wrappers with Astryx `TextInput` / `NumberInput`
- [ ] Replace `components/ui/switch.tsx` and `components/ui/checkbox.tsx` with Astryx `Switch` and `CheckboxInput`
- [ ] Replace existing table layout component with Astryx `Table`
- [ ] Ensure all migrated primitives map custom colors to Moniq's warm neutrals

## Phase 4: Route and Page Migration
- [ ] Migrate **Today** page layout and list structures
- [ ] Migrate **Balance** page split panels (inventory left, transaction register ledger right)
- [ ] Migrate **Calendar** page cells and navigation
- [ ] Migrate **Budget** page sliders and allocation grids
- [ ] Migrate **Settings** popovers and form workflows
