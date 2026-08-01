# AI Contributor Instructions — Moniq iOS

## Product language

- The product name is `Moniq`. Domain terms mirror the web client: `Wallet`, `Transaction`, `WalletAllocation` (see `Moniq/Domain/`).
- Do not invent parallel naming for the same concepts the web client already names (e.g. don't call a wallet an "Account" in code — `Wallet` is canonical, matching `docs/wallet-model.md`).

## Source of truth

- `project.yml` is the source of truth for the Xcode project. **Never commit a generated `.xcodeproj`.** After editing `project.yml`, regenerate with `xcodegen generate` (see `README.md`).
- Visual/design rules come from the web repo's [`docs/design.md`](../../docs/design.md) — translated to SwiftUI/SF Symbols in [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md). Do not restate those rules a third time here; update the translation doc if the web canonical doc changes.
- Feature scope/priority comes from [`docs/features/`](../../docs/features/) in the web repo. This iOS app ships as a skeleton (auth + tab navigation only) until PostHog usage data ranks which features to build next — see `docs/features/README.md`.

## Documentation discipline

Before changing implementation behavior, check this folder. When changing architecture, UX, or feature behavior, update the matching document (`ARCHITECTURE.md`, `DESIGN_SYSTEM.md`) in the same change set.

## Implementation rules

- Keep user-facing strings in `Moniq/Resources/Localizable.xcstrings`, mirroring the web client's `next-intl` discipline (`docs/design.md` / `AGENTS.md` localization rules) — no hardcoded UI strings.
- Use repository boundaries for persistence (`Moniq/Persistence/WalletRepository.swift`) — don't reach into SwiftData models directly from feature views.
- Use SF Symbols, thin/ultralight weight where the web equivalent uses a raw outline icon (see `DESIGN_SYSTEM.md`).
- Swift 6 strict concurrency is enabled (`SWIFT_STRICT_CONCURRENCY: complete` in `project.yml`) — new types crossing actor boundaries must be `Sendable` or properly isolated.
- No Live Activities / App Intents / widget extension targets exist yet — don't add one without an explicit product decision, this is a skeleton.

## Verification rules

- This is developed from Windows; Xcode/Simulator verification requires a Mac. Use a remote-build script analogous to `second_brain/scripts/remote-build.ps1` once one exists for this project (not set up yet — confirm with the user before assuming a remote Mac host is available).
- **Do not claim Storybook-first verification for this project — it's native Swift, not the web app.** Verify via SwiftUI Previews and/or Simulator builds/tests (`xcodebuild test` or the Mac-side equivalent). Do not report a build/run/test result that has not actually been checked.
- Run `MoniqTests` and `MoniqUITests` before reporting completion once a Mac toolchain is available.
