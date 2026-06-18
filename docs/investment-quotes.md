# Investment quote refresh

Investment positions keep their units in `investment_positions`. Current market values are calculated from the latest
row in `investment_quotes` and remain outside wallet totals.

## Refresh pipeline

1. The Vercel cron calls `GET /api/investments/quotes/refresh`.
2. The route requires `Authorization: Bearer $CRON_SECRET`.
3. The repository loads every FMP-backed instrument that has an active position, including its stored quote currency.
4. FMP full batch quotes are requested first. Missing symbols are retried through the short batch endpoint.
5. Short quotes may omit currency and date. The stored instrument currency is authoritative, and the current UTC date
   is used when FMP supplies neither a date nor a timestamp.
6. Available quotes are upserted. The route returns `502` when any requested symbol remains missing, so incomplete
   refreshes cannot be reported as successful.

## Required Vercel variables

- `FMP_API_KEY`
- `CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

Configure them for Production. `SUPABASE_SERVICE_ROLE_KEY` is also required in Preview only when a preview deployment
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
