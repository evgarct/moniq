# Release process

Moniq uses isolated-test-first delivery. Production migrations are never the first execution of a change.

## Environments

- Production: Supabase project `wffqpmqvgjphuinzgata`, used only by the Vercel Production environment.
- Migration CI: an ephemeral local Supabase stack created inside GitHub Actions, rebuilt from zero twice, seeded only with synthetic personas, and destroyed with the runner.
- Development and Vercel Preview: the existing Supabase project with no automatic schema deployment. Preview builds must use read-only or dedicated synthetic accounts; migrations never run automatically against the linked project.

Supabase Branching is optional. `npm run db:staging:create` remains available if the organization is upgraded later, but the required migration gate does not depend on it.

## Initial setup

1. Open a PR containing the migration.
2. Let `Migration Preview` start local Supabase, rebuild the complete migration history twice, and seed the four synthetic personas.
3. Require the schema/RLS/grants/tenant verification step to pass.
4. Run authenticated application E2E against synthetic accounts before production promotion.
5. Keep production migration deployment manual and protected by the GitHub `production` environment.

Never copy production rows into staging. Test accounts and their credentials are created by `scripts/seed-staging.mjs`; passwords remain in secret stores.

## Migration delivery

1. Create migrations with `supabase migration new <name>`.
2. Open a PR. The required Migration Preview check rebuilds the full history twice in an isolated local Supabase stack, seeds it, and verifies schema, RLS, effective grants, tenant isolation, and migration idempotency.
3. Run authenticated browser/E2E checks with synthetic accounts and the online snapshot fallback enabled.
4. After the local migration gate and E2E checks pass, run `Promote Database to Production` with the exact verified commit SHA. The workflow requires successful migration and quality runs for that SHA; GitHub's `production` environment approval is mandatory.

Do not enable Supabase's automatic deploy-to-production integration. Production promotion is intentionally explicit.

## Data loading (PowerSync retired)

The web app reads one online snapshot: `/api/finance/snapshot` through React Query (`financeSnapshotQueryKey`). The local-first layer (PowerSync, the wa-sqlite replica, the offline command outbox and `/api/sync/*`) was removed in October 2026, together with `NEXT_PUBLIC_LOCAL_FIRST_MODE`, `NEXT_PUBLIC_POWERSYNC_URL` and `LOCAL_FIRST_PILOT_USER_IDS`. Remove those variables from Vercel and shut down the staging and production PowerSync Cloud instances after this release is live.

- Mutations are online only: the optimistic coordinator applies them to the query cache and rolls back with a localized toast when the request fails, including when the device is offline. Nothing is queued on the device.
- The service worker precaches the app shell and the `/offline` fallback only. API responses are never placed in Cache Storage. Logout drops the query cache through the auth listener in `components/providers/finance-session.tsx`, which also clears it whenever the signed-in user changes.
- `vercel.json` pins the functions to `dub1` (Dublin), next to the Supabase project in `eu-west-1`. The default `iad1` put every database round trip across the Atlantic. Keep the function region and the Supabase region together.
- Database objects left for a separate, reviewed cleanup migration once this release is stable: the `powersync` publication, `powersync_role`, `finance_sync_mutations`, and the `sync_version` columns with their `bump_sync_version()` triggers. They are inert without the client. Do not drop them in the same release as the code, and keep `scripts/verify-database.sql` aligned with whatever the cleanup removes.

### Snapshot performance

- `/api/finance/snapshot` reads transaction pages concurrently (4 pages of 1000 per window) alongside positions and preferences. Both heavy routes declare `maxDuration = 60`.
- Production measurements (`performance_events`, Oct 2026): snapshot totals averaged ~20 s with every phase slow, including `auth` (~5 s avg), while the database held only ~1k transactions and queries took milliseconds. The repository now authenticates with `getClaims()` (local JWT verification) instead of a `getUser()` Auth round trip, reads the first transaction page alone, samples per-phase telemetry (20 %; `total` is always recorded), and the client shares one in-flight snapshot request (60 s budget, 2 retries). If `api finance_snapshot` p95 stays high afterwards, the Supabase compute size is the next suspect.
- The 14 days up to 2026-10-31 still showed `api finance_snapshot` p50 7.5 s / p95 43 s and every mutation at 5-6 s p50, against a local-first first paint of 0.44 s. The function region (`iad1`) was an ocean away from the database, so the region pin is the fix for that gap; compare `performance_events` before and after the deploy.
- The service worker applies no timeout to `/api/*` GETs; `finance-api.ts` owns the 30 s client timeout. Dropped connections surface as the localized `common.errors.networkUnavailable` instead of "Failed to fetch", and finance pages show a **Try again** action. `useFinanceData` retries twice with backoff and refetches on reconnect and, while errored, on window focus.
- Pension accounts are excluded from spendable pickers and defaults in the transaction form and from the Projected balance report.
