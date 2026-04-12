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
- `credit_limit numeric(14,2) null`
- `currency currency_code not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Rules:
- `cash` and `saving` balances are normalized positive.
- `credit_card` and `debt` balances are normalized negative.
- `credit_limit` is used only for `credit_card` wallets and stays null for all other wallet types.
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
  - `skipped`
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
- `schedule_id uuid null references finance_transaction_schedules(id)`
- `schedule_occurrence_date date null`
- `is_schedule_override boolean not null default false`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Rules:
- one-off entries live directly in `finance_transactions`; recurring series expand into generated transaction occurrences.
- `income` and `expense` require a category and the category type must match the transaction kind.
- `transfer` never uses a category.
- `save_to_goal` and `spend_from_goal` require a savings goal allocation linked to the savings wallet used by the transaction.
- transfers and savings moves may be multi-currency, so `destination_amount` can differ from `amount`.
- `debt_payment.amount` must equal `principal_amount + interest_amount + extra_principal_amount`.
- only `interest_amount` contributes to category analytics for `debt_payment`; principal reduction stays out of expense reporting.
- analytics and recent activity treat `paid` as settled cashflow; `planned` remains visible in agenda/calendar flows and `skipped` is hidden from normal feeds.
- a recurring occurrence is unique per `(user_id, schedule_id, schedule_occurrence_date)`.
- direct table access is protected by owner-only RLS policies.

## Import staging tables

### `import_batches`

- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `wallet_id uuid not null references wallets(id)`
- `source_filename text not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Rules:
- a batch represents one uploaded file mapped to one primary wallet
- batches only matter while draft imports still exist
- deleting a batch removes its remaining draft imports
- confirmed ledger transactions must not depend on batch existence

### `import_transactions`

- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `batch_id uuid not null references import_batches(id)`
- `wallet_id uuid not null references wallets(id)`
- `finance_transaction_id uuid null references finance_transactions(id)`
- `external_id text null`
- `row_index integer not null`
- `fingerprint text not null`
- `amount numeric(14,2) not null`
- `currency currency_code not null`
- `occurred_at date not null`
- `kind finance_transaction_kind not null`
- `counterpart_wallet_id uuid null references wallets(id)`
- `merchant_raw text not null`
- `merchant_clean text not null`
- `category_id uuid null references finance_categories(id)`
- `status import_transaction_status not null`
  - `draft`
  - `confirmed`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Rules:
- imported rows land as `draft` first
- `expense` and `income` drafts require a category before confirmation
- `transfer` and `debt_payment` drafts require a counterpart wallet before confirmation
- confirmation creates a row in `finance_transactions` and links it back through `finance_transaction_id`
- deleting a draft import must not delete already confirmed ledger rows

### `import_rules`

- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `merchant_pattern text not null`
- `category_id uuid not null references finance_categories(id)`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Rules:
- rules are user-owned merchant-to-category hints
- import normalization can use them to prefill categories on future draft rows
- rules are best-effort suggestions and never bypass manual confirmation

## `finance_transaction_schedules`

- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `title text not null`
- `note text null`
- `start_date date not null`
- `frequency finance_transaction_schedule_frequency not null`
  - `daily`
  - `weekly`
  - `monthly`
- `until_date date null`
- `state finance_transaction_schedule_state not null`
  - `active`
  - `paused`
- `kind finance_transaction_kind not null`
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
- schedules are the source of truth for recurring transactions; generated occurrences inherit the schedule payload unless a specific occurrence is overridden.
- schedules always start as `planned`; settling cashflow happens on occurrences through `mark paid`.
- `until_date`, when present, must be on or after `start_date`.
- `paused` schedules preserve already generated history but stop future occurrence generation until resumed.

## RLS and RPC

- direct table access is protected by owner-only RLS policies.
- wallet and allocation writes go through RPC functions so invariants are enforced server-side as well as in the UI.
- category, transaction, and schedule writes currently go through the Next.js repository layer, which validates hierarchy and relationship invariants before writing through RLS.
- current RPC surface:
  - `create_wallet`
  - `update_wallet`
  - `delete_wallet`
  - `create_wallet_allocation`
  - `update_wallet_allocation`
  - `delete_wallet_allocation`
