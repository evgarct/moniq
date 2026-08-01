# Architecture — Moniq iOS

Current status: the native foundation and first read-only finance slice are implemented. Login, biometric locking, navigation and Balance are real; Today, Budget, Reports and Inbox remain localized placeholders.

## Layers

- **App** (`Moniq/App/`) — `MoniqAppRuntime` owns the SwiftData container, repository, `AuthClient`, biometric service and Debug-only demo configuration. Root state selects launch, biometric lock, login or the authenticated tab shell.
- **Domain** (`Moniq/Domain/`) — plain, `Sendable`, Codable types (`Wallet`, `WalletAllocation`, `Transaction`) with no persistence or networking dependency. Enum raw values match the Postgres enum string values used by the web client (see `docs/wallet-model.md`, `docs/design.md` — Transaction kinds table).
- **Persistence** (`Moniq/Persistence/`) — user-namespaced wallet, allocation and transaction records plus a repository that returns one immediate `BalanceSnapshot` and atomically replaces a namespace after reconciliation. Demo mode uses the same repository against an in-memory store.
- **Cloud** (`Moniq/Cloud/`) — `SupabaseAuthClient` and `SupabaseBalanceSyncService`, built on `supabase-swift` and configured from `Config/Cloud.local.xcconfig`. Supabase Data API supplies authoritative snapshots; Realtime invalidations and a 30-second reconciliation heartbeat keep the SwiftData mirror current while Balance is active.
- **Features** (`Moniq/Features/<Name>/`) — PWA-aligned tabs are Today, Balance, Budget, Reports and Profile. Balance provides inventory and wallet register navigation; Profile provides Settings and Face ID control.
- **Support** (`Moniq/Support/`) — cross-feature UI helpers: `MoniqTheme` (color tokens ported from `docs/design.md`), `FeaturePlaceholderView`.

## Local-first launch contract

Authenticated UI reads the user-scoped SwiftData snapshot synchronously on the main actor and renders it before network work. It then fetches `wallets`, `wallet_allocations`, up to 1,000 recent `finance_transactions` bounded to the next 30 days, and active recurring schedules through RLS. Materialized schedule occurrences replace their projections, skipped occurrences stay hidden, and remaining schedules are projected from the first day of the current month through the rolling 30-day future horizon. Month-based recurrence stays anchored to the schedule's original day. The reconciled snapshot atomically replaces the local namespace, while Supabase Realtime and a periodic pull cover updates, reconnects, and delete events. Supabase is always the source of truth; SwiftData is only the fast offline mirror. Logout cancels both continuous and foreground sync before deleting only the verified user's local rows and resetting the Face ID preference.

## Data model mapping

Local Swift types mirror the Postgres schema 1:1 (see `docs/ios-swift-reference.md` §3 for the original blueprint this scaffold follows). `WalletType`/`TransactionStatus`/`TransactionKind` raw values are the exact Postgres enum strings so `Codable` round-trips without a translation layer.

## Sync approach

Balance v1 is read-only. Initial pull, Realtime invalidation, foreground lifecycle and periodic reconciliation all use the verified Supabase session user ID; the client does not trust an arbitrary tenant identifier. Transaction transfers are projected into one signed local register row per participating wallet. Future writes must remain reversible and optimistic, but mutation queues are not part of this read-only slice.

## Platform contract

The native target is iPhone-only, requires iOS 26.5+, Swift 6 language mode and the stable Xcode 26.5 toolchain. iPad and compatibility layouts are intentionally outside the supported-device contract.

## Balance presentation contract

The mobile PWA `Pages/Balance` story is the visual source of truth. Native Balance is a flat, full-bleed editorial workspace: serif page/group headings, compact SF Pro rows, thin raw SF Symbols, tightly aligned monetary columns and section rhythm copied from the PWA. It has no content cards, glass regions, dashboards, summary tiles or row chevrons. Native Liquid Glass remains in the system tab/navigation chrome and genuine controls only.
