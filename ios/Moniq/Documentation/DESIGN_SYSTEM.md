# Design System — Moniq iOS

This is the SwiftUI translation of the web client's single canonical design reference, [`docs/design.md`](../../docs/design.md). If the two disagree, `docs/design.md` wins — update this file to match, not the other way around.

## The ultimate rule: no cards, no chips, no icon badges

Identical to the web rule — applies to every screen, no exceptions:

- **No card-per-item layout.** List rows (transactions, wallets, categories) render as flat rows inside a shared scrollable canvas, never inside a bordered/shadowed `RoundedRectangle` container.
- **No chips or pills.** Category names, wallet types, and metadata render as plain `.caption`/`.subheadline` muted text next to or below the primary label.
- **No icon badges.** Category/wallet icons are raw thin-stroke SF Symbols (`.fontWeight(.ultraLight)` or `.thin`), never wrapped in a colored circle/square/filled background.

## Color palette (warm neutrals)

Ported in `Moniq/Support/MoniqTheme.swift` (`MoniqColor`):

| Token | Light | Dark |
|---|---|---|
| Background / canvas | `#fafaf7` | `#1a1a19` |
| Surface / card | `#f0f0eb` | `#262624` |
| Secondary surface | `#e5e4df` | `#30302e` |
| Destructive | `#bf5d43` | `#bf5d43` |

Status color applies to text/icons only — never bright fills for buttons or layout blocks. Data visualization uses the web's `chart-1`(#cc785c)…`chart-5`(#40403e) family once charts are built.

## Mobile shell & safe areas

- Status bar and navigation bar backgrounds must blend with the content area — configure `.background` to match the surface color for the current screen context (`#f0f0eb` or `#fafaf7`).
- Bottom tab bar: standard 49pt + safe-area bottom inset. Scrollable content needs bottom clearance (~76pt) so lists scroll fully above the tab bar.

## Liquid Glass roles (iOS 26.5+)

Liquid Glass is a first-class part of native Moniq, adapted rather than hidden. `MoniqGlassSurface` is the shared implementation and native `TabView` supplies the system glass tab bar.

1. **Canvas**: opaque warm `MoniqColor.background`, providing stable contrast and the scene behind glass.
2. **Glass surface**: one focused input or settings region such as Login fields or a settings group. Use warm-neutral tint and the shared continuous shape. Financial workspaces are explicitly excluded.
3. **Interactive glass**: buttons and controls use native `.glass`, `.glassProminent` or interactive glass effects. `.interactive()` is forbidden on read-only regions.

Use `GlassEffectContainer` for related glass controls. Custom blur, gradients and hand-built translucent materials are prohibited. Balance inventory and register content render directly on the warm opaque canvas: no glass header, no glass group, no card and no dashboard summary. Wallets, goals and transactions are flat editorial rows whose hierarchy comes from PWA-matched serif headings, SF Pro body text, spacing and aligned amounts. Reduce Transparency replaces glass controls with the opaque surface token, while Increase Contrast raises control tint strength. Reduce Motion relies on native system behavior and must suppress nonessential transitions.

## Tabs

Five tabs match the current mobile PWA: Today, Balance, Budget, Reports and Profile. Every tab owns an independent `NavigationStack`; Profile contains Inbox, Settings and Sign Out.

## Money display

Balance uses monospaced digits, keeps the localized currency symbol after the amount, and applies one tone to the complete value. Cross-currency totals are not rendered.

## Typography

- Display headings: serif-equivalent (a system serif or bundled equivalent of the web's PT Serif), sparse, single anchor per screen.
- Product UI: SF Pro (system default), matching the web's Inter usage — compact, medium weight for headings.
- Numeric/money-heavy layouts: monospaced digits (`.monospacedDigit()`) where alignment benefits, mirroring the web's selective JetBrains Mono usage.

## Interaction

- Swipe-to-action replaces the web's row-level ghost buttons for common list actions (e.g. mark `planned` → `paid`/`skipped`).
- Sheets (`.sheet`) are the iOS equivalent of the web's structured-data forms; use them for multi-field entry. Confirmation-only dialogs use `.alert` or `.confirmationDialog`, matching the web's dialog-vs-sheet distinction.

## Verification

No Storybook equivalent exists for native code — do not claim "Storybook-first" verification here (an earlier draft of `docs/ios-swift-reference.md` incorrectly copied that web-only rule). Verify visually with SwiftUI Previews per view, and functionally via Simulator builds/`MoniqUITests` once a Mac toolchain is available (see `Documentation/AI.md`).
