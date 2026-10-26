# Spending forecast

Month-end spending forecast per budgeted category, shown in the evening Telegram digest. Models run in a separate service; Moniq owns all business logic. It extends the plan-based forecast of the Budget screen (`left_at_month_end`, see `docs/budget-feature.md`) with a statistical estimate for unplanned, variable spending.

## Flow

```
Vercel cron (Moniq, 19:30 UTC)  ->  /api/cron/spending-forecast
    1. spending_forecast_source (service-role SQL): history, budgets, planned payments, FX rates
    2. POST https://forecast.safronov.dev/forecast  (Bearer token, 30 s timeout)
    3. pure domain code (features/budget/lib/spending-forecast.ts): statuses, overrun date, baseline, fallback
    4. upsert into spending_forecasts
Vercel cron (telegram-bot, 20:00 UTC)  ->  daily-report
    MCP get_spending_forecast  ->  forecast block (omitted when missing or not dated today)
```

The digest never waits for the model. If the service is down, the cron logs `spending_forecast_user_failed`, stores nothing for that run and keeps older rows; the digest sees no row dated today and sends without the block.

## Code map

| Piece | Where |
| --- | --- |
| Forecast service (FastAPI + Chronos) | `services/moniq-forecast` (README has setup and deploy) |
| Domain rules (series, statuses, baseline, overrun date) | `features/budget/lib/spending-forecast.ts` |
| Orchestration per user, injectable for tests | `features/budget/lib/spending-forecast-run.ts` |
| Service-role database access | `features/budget/server/spending-forecast-db.ts` |
| Model client (timeout, response validation) | `lib/forecast/client.ts` |
| Cron route | `app/api/cron/spending-forecast/route.ts`, scheduled in `vercel.json` |
| Table, source RPC, MCP read RPC | `supabase/migrations/20261026120000_spending_forecasts.sql` |
| MCP tool | `get_spending_forecast` in `app/api/mcp/route.ts` |
| SQL test | `supabase/tests/spending_forecast.sql` |

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `FORECAST_API_URL` | Vercel | Base URL of the service, e.g. `https://forecast.safronov.dev` |
| `FORECAST_API_TOKEN` | Vercel and the service | Shared Bearer secret |
| `FORECAST_TIMEZONE` | Vercel, optional | Timezone that defines "today" (default `Europe/Prague`) |
| `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel | Already used by the other crons |

## Rules

- Only paid spending of top-level budgeted categories (budget comes from the `[budget: N]` prefix of the category description, the same value every month): `expense` rows at full amount and `debt_payment` rows at their `interest_amount` only, exactly like the Budget screen (principal reduces the debt and is not consumption). Subcategories roll up into their parent. Transfers, goal moves, system rows and contribution/investment categories are excluded. Upcoming debt payments (planned rows and schedule occurrences) count their interest the same way. First live check (2026-10-26) matched the Budget screen for every envelope after this rule.
- The model sees only variable spending: rows with a `schedule_id` (recurring) are excluded from the series. `spent_to_date` still includes them, because they are real spending.
- `planned_remaining` is every known upcoming expense from tomorrow to month end: planned rows plus occurrences of active schedules that are not materialized yet (same rule as `mcp_get_transactions_for_period`; paused schedules are ignored).
- Everything is converted to the user's default currency with the stored FX rates, using the rate of each transaction date (latest known rate for future dates). A category with a missing rate is skipped and logged; there are never partial or cross-currency totals.
- `forecast = spent_to_date + planned_remaining + sum of the daily model quantiles`. Summing daily quantiles gives a wider band than the true quantile of the sum; that is accepted for the digest wording and noted in code.
- Fewer than 30 days of history or fewer than 5 days with spending falls back to the run-rate baseline (`method = baseline`): `spent_to_date / days_elapsed * days_in_month`, but never below `spent_to_date + planned_remaining`. The baseline has no spread, so it can report `over` but never `over_likely`.
- Statuses, compared after rounding to cents: `over_likely` (p10 > budget), `over` (p50 > budget), `tight` (p50 >= 90% of budget), otherwise `ok`.
- `expected_overrun_date` is the first day the cumulative median (spent, scheduled payments on their dates, daily medians) passes the budget. It is null when the budget is already exceeded.
- On the last day of the month there is nothing to forecast: no rows are written and the digest shows no block.

## Storage and access

`spending_forecasts` holds one row per user, day and category (unique key; a rerun on the same day overwrites). The cron writes with the service role; owners can read their own rows; `anon` and `authenticated` cannot write. `spending_forecast_source` takes a user id, so it is executable by `service_role` only. `mcp_get_spending_forecast` is the key-hash read wrapper used by the MCP tool.

## Running and verifying

- Dry run (computes and returns rows, writes nothing; an optional `date=YYYY-MM-DD` is honored only in dry-run):
  `GET /api/cron/spending-forecast?dry_run=1` with `Authorization: Bearer $CRON_SECRET`.
- Unit tests: `npm run test:unit` (`spending-forecast`, `spending-forecast-run`, `lib/forecast/client`, MCP protocol). SQL: run `supabase/tests/spending_forecast.sql` after migration resets with two synthetic personas, or wrapped in `begin; <migration>; <test>; rollback;` on the linked database.
- Rollout order: apply the migration, deploy the code with `FORECAST_API_URL` / `FORECAST_API_TOKEN` set, run the dry run, then let the cron run; deploy the digest change last.
