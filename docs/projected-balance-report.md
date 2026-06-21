# Projected Balance Report

## Rendering and preferences

The report uses an internal responsive SVG renderer. It does not depend on a
third-party chart watermark or attribution surface. The renderer keeps the
step-line projection, responsive axes, pointer inspection, and left/right
keyboard navigation.

The selected accounts, merged/separate mode, and preset period are stored in
the versioned `moniq:projected-balance:preferences:v1` browser preference.
Explicit URL parameters take precedence over remembered preferences. The old
account-only preference is migrated automatically.

On mobile, one icon action opens the fullscreen filter sheet. The report view
owns exactly one bottom-navigation clearance and the chart fills the remaining
height between the header and mobile navigation.

The projected balance report is available at `/reports/projected-balance`.
`/reports` redirects to that first report.

## Calculation

- The forecast starts with each selected account's current balance.
- Only transactions with `status === "planned"` affect the forecast.
- Source accounts decrease by `amount`.
- Destination accounts increase by `destination_amount ?? amount`.
- Every point represents the end-of-day balance after that day's planned transactions.
- The report supports up to 18 months because the finance snapshot materializes recurring occurrences through that horizon.

Users select the accounts included in the report. In merged mode, all selected accounts produce one line. With merged mode off, each selected account produces its own line. Every line is converted to `preferences.default_currency` with the existing exchange-rate helpers, and future dates use the latest available rate.

When the finance snapshot does not contain a required currency pair, the report page requests a fresh rate from the authenticated FX refresh route. Frankfurter remains the primary provider; Currency API is the fallback for pairs omitted by Frankfurter. The refreshed rates are used immediately in the current report. When `SUPABASE_SERVICE_ROLE_KEY` is configured, they are also persisted in `fx_rates`.

## URL State

The end date is stored as `end=YYYY-MM-DD`. Selected accounts use repeated
`account` parameters, and `merged=true|false` controls line composition. Unknown
account IDs are ignored. Legacy `series` parameters are read once for existing
deep links and replaced with the current format after the next interaction.
Explicit URL state wins over the versioned browser preferences; preferences
win over the default selection and period.

## Chart

The internal SVG chart uses a restrained accent for the primary line and
neutral colors for additional lines. It fills the report workspace, uses
compact value-axis labels, and supports pointer, touch, and keyboard date
navigation. Hovering, tapping, dragging, or navigating with the arrow keys
shows the selected date and line balances.
