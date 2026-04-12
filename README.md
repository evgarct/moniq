# Moniq

Moniq is a personal finance app foundation built with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, and Supabase.

## Included in this iteration

- `/dashboard`
- `/calendar`
- `/today`
- `/accounts` (New card-based UI)
- `/imports` (CSV import draft inbox + confirm flow)

## Imports

Moniq now supports a CSV-first import workflow instead of direct bank OAuth.

- upload a CSV/TSV/XLS/XLSX bank export into `/imports`
- preview the detected columns and map the required fields
- save imported rows as draft transactions
- review drafts in the inbox
- classify each row as `expense`, `income`, `transfer`, or `debt payment`
- confirm rows into the main finance ledger or delete bad drafts

See [docs/imports.md](/home/evgenii/projects/moniq-csv-import/docs/imports.md) for the full flow, data model, and UI rules.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Supabase Auth + Postgres
- date-fns

## Local setup

```bash
npm install
npx supabase start # optional local Supabase stack
npm run dev
```

Create a `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

If you are linked to the hosted project, apply the current finance schema with:

```bash
npx supabase db push
```

## Notes

- Auth is handled by Supabase SSR cookies.
- Wallets and savings allocations are persisted in Supabase and loaded through API route handlers plus TanStack Query.
- Transactions, categories, and imports are persisted in Supabase.
- CSV imports use a separate draft inbox. Imported rows stay as drafts until the user confirms them, then they are written into the main finance ledger and can create merchant-based category rules.
