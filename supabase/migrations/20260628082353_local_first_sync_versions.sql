create or replace function public.bump_sync_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.sync_version = old.sync_version + 1;
  return new;
end;
$$;

alter table public.wallets
  add column if not exists sync_version bigint not null default 1;
alter table public.wallet_allocations
  add column if not exists sync_version bigint not null default 1;
alter table public.finance_categories
  add column if not exists sync_version bigint not null default 1;
alter table public.finance_transactions
  add column if not exists sync_version bigint not null default 1;
alter table public.finance_transaction_schedules
  add column if not exists sync_version bigint not null default 1;
alter table public.user_preferences
  add column if not exists sync_version bigint not null default 1;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'wallets',
    'wallet_allocations',
    'finance_categories',
    'finance_transactions',
    'finance_transaction_schedules',
    'user_preferences'
  ] loop
    execute format('drop trigger if exists %I_bump_sync_version on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_bump_sync_version before update on public.%I for each row execute function public.bump_sync_version()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create table if not exists public.finance_sync_mutations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  command_type text not null,
  target_id uuid,
  base_version bigint,
  payload_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'applied', 'conflict', 'rejected')),
  result jsonb,
  error_code text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz
);

create index if not exists finance_sync_mutations_user_created_idx
  on public.finance_sync_mutations(user_id, created_at desc);

alter table public.finance_sync_mutations enable row level security;

drop policy if exists "Users can read their sync mutations" on public.finance_sync_mutations;
create policy "Users can read their sync mutations"
on public.finance_sync_mutations
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.finance_sync_mutations from public, anon, authenticated;
grant select on table public.finance_sync_mutations to authenticated;
grant all on table public.finance_sync_mutations to service_role;

revoke all on function public.bump_sync_version() from public, anon, authenticated;

create or replace function public.create_wallet_with_id(
  _id uuid,
  _name text,
  _type public.wallet_type,
  _credit_limit numeric default null,
  _currency public.currency_code default 'USD'::public.currency_code,
  _debt_kind public.debt_kind default null
)
returns public.wallets
language plpgsql
security invoker
set search_path = public
as $$
declare
  wallet public.wallets;
  resolved_credit_limit numeric;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  resolved_credit_limit := case when _type = 'credit_card' then abs(coalesce(_credit_limit, 0)) else null end;
  if _type = 'credit_card' and resolved_credit_limit <= 0 then
    raise exception 'Credit limit is required for a credit card.';
  end if;
  insert into public.wallets(id, user_id, name, type, cash_kind, debt_kind, balance, credit_limit, currency)
  values (
    _id,
    auth.uid(),
    trim(_name),
    _type,
    case when _type = 'cash' then 'debit_card'::public.cash_kind else null end,
    case when _type = 'debt' then coalesce(_debt_kind, 'personal'::public.debt_kind) else null end,
    0,
    resolved_credit_limit,
    _currency
  )
  on conflict (id) do update set name = excluded.name
    where wallets.user_id = auth.uid()
  returning * into wallet;
  return wallet;
end;
$$;

create or replace function public.create_wallet_allocation_with_id(
  _id uuid,
  _wallet_id uuid,
  _name text,
  _kind public.allocation_kind,
  _amount numeric,
  _target_amount numeric default null
)
returns public.wallet_allocations
language plpgsql
security invoker
set search_path = public
as $$
declare
  wallet public.wallets;
  reserved_total numeric;
  allocation public.wallet_allocations;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if _amount < 0 then raise exception 'Allocation amount cannot go below 0.'; end if;
  if _kind = 'goal_targeted'::public.allocation_kind and (_target_amount is null or _target_amount <= 0) then
    raise exception 'Target amount is required for a targeted goal.';
  end if;
  if _kind = 'goal_open'::public.allocation_kind then _target_amount := null; end if;
  select * into wallet from public.wallets where id = _wallet_id and user_id = auth.uid() and type = 'saving';
  if not found then raise exception 'Saving wallet not found'; end if;
  select coalesce(sum(amount), 0) into reserved_total
  from public.wallet_allocations where wallet_id = _wallet_id and user_id = auth.uid() and id <> _id;
  if reserved_total + _amount > wallet.balance then
    raise exception 'This allocation would exceed the available savings balance.';
  end if;
  insert into public.wallet_allocations(id, user_id, wallet_id, name, kind, amount, target_amount)
  values (_id, auth.uid(), _wallet_id, trim(_name), _kind, _amount, _target_amount)
  on conflict (id) do update set name = excluded.name
    where wallet_allocations.user_id = auth.uid()
  returning * into allocation;
  return allocation;
end;
$$;

revoke all on function public.create_wallet_with_id(uuid, text, public.wallet_type, numeric, public.currency_code, public.debt_kind) from public, anon;
grant execute on function public.create_wallet_with_id(uuid, text, public.wallet_type, numeric, public.currency_code, public.debt_kind) to authenticated;
revoke all on function public.create_wallet_allocation_with_id(uuid, uuid, text, public.allocation_kind, numeric, numeric) from public, anon;
grant execute on function public.create_wallet_allocation_with_id(uuid, uuid, text, public.allocation_kind, numeric, numeric) to authenticated;
