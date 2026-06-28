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

## Local-first rollout

`NEXT_PUBLIC_LOCAL_FIRST_MODE` supports `off`, `pilot`, and `on`. Staging uses `on`; production starts with `pilot` and retains the online snapshot path as rollback for one release. A managed PowerSync instance and `NEXT_PUBLIC_POWERSYNC_URL` are configured independently for staging and production.

Configure each PowerSync instance with `supabase/powersync-sync-streams.yaml`. The edition 3 streams auto-subscribe user-owned rows using only `auth.user_id()`; Supabase RLS remains authoritative for writes. Market instruments, quotes, and FX rates are read-only shared reference data.

The client keeps a user-scoped SQLite file, a cached finance snapshot, and a 30-day offline authorization lease. API responses are never placed in service-worker Cache Storage. Logout calls `disconnectAndClear()` before invalidating the server session.
