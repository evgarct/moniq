# Projected Balance Report

The projected balance report is available at `/reports/projected-balance`.
`/reports` redirects to that first report.

## Calculation

- The forecast starts with each selected account's current balance.
- Only transactions with `status === "planned"` affect the forecast.
- Source accounts decrease by `amount`.
- Destination accounts increase by `destination_amount ?? amount`.
- Every point represents the end-of-day balance after that day's planned transactions.
- The report supports up to 18 months because the finance snapshot materializes recurring occurrences through that horizon.

Each configured line may contain one or more accounts, and an account may be reused in multiple lines. Lines are converted to `preferences.default_currency` with the existing exchange-rate helpers. Future dates use the latest available rate. A line is omitted entirely when any included account cannot be converted, so the UI never displays a partial aggregate.

## URL State

The end date is stored as `end=YYYY-MM-DD`. Line definitions use repeated `series` parameters containing base64url JSON:

```json
{"id":"all-accounts","name":"All accounts","accountIds":["account-1"]}
```

Unknown account IDs are ignored. When all URL state is invalid, the report falls back to one line containing every available account and a six-month period.

## Chart

The chart uses `lightweight-charts` directly with stepped line series, crosshair tracking, touch selection, and keyboard date navigation. Keep the TradingView attribution enabled when changing chart options.
