# Investment quote refresh

Investment positions keep their units in `investment_positions`. Current market values are calculated from the latest
row in `investment_quotes` and remain outside wallet totals.

## Purchase links

An expense can optionally record `investment_instrument_id` and
`investment_units` when its category is the category marked with purpose
`investment` or one of that category's descendants. Only an existing ETF
position can be linked. Recurring schedules intentionally keep these fields
empty; a generated occurrence can be edited later to record the ETF and the
units actually purchased.

## Refresh pipeline

1. The Vercel cron calls `GET /api/investments/quotes/refresh`.
2. The route requires `Authorization: Bearer $CRON_SECRET`.
3. The repository loads every tracked instrument that has an active position, including ISIN, exchange, and quote currency.
4. When `FMP_API_KEY` is configured, FMP full batch quotes are requested first and missing symbols are retried through
   the short batch endpoint.
5. Remaining Xetra instruments with an ISIN are fetched from the official Deutsche Börse price endpoint without a key.
6. Short FMP quotes may omit currency and date. The stored instrument currency is authoritative, and the current UTC date
   is used when FMP supplies neither a date nor a timestamp.
7. Available quotes are upserted. The route returns `502` when any requested symbol remains missing, so incomplete
   refreshes cannot be reported as successful.

## Required Vercel variables

- `CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

`FMP_API_KEY` is optional for quote refresh because supported Xetra instruments fall back to Deutsche Börse. It remains
required for remote investment search and broader exchange coverage.

Configure the required variables for Production. `SUPABASE_SERVICE_ROLE_KEY` is also required in Preview only when a preview deployment
is intentionally allowed to write to the linked development database.

## Verification

After deployment, invoke the route with the cron bearer token and verify both the response diagnostics and the linked
database:

```sql
select
  i.provider_symbol,
  q.market_date,
  q.price,
  q.currency,
  q.fetched_at
from public.investment_instruments i
join public.investment_quotes q on q.instrument_id = i.id
where i.provider_symbol in ('VUAA.DE', 'SPYL.DE')
order by i.provider_symbol, q.market_date desc;
```

The refresh is complete only when every requested symbol appears in `saved_symbols`, `missing_symbols` is empty, and
the Balance UI displays each position in the quote currency.
