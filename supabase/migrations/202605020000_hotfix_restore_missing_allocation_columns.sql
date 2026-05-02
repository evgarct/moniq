-- Hotfix: restore kind + target_amount on wallet_allocations and allocation_id on
-- finance_transaction_schedules. The restore_wallet_allocations migration brought
-- back the wallet_allocations table but omitted these columns, breaking the main
-- branch on prod.

alter table public.wallet_allocations
  add column if not exists kind public.allocation_kind not null default 'goal_open';

alter table public.wallet_allocations
  add column if not exists target_amount numeric(14, 2);

alter table public.finance_transaction_schedules
  add column if not exists allocation_id uuid references public.wallet_allocations(id) on delete set null;
