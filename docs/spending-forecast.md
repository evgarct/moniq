# Spending forecast

Month-end spending forecast per budgeted category, shown in the evening Telegram digest. Models run in a separate service; Moniq owns all business logic.

## Flow

```
Vercel cron (Moniq, 19:30 UTC)  ->  /api/cron/spending-forecast
    1. read series, budgets and planned payments (service-only SQL source)
    2. POST https://forecast.safronov.dev/forecast  (Bearer token, 30 s timeout)
    3. pure domain code: statuses, overrun date, baseline, fallback
    4. upsert into spending_forecasts
Vercel cron (telegram-bot, 20:00 UTC)  ->  daily-report
    MCP get_spending_forecast  ->  forecast block (omitted when missing or stale)
```

The digest never waits for the model. If the service is down, the cron logs the failure and keeps yesterday's rows; the digest sees no row for today and sends without the block.

## Forecast service (`services/moniq-forecast`)

FastAPI plus `chronos-forecasting`, default model `amazon/chronos-bolt-small`, zero-shot, CPU only. It receives daily series and returns quantiles per horizon day. It knows nothing about budgets or categories. Setup, API and deploy steps are in `services/moniq-forecast/README.md`. It runs on the Oracle ARM64 VM next to Floppy, behind the same Caddy, at `forecast.safronov.dev`.

## Rules (domain layer, status: planned in PR 2)

- Only paid `expense` transactions of top-level budgeted categories. Subcategories roll up into their parent. Transfers, debt payments, goal moves, system rows and contribution/investment categories are excluded.
- The model sees only variable spending: rows with a `schedule_id` (recurring) are excluded from the series and counted separately as `planned_remaining`.
- Budgets come from the `[budget: N]` prefix of the category description (same value every month).
- Everything is converted to the user's default currency with the stored FX rates. A category with a missing rate is skipped and logged; there are never partial or cross-currency totals.
- `forecast = spent_to_date + planned_remaining + variable_quantile_sum`. Summing daily quantiles gives a wider interval than the true quantile of the sum; this is acceptable for the wording and is noted in code.
- Fewer than 30 days of history or fewer than 5 days with spending falls back to the run-rate baseline (`method = baseline`).
- Statuses: `over_likely` (p10 > budget), `over` (p50 > budget), `tight` (p50 >= 90% of budget), otherwise `ok`. Comparisons round to cents first.
- On the last day of the month there is nothing to forecast and no block is shown.

## Storage

`spending_forecasts` holds one row per user, day and category with budget, spent, planned, p10/p50/p90, baseline, status, expected overrun date, method and model. A rerun on the same day overwrites the row, so accuracy can later be compared against the baseline.
