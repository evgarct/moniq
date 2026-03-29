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
- `kind allocation_kind not null`
  - `goal_open`
  - `goal_targeted`
- `amount numeric(14,2) not null`
- `target_amount numeric(14,2) null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Rules:
- allocations can only belong to `saving` wallets.
- allocation amount cannot go below zero.
- `goal_open` must keep `target_amount = null`.
- `goal_targeted` must keep `target_amount > 0`.
- total allocations for a wallet cannot exceed the wallet balance.
- deleting a wallet cascades to its allocations.
- the product-level `Free` bucket is computed from wallet balance minus user-managed allocations and is not persisted as a row.

## `finance_categories`

- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `name text not null`
- `icon text null`
- `type finance_category_type not null`
  - `income`
  - `expense`
- `parent_id uuid null references finance_categories(id)`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Rules:
- categories belong to one user and may be nested without a fixed depth limit.
- parent and child categories must keep the same `type`.
- top-level categories are the future anchor point for budgets, but only for `expense`.
- deleting a category must preserve transactions by reassigning them to another category of the same type.
- category analytics aggregate linked transaction amounts from the full descendant subtree.
- category totals must stay split by currency instead of merged into one fake number.

## `finance_transactions`

- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `title text not null`
- `note text null`
- `occurred_at date not null`
- `status finance_transaction_status not null`
  - `planned`
  - `paid`
- `kind finance_transaction_kind not null`
  - `income`
  - `expense`
  - `transfer`
  - `save_to_goal`
  - `spend_from_goal`
  - `debt_payment`
- `amount numeric(14,2) not null`
- `destination_amount numeric(14,2) null`
- `fx_rate numeric(14,6) null`
- `principal_amount numeric(14,2) null`
- `interest_amount numeric(14,2) null`
- `extra_principal_amount numeric(14,2) null`
- `category_id uuid null references finance_categories(id)`
- `source_account_id uuid null references wallets(id)`
- `destination_account_id uuid null references wallets(id)`
- `allocation_id uuid null references wallet_allocations(id)`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Rules:
- `income` and `expense` require a category and the category type must match the transaction kind.
- `transfer` never uses a category.
- `save_to_goal` and `spend_from_goal` require a savings goal allocation linked to the savings wallet used by the transaction.
- transfers and savings moves may be multi-currency, so `destination_amount` can differ from `amount`.
- `debt_payment.amount` must equal `principal_amount + interest_amount + extra_principal_amount`.
- only `interest_amount` contributes to category analytics for `debt_payment`; principal reduction stays out of expense reporting.
- direct table access is protected by owner-only RLS policies.

## RLS and RPC

- direct table access is protected by owner-only RLS policies.
- wallet and allocation writes go through RPC functions so invariants are enforced server-side as well as in the UI.
- category and transaction writes currently go through the Next.js repository layer, which validates hierarchy and relationship invariants before writing through RLS.
- current RPC surface:
  - `create_wallet`
  - `update_wallet`
  - `delete_wallet`
  - `create_wallet_allocation`
  - `update_wallet_allocation`
  - `delete_wallet_allocation`
