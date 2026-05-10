-- Add allocation_id to transactions and schedules as an optional goal tag.
-- wallet_allocations already exists; this just links transactions to goals.

alter table public.finance_transactions
  add column if not exists allocation_id uuid
    references public.wallet_allocations(id) on delete set null;

alter table public.finance_transaction_schedules
  add column if not exists allocation_id uuid
    references public.wallet_allocations(id) on delete set null;

create index if not exists finance_transactions_allocation_id_idx
  on public.finance_transactions(allocation_id)
  where allocation_id is not null;
