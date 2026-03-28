# Database Schema

## `wallets`

- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `name text not null`
- `type wallet_type not null`
  - `cash`
  - `saving`
  - `credit_card`
  - `debt`
- `cash_kind cash_kind null`
  - `debit_card`
  - `cash_wallet`
- `debt_kind debt_kind null`
  - `loan`
  - `mortgage`
  - `personal`
- `balance numeric(14,2) not null`
- `currency currency_code not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Rules:
- `cash` and `saving` balances are normalized positive.
- `credit_card` and `debt` balances are normalized negative.
- only the owner can read or mutate rows through RLS.

## `wallet_allocations`

- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `wallet_id uuid not null references wallets(id)`
- `name text not null`
- `amount numeric(14,2) not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Rules:
- allocations can only belong to `saving` wallets.
- allocation amount cannot go below zero.
- total allocations for a wallet cannot exceed the wallet balance.
- deleting a wallet cascades to its allocations.

## RLS and RPC

- direct table access is protected by owner-only RLS policies.
- wallet and allocation writes go through RPC functions so invariants are enforced server-side as well as in the UI.
- current RPC surface:
  - `create_wallet`
  - `update_wallet`
  - `delete_wallet`
  - `create_wallet_allocation`
  - `update_wallet_allocation`
  - `delete_wallet_allocation`
