# Architecture — Moniq iOS

Skeleton status: this document describes what's scaffolded today. Real feature data flows land incrementally, picked from the PostHog-ranked slice in `docs/features/` (web repo).

## Layers

- **App** (`Moniq/App/`) — `MoniqApp` entry point; `MoniqAppRuntime` owns the process-wide singletons (SwiftData `ModelContainer`, `WalletRepository`, `SupabaseAuthClient`).
- **Domain** (`Moniq/Domain/`) — plain, `Sendable`, Codable types (`Wallet`, `WalletAllocation`, `Transaction`) with no persistence or networking dependency. Enum raw values match the Postgres enum string values used by the web client (see `docs/wallet-model.md`, `docs/design.md` — Transaction kinds table).
- **Persistence** (`Moniq/Persistence/`) — SwiftData `@Model` records (`WalletRecord`, `TransactionRecord`) plus a `WalletRepository` protocol/implementation boundary. Currently a skeleton: the repository returns empty results, no sync loop exists yet.
- **Cloud** (`Moniq/Cloud/`) — `SupabaseAuthClient`, a thin wrapper around `supabase-swift` (added via SPM in `project.yml`) configured from `Config/Cloud.local.xcconfig`. Only auth (`signIn`/`signUp`/`signOut`/session check) is wired; data sync against Supabase REST/PowerSync is not implemented yet.
- **Features** (`Moniq/Features/<Name>/`) — one folder per tab. Each currently renders `FeaturePlaceholderView` (`Moniq/Support/FeaturePlaceholderView.swift`) except `Auth`, which has a real `LoginView`.
- **Support** (`Moniq/Support/`) — cross-feature UI helpers: `MoniqTheme` (color tokens ported from `docs/design.md`), `FeaturePlaceholderView`.

## Why a skeleton

Building all five tabs' real functionality up front would duplicate work that should instead be driven by actual usage data. PostHog was just installed in the web app (`docs/analytics.md`) and has no data yet. Once it does, `docs/features/` gets ranked by `priority`, and that ranked list decides which `FeaturePlaceholderView` gets replaced with a real screen next — see `docs/features/README.md`.

## Data model mapping

Local Swift types mirror the Postgres schema 1:1 (see `docs/ios-swift-reference.md` §3 for the original blueprint this scaffold follows). `WalletType`/`TransactionStatus`/`TransactionKind` raw values are the exact Postgres enum strings so `Codable` round-trips without a translation layer.

## Sync approach (planned, not yet implemented)

Per `docs/ios-swift-reference.md` §3: reversible optimistic UI — mutate the local SwiftData cache first, update the UI immediately, sync in the background to Supabase, and roll back with a toast on failure. No mutation code exists yet in this skeleton.
