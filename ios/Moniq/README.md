# Moniq iOS

Native SwiftUI client for Moniq. **Skeleton stage**: Supabase auth + 5-tab navigation shell + SwiftData model scaffolding. No feature screens have real data yet — see `Documentation/ARCHITECTURE.md` for why, and `docs/features/` (web repo) for what gets built next.

Structure and conventions follow the user's other native project (`second_brain`/"Anqui"): XcodeGen-generated project, SwiftUI, Swift 6 strict concurrency, layered `App/Domain/Persistence/Cloud/Features` folders, `Documentation/` as the canonical doc set.

## Setup (requires a Mac + Xcode — this repo is developed from Windows)

1. Install [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`).
2. Copy `Config/Cloud.local.xcconfig.example` to `Config/Cloud.local.xcconfig` and fill in your Supabase project URL/anon key (from the web app's `.env.local` — same Supabase project).
3. Run `xcodegen generate` from this directory to produce `Moniq.xcodeproj` (gitignored — never commit it).
4. Open `Moniq.xcodeproj` in Xcode, select the `Moniq` scheme, and run on a Simulator or device.

## Windows → Mac workflow

This repo's other Swift project (`second_brain`) has a Windows→Mac remote-build pipeline (`scripts/remote-build.ps1` over SSH) for building/testing/installing from a Windows machine. That pipeline is **not yet set up for this project** — set it up analogously if you want the same workflow, or build directly on a Mac.

## Testing

- `MoniqTests` — unit tests (Swift Testing).
- `MoniqUITests` — UI smoke tests (XCTest).

Run both from Xcode or `xcodebuild test` once a Mac toolchain is available. See `Documentation/AI.md` for verification rules — do not report a build/test result that hasn't actually been run.

## Docs

- `Documentation/AI.md` — AI-agent conventions for this project.
- `Documentation/ARCHITECTURE.md` — layer breakdown and current skeleton status.
- `Documentation/DESIGN_SYSTEM.md` — SwiftUI translation of the web's `docs/design.md`.
