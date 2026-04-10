# Moniq

Moniq is a personal finance app foundation built with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, and Supabase.

## Included in this iteration

- `/dashboard`
- `/calendar`
- `/today`
- `/accounts` (New card-based UI)
- `/banking` (Enable Banking draft inbox + confirm flow)

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
ENABLE_BANKING_APPLICATION_ID=...
ENABLE_BANKING_PRIVATE_KEY_PATH=/absolute/path/to/private-key.pem
ENABLE_BANKING_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
ENABLE_BANKING_REDIRECT_URL=http://localhost:3000/api/banking/callback
ENABLE_BANKING_ASPSP_NAME=MockBank
ENABLE_BANKING_ASPSP_COUNTRY=
ENABLE_BANKING_BASE_URL=https://api.enablebanking.com
```

If you are linked to the hosted project, apply the current finance schema with:

```bash
npx supabase db push
```

## Notes

- Auth is handled by Supabase SSR cookies.
- Wallets and savings allocations are persisted in Supabase and loaded through API route handlers plus TanStack Query.
- Transactions and categories are still the next persistence slice, so dashboard/calendar/today can legitimately be empty on a fresh account.
- Banking imports use a separate Enable Banking inbox. Imported rows stay as drafts until the user confirms them, then they are written into the main finance ledger and can create merchant-based category rules.
- On Vercel, prefer `ENABLE_BANKING_PRIVATE_KEY_PEM` as a multiline secret env instead of `ENABLE_BANKING_PRIVATE_KEY_PATH`, since the deployment filesystem is not a durable secret store.
