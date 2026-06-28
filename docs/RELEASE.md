# Release process

Moniq uses staging-first delivery. Production migrations are never the first remote execution of a change.

## Environments

- Production: Supabase project `wffqpmqvgjphuinzgata`, used only by the Vercel Production environment.
- Staging: a persistent, data-less Supabase branch named `staging` in `eu-west-1`. Development and Vercel Preview use its own URL and keys.
- Pull requests with migrations: an ephemeral, data-less Supabase branch seeded with synthetic personas and deleted after verification.

Supabase Branching requires a Pro plan. Until the organization is upgraded, `npm run db:staging:create` will fail with HTTP 402 and migration promotion must remain blocked.

## Initial setup

1. Upgrade the Supabase organization to Pro or above.
2. Put `SUPABASE_PRODUCTION_PROJECT_REF=wffqpmqvgjphuinzgata` in `.env.staging.local`.
3. Run `npm run db:staging:create`.
4. Copy the branch URL, anon key, service-role key, and project ref into `.env.staging.local` and the matching GitHub/Vercel secret scopes.
5. Run `npm run db:staging:seed` and `npm run db:verify`.
6. Point Vercel Development and Preview at staging. Keep Production values unchanged.

Never copy production rows into staging. Test accounts and their credentials are created by `scripts/seed-staging.mjs`; passwords remain in secret stores.

## Migration delivery

1. Create migrations with `supabase migration new <name>`.
2. Open a PR. The required Migration Preview check rebuilds the full history twice locally, deploys the PR delta to an isolated branch, seeds it, and verifies schema, RLS, effective grants, tenant isolation, and migration idempotency.
3. Apply the candidate commit to persistent staging and run authenticated browser/E2E checks.
4. After staging passes, run `Promote Database to Production` with the exact verified commit SHA. The workflow requires successful migration and quality runs for that SHA; GitHub's `production` environment approval is mandatory.

Do not enable Supabase's automatic deploy-to-production integration. Production promotion is intentionally explicit.

## Local-first rollout

`NEXT_PUBLIC_LOCAL_FIRST_MODE` supports `off`, `pilot`, and `on`. Staging uses `on`; production starts with `pilot` and retains the online snapshot path as rollback for one release. A managed PowerSync instance and `NEXT_PUBLIC_POWERSYNC_URL` are configured independently for staging and production.

Configure each PowerSync instance with `supabase/powersync-sync-streams.yaml`. The edition 3 streams auto-subscribe user-owned rows using only `auth.user_id()`; Supabase RLS remains authoritative for writes. Market instruments, quotes, and FX rates are read-only shared reference data.

The client keeps a user-scoped SQLite file, a cached finance snapshot, and a 30-day offline authorization lease. API responses are never placed in service-worker Cache Storage. Logout calls `disconnectAndClear()` before invalidating the server session.
