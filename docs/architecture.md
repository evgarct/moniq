# Architecture

## Runtime shape

- `app/(app)` contains authenticated pages.
- `app/api` exposes thin route handlers for finance reads, wallet/allocation mutations, and MCP agent workflows.
- `features/finance/server/repository.ts` is the only server-side finance data access layer.
- `features/finance/lib/finance-api.ts` is the client-side fetch layer used by TanStack Query and mutations.
- `features/accounts` and `features/allocations` keep domain helpers and UI.
- `features/banking` owns CSV import preview, draft inbox review, import rules, and confirm/delete flows.

## Data flow

1. The browser loads a page inside the authenticated app shell.
2. `useFinanceData()` fetches `/api/finance/snapshot`.
3. The route handler calls the server repository with the current Supabase SSR session.
4. The repository reads `wallets`, `wallet_allocations`, `finance_categories`, `finance_transaction_schedules`, and `finance_transactions` through RLS.
5. The repository expands active recurring schedules into generated planned occurrences inside a rolling horizon before returning the finance snapshot.
6. CSV uploads go through `/api/banking/import-preview` and `/api/banking/upload`, which parse the file, map columns, and persist draft import rows.
7. MCP clients call `/api/mcp` to read finance context, create pending transaction batches, edit/reject pending draft rows, or create/update/delete confirmed ledger transactions through ownership-checked RPCs.
8. Finance UI mutations are submitted through `FinanceMutationCoordinator`. Each command projects its result into the TanStack Query snapshot immediately, then calls the existing API route in the background.
9. The coordinator keeps the last confirmed server snapshot and reapplies queued commands after every response. A failed command is removed without reverting later optimistic work; successful creates register `optimistic:*` to server ID aliases before dependent commands run. Each command also returns a completion promise so forms can retain entered values when persistence fails.
10. Banking inbox and import mutations remain outside the finance command queue because they operate on draft records rather than the confirmed finance snapshot.

## Feature modules

- `features/accounts` — wallet inventory, allocation management, and the Balance workspace.
- `features/budget` — monthly cashflow chart and category spending breakdown. See `docs/budget-feature.md`.
- `features/transactions` — transaction form, recurring schedule logic, and transaction list primitives.
- `features/categories` — category tree builder and category icon resolution.
- `features/banking` — CSV import preview, draft inbox, and import rules.
- `features/allocations` — allocation form and amount validation helpers.
- `features/finance` — shared snapshot query (`useFinanceData`), server repository, and client-side API layer.
- `app/api/mcp` — Model Context Protocol tools/resources for agent transaction workflows and ChatGPT Apps result widgets.

## Performance telemetry

Moniq records technical performance events for Web Vitals, client fetches, API route timings, finance mutations, and `getFinanceSnapshot()` phases. Events are stored in `public.performance_events` through the service role client only, with pseudonymous user/session identifiers and sanitized metadata. See `docs/performance-analytics.md` for setup and diagnosis workflow.

## Domain boundaries

- `wallets` are real balances.
- `wallet_allocations` are logical reservations inside savings wallets only.
- MCP exposes wallet/category/transaction context for agent workflows, but not `wallet_allocations`; savings free-vs-reserved buckets remain a Balance UI concept.
- MCP transaction batches and batch items are agent staging records. Pending draft items can be updated or rejected before approval; hard deletion is limited to pending drafts.
- MCP direct transaction tools mutate `finance_transactions` through SECURITY DEFINER RPCs that resolve the API key hash to a user before applying normal ownership checks.
- MCP tool results use structured content for model-visible summaries and a transaction result widget resource for ChatGPT UI rendering, with detailed operation payloads kept in private result metadata.
- `finance_categories` are user-owned income or expense trees with arbitrary nesting.
- `finance_transaction_schedules` define recurring series and own cadence/state rules.
- `finance_transactions` store one register for income, expense, transfer, savings moves, and debt payments, including generated occurrences for recurring series.
- import batches and draft import rows are staging entities that exist before confirmed ledger transactions are created.
- currencies are wallet-level attributes and allocations inherit the parent wallet currency.
- category analytics must remain currency-separated instead of mixing EUR/CZK/RUB into one fake total.
- cashflow analytics only aggregate settled `paid` transactions; `planned` and `skipped` are operational states for calendar and today flows rather than balance math.
