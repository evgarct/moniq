# Architecture — Moniq iOS

Current status: the native foundation and first read-only finance slice are implemented. Login, biometric locking, navigation and Balance are real; Today, Budget, Reports and Inbox remain localized placeholders.

## Layers

- **App** (`Moniq/App/`) — `MoniqAppRuntime` owns the SwiftData container, repository, `AuthClient`, biometric service and Debug-only demo configuration. Root state selects launch, biometric lock, login or the authenticated tab shell.
- **Domain** (`Moniq/Domain/`) — plain, `Sendable`, Codable types (`Wallet`, `WalletAllocation`, `Transaction`) with no persistence or networking dependency. Enum raw values match the Postgres enum string values used by the web client (see `docs/wallet-model.md`, `docs/design.md` — Transaction kinds table).
- **Persistence** (`Moniq/Persistence/`) — user-namespaced wallet, allocation and transaction records plus a repository that returns one immediate `BalanceSnapshot`. Demo mode uses the same repository against an in-memory store. Cloud sync and mutations are deliberately not part of this slice.
- **Cloud** (`Moniq/Cloud/`) — `SupabaseAuthClient`, a thin wrapper around `supabase-swift` (added via SPM in `project.yml`) configured from `Config/Cloud.local.xcconfig`. Only auth (`signIn`/`signUp`/`signOut`/session check) is wired; data sync against Supabase REST/PowerSync is not implemented yet.
- **Features** (`Moniq/Features/<Name>/`) — PWA-aligned tabs are Today, Balance, Budget, Reports and Profile. Balance provides inventory and wallet register navigation; Profile provides Settings and Face ID control.
- **Support** (`Moniq/Support/`) — cross-feature UI helpers: `MoniqTheme` (color tokens ported from `docs/design.md`), `FeaturePlaceholderView`.

## Local-first launch contract

Authenticated UI reads the user-scoped SwiftData snapshot synchronously on the main actor and renders it before any future cloud refresh. Logout deletes only the verified user's local rows and resets the Face ID preference. A future sync engine must preserve this immediate local render path and reconcile in the background.

## Data model mapping

Local Swift types mirror the Postgres schema 1:1 (see `docs/ios-swift-reference.md` §3 for the original blueprint this scaffold follows). `WalletType`/`TransactionStatus`/`TransactionKind` raw values are the exact Postgres enum strings so `Codable` round-trips without a translation layer.

## Sync approach (planned, not yet implemented)

Per `docs/ios-swift-reference.md` §3: reversible optimistic UI will mutate the local SwiftData cache first, update the UI immediately, sync in the background to Supabase, and roll back with a toast on failure. Balance v1 is read-only, so mutation and sync-queue code do not exist yet.
