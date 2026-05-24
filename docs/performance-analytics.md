# Performance Analytics

Moniq records technical performance events to identify slow page loads, slow API requests, and slow Supabase-backed repository phases. The events are diagnostic only: do not store request bodies, transaction titles, amounts, category names, or other finance payload data.

## Setup

Vercel Speed Insights is enabled in the root layout through `@vercel/speed-insights/next`. Use the Vercel dashboard or `vercel metrics` when the account has Observability Plus to inspect Core Web Vitals by route.

Performance events are stored in `public.performance_events` through the server-side service role client. Set these environment variables in the runtime that should collect data:

- `SUPABASE_SERVICE_ROLE_KEY`: required for persistence and summary reads.
- `PERFORMANCE_ANALYTICS_SALT`: optional stable salt for pseudonymous user hashes. If omitted, the service role key is used as the salt.
- `PERFORMANCE_ANALYTICS_SUMMARY_ENABLED=false`: optional kill switch for the summary endpoint.

If `SUPABASE_SERVICE_ROLE_KEY` is missing, event writes are skipped and `/api/performance/summary` returns `503`.

For Vercel production, confirm the key exists with:

```text
vercel env list production
```

Add it with `vercel env add SUPABASE_SERVICE_ROLE_KEY production`, then redeploy.

## Reading the Summary

Use the authenticated endpoint:

```text
GET /api/performance/summary?window=24h
GET /api/performance/summary?window=7d
```

The response contains:

- `groups`: p50/p95/p99 by `event_type`, `name`, and normalized `route`.
- `finance_snapshot_phases`: p50/p95/p99 for `getFinanceSnapshot()` phases.
- `error_rate`: share of events with HTTP status `>= 400`.

Start with p95, not average. p95 shows the slow experience users actually feel without being dominated by one rare outlier. Use p99 to find severe tail latency.

## How to Diagnose

- High `web_vital` `LCP` or `TTFB`: page load is slow. Compare with `/api/finance/snapshot` API p95. If API p95 is also high, investigate server/database first.
- High `web_vital` `INP`: interactions are slow after the page is visible. Look for slow mutation fetch events and heavy client rendering after mutations.
- High `fetch` p95 for `/api/finance/snapshot`: the browser is waiting on the main finance snapshot request.
- High `api` p95 for `finance_snapshot`: the route handler is slow end to end. Check `finance_snapshot_phases` next.
- High `finance_snapshot` phase `base_reads`: wallet/category/schedule/allocation reads are slow or missing indexes.
- High phase `schedule_tx_read` or `reconcile`: recurring schedule expansion is expensive.
- High phase `transactions_read`: transaction query is the main bottleneck. Check filters, indexes, row counts, and payload size.
- High phase `map`: TypeScript-side mapping/enrichment is expensive; reduce snapshot size or move aggregation into SQL.
- High `mutation` p95 but low following snapshot phases: write RPC/insert/update is slow.
- Low `mutation` p95 but high API p95: the write is fine, but returning the full refreshed snapshot is slow.

`/api/finance/snapshot` materializes recurring transactions for 18 months ahead. The reconciler prunes only non-overridden planned schedule occurrences beyond that horizon; paid, skipped, and manually overridden occurrences are kept as user history.

## Next Optimization Targets

After enough events are collected, optimize the slowest p95 path first:

1. Add or adjust indexes for slow read phases.
2. Split large snapshots by screen if `/api/finance/snapshot` dominates.
3. Replace repeated post-mutation full snapshots with targeted cache updates or smaller refresh endpoints.
4. Move expensive aggregate calculations into SQL views/RPCs.
5. Add snapshot/materialized summary tables only after the phase data shows reads or aggregation remain the bottleneck.
