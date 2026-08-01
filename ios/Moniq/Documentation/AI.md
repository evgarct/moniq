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

- This is developed from Windows; Xcode/Simulator verification requires a Mac. `scripts/remote-build.ps1` (mirroring `second_brain/scripts/remote-build.ps1`) ships a snapshot to the `muse-mac` host over SSH/scp and runs `make`/device-install targets there — same Mac and same personal-team signing identity as `second_brain`. Falls back to the `ANQUI_*` env vars (`ANQUI_MAC_HOST`, `ANQUI_DEVICE_ID`, `ANQUI_DEVELOPMENT_TEAM`) when `MONIQ_*` ones aren't set, since it's the same account/host.
- **Do not claim Storybook-first verification for this project — it's native Swift, not the web app.** Verify via SwiftUI Previews and/or `.\scripts\remote-build.ps1 -Target build-ios` / `-Target test-ios`. Do not report a build/run/test result that has not actually been checked.
- Run `MoniqTests` and `MoniqUITests` before reporting completion (`.\scripts\remote-build.ps1 -Target test-ios` from Windows, or `make test-ios` directly on the Mac).
- **Physical-device installs share Apple's free-account limit of 3 App IDs per 7-day rolling window with `second_brain`.** Before running `-Target device-install`/`-Target device-deliver`, check what's already installed (`ssh muse-mac "xcrun devicectl device info apps --device $env:ANQUI_DEVICE_ID"`) and confirm with the user before uninstalling anything — the freed slot doesn't necessarily reopen immediately, it's an account-level registration window, not a per-device install count.
- **The Mac (`muse-mac`) and the test iPhone may be in concurrent use by other agents/sessions working on sibling projects (e.g. `second_brain`, `timeline`).** Before running device-level operations (`devicectl`, physical builds/installs), check with the user whether the shared Mac/device is free — don't assume exclusive access.

## Shared-device fleet policy

The test iPhone (`ANQUI_DEVICE_ID`) is shared across every app on this personal Apple Developer team, and a free account only gets 3 App IDs per rolling 7 days. The user's confirmed policy for this device:

1. Exactly **three** product apps live on it at a time: `Anqui`, `Form`, `Moniq`. Don't install a fourth without the user freeing a slot first.
2. Run UI tests on the **Simulator** (`-Target ui-test-ios` / `make ui-test-ios`), not the physical device.
3. **Never run `second_brain`'s `MuseUITests-Runner` (or any UI-test target) against the physical iPhone.** Xcode reinstalls that runner app on the device every time UI tests run there, which silently evicts one of the three product-app slots. If a `second_brain`/Muse UI-test run on device is ever needed, warn the user first — it will likely have to displace `Moniq`, `Anqui`, or `Form`.
