# Architecture

## Runtime shape

- `app/(app)` contains authenticated pages.
- `app/api` exposes thin route handlers for finance reads and wallet/allocation mutations.
- `features/finance/server/repository.ts` is the only server-side finance data access layer.
- `features/finance/lib/finance-api.ts` is the client-side fetch layer used by TanStack Query and mutations.
- `features/accounts` and `features/allocations` keep domain helpers and UI.

## Data flow

1. The browser loads a page inside the authenticated app shell.
2. `useFinanceData()` fetches `/api/finance/snapshot`.
3. The route handler calls the server repository with the current Supabase SSR session.
4. The repository reads `wallets` and `wallet_allocations` through RLS.
5. UI mutations call wallet/allocation API routes and receive the updated snapshot back.
6. TanStack Query replaces the cached snapshot, so the UI stays in sync without client-side mock state.

## Domain boundaries

- `wallets` are real balances.
- `wallet_allocations` are logical reservations inside savings wallets only.
- currencies are wallet-level attributes and allocations inherit the parent wallet currency.
- transactions and categories are intentionally still a separate persistence phase.
