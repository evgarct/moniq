# Open Banking (GoCardless) MVP

## Scope

This feature adds a minimal bank import workflow:

- create a GoCardless requisition and open OAuth link
- pull linked accounts into local Postgres (`bank_accounts`)
- sync transactions from the account `last_sync_date`
- save incoming rows as `draft` with deduplication
- allow inline edits/confirm actions from the UI inbox
- persist auto-categorization rules by merchant pattern

## API

All endpoints are namespaced under `/api/open-banking` to avoid collisions with existing finance routes.

- `POST /api/open-banking/connect-bank`
  - without body: creates requisition and returns `{ requisition_id, link }`
  - with `{ requisitionId }`: imports accounts for this requisition
- `GET /api/open-banking/accounts`
  - returns imported bank accounts
- `POST /api/open-banking/sync`
  - optional `{ accountId }`
  - pulls GoCardless transactions since `last_sync_date` and saves drafts
- `GET /api/open-banking/transactions?status=draft|confirmed`
  - returns transaction list filtered by status
- `PATCH /api/open-banking/transactions/:id`
  - updates `merchant_clean`, `category`, `status`
  - if category changes, upserts a categorization rule
- `POST /api/open-banking/transactions/batch-confirm`
  - body `{ ids: string[] }`

## Environment variables

- `GOCARDLESS_SECRET_ID`
- `GOCARDLESS_SECRET_KEY`
- `GOCARDLESS_INSTITUTION_ID`
- `GOCARDLESS_REDIRECT_URL`
- optional `GOCARDLESS_API_URL`

## UI routes

- `/[locale]/banking/connect`
- `/[locale]/banking/inbox`
- `/[locale]/banking/all`

