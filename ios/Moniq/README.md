# Moniq iOS

Native SwiftUI client for Moniq, built for **iOS 26.5+** with Swift 6 language mode and the Swift 6.3 compiler. The current slice includes Supabase auth, Face ID app locking, the PWA-aligned five-tab shell, a local-first SwiftData store, and the read-only Balance inventory/register.

The required stable toolchain is Xcode 26.6. The shared `muse-mac` must be upgraded before release verification if `xcodebuild -version` reports an earlier build; Xcode 26.5 can compile the iOS 26.5 target for interim checks but is not the release baseline.

Structure and conventions follow the user's other native project (`second_brain`/"Anqui"): XcodeGen-generated project, SwiftUI, Swift 6 strict concurrency, layered `App/Domain/Persistence/Cloud/Features` folders, `Documentation/` as the canonical doc set.

## Setup (requires a Mac + Xcode 26.6 — this repo is developed from Windows)

1. Install [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`).
2. Copy `Config/Cloud.local.xcconfig.example` to `Config/Cloud.local.xcconfig` and fill in your Supabase project URL/anon key (from the web app's `.env.local` — same Supabase project).
3. Run `xcodegen generate` from this directory to produce `Moniq.xcodeproj` (gitignored — never commit it).
4. Open `Moniq.xcodeproj` in Xcode, select the `Moniq` scheme, and run on a Simulator or device.

## Windows → Mac workflow

`scripts/remote-build.ps1` mirrors `second_brain/scripts/remote-build.ps1`: it snapshots this directory, ships it to the Mac (`muse-mac` by default) over scp, and runs the equivalent `make`/device-install target over ssh. It reuses the same Mac host and the same personal-team signing identity as `second_brain` (falls back to the `ANQUI_*` env vars when `MONIQ_*` ones aren't set).

```powershell
# From ios/Moniq on Windows
.\scripts\remote-build.ps1 -Target build-ios      # simulator build only
.\scripts\remote-build.ps1 -Target test-ios       # simulator unit tests
.\scripts\remote-build.ps1 -Target ui-test-ios    # simulator UI tests
.\scripts\remote-build.ps1 -Target device-install # build, sign, install on the physical iPhone
.\scripts\remote-build.ps1 -Target device-deliver # test-ios, then device-install
```

Physical-device installs share Apple's free-account limit of **3 App IDs per rolling 7 days** with `second_brain` — check what's already on the device first (`ssh muse-mac "xcrun devicectl device info apps --device $env:ANQUI_DEVICE_ID"`), and note the Mac/device may be in concurrent use by other work on sibling projects.

The Mac also needs `Config/Cloud.local.xcconfig` at `~/Documents/Moniq/Config/Cloud.local.xcconfig` (picked up automatically by the remote script) and the shared `AnquiBuild` signing keychain from `second_brain/scripts/setup-mac-signing.sh` for device builds.

## Testing

- `MoniqTests` — unit tests (Swift Testing).
- `MoniqUITests` — UI smoke tests (XCTest).

Run both via `.\scripts\remote-build.ps1 -Target test-ios` / `-Target ui-test-ios` from Windows, or directly on the Mac with `make test-ios`/`make ui-test-ios`. See `Documentation/AI.md` for verification rules — do not report a build/test result that hasn't actually been run.

### Run without login

Add `-MONIQ_DEMO_MODE` to the Debug scheme launch arguments. The app uses an in-memory SwiftData container, a fixed non-production user namespace, and deterministic wallet/transaction fixtures. The flag is compiled only in Debug and cannot bypass authentication in Release.

UI tests use `-MONIQ_DEMO_MODE -MONIQ_BIOMETRICS_SUCCESS` so Balance and Face ID settings can be exercised without live services. Add `-MONIQ_FORCE_BIOMETRIC_LOCK -MONIQ_BIOMETRICS_FAILURE` to render the locked state deterministically in Debug.

### Run with the test user

Copy `Config/Cloud.local.xcconfig.example` to the ignored `Config/Cloud.local.xcconfig`, point it at the same Supabase project as the web app, and supply test-user credentials through the Xcode scheme environment or test process. Never commit credentials or add them to launch arguments, screenshots, snapshots, or logs.

## Docs

- `Documentation/AI.md` — AI-agent conventions for this project.
- `Documentation/ARCHITECTURE.md` — layer breakdown and current native feature status.
- `Documentation/DESIGN_SYSTEM.md` — SwiftUI translation of the web's `docs/design.md`.
