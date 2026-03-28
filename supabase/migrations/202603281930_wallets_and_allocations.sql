create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'wallet_type') then
    create type public.wallet_type as enum ('cash', 'saving', 'credit_card', 'debt');
  end if;

  if not exists (select 1 from pg_type where typname = 'cash_kind') then
    create type public.cash_kind as enum ('debit_card', 'cash_wallet');
  end if;

  if not exists (select 1 from pg_type where typname = 'debt_kind') then
    create type public.debt_kind as enum ('loan', 'mortgage', 'personal');
  end if;

  if not exists (select 1 from pg_type where typname = 'currency_code') then
    create type public.currency_code as enum ('EUR', 'CZK', 'RUB', 'USD', 'GBP', 'CHF', 'PLN', 'UAH', 'AED', 'TRY', 'JPY', 'CAD');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  type public.wallet_type not null,
  cash_kind public.cash_kind,
  debt_kind public.debt_kind,
  balance numeric(14, 2) not null default 0,
  currency public.currency_code not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.wallet_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  amount numeric(14, 2) not null check (amount >= 0),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists wallets_user_id_idx on public.wallets(user_id);
create index if not exists wallets_user_id_type_idx on public.wallets(user_id, type);
create index if not exists wallet_allocations_user_id_idx on public.wallet_allocations(user_id);
create index if not exists wallet_allocations_wallet_id_idx on public.wallet_allocations(wallet_id);

drop trigger if exists wallets_set_updated_at on public.wallets;
create trigger wallets_set_updated_at
before update on public.wallets
for each row
execute function public.set_updated_at();

drop trigger if exists wallet_allocations_set_updated_at on public.wallet_allocations;
create trigger wallet_allocations_set_updated_at
before update on public.wallet_allocations
for each row
execute function public.set_updated_at();

alter table public.wallets enable row level security;
alter table public.wallet_allocations enable row level security;

drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own"
on public.wallets
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "wallets_insert_own" on public.wallets;
create policy "wallets_insert_own"
on public.wallets
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "wallets_update_own" on public.wallets;
create policy "wallets_update_own"
on public.wallets
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "wallets_delete_own" on public.wallets;
create policy "wallets_delete_own"
on public.wallets
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "wallet_allocations_select_own" on public.wallet_allocations;
create policy "wallet_allocations_select_own"
on public.wallet_allocations
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "wallet_allocations_insert_own" on public.wallet_allocations;
create policy "wallet_allocations_insert_own"
on public.wallet_allocations
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "wallet_allocations_update_own" on public.wallet_allocations;
create policy "wallet_allocations_update_own"
on public.wallet_allocations
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "wallet_allocations_delete_own" on public.wallet_allocations;
create policy "wallet_allocations_delete_own"
on public.wallet_allocations
for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.create_wallet(
  _name text,
  _type public.wallet_type,
  _balance numeric,
  _currency public.currency_code,
  _debt_kind public.debt_kind default null
)
returns public.wallets
language plpgsql
security invoker
set search_path = public
as $$
declare
  wallet public.wallets;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  insert into public.wallets (
    user_id,
    name,
    type,
    cash_kind,
    debt_kind,
    balance,
    currency
  )
  values (
    auth.uid(),
    trim(_name),
    _type,
    case when _type = 'cash' then 'debit_card'::public.cash_kind else null end,
    case when _type = 'debt' then coalesce(_debt_kind, 'personal'::public.debt_kind) else null end,
    case when _type in ('credit_card', 'debt') then -abs(_balance) else abs(_balance) end,
    _currency
  )
  returning * into wallet;

  return wallet;
end;
$$;

create or replace function public.update_wallet(
  _wallet_id uuid,
  _name text,
  _type public.wallet_type,
  _balance numeric,
  _currency public.currency_code,
  _debt_kind public.debt_kind default null
)
returns public.wallets
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing_wallet public.wallets;
  updated_wallet public.wallets;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select *
  into existing_wallet
  from public.wallets
  where id = _wallet_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Wallet not found';
  end if;

  if existing_wallet.type = 'saving' and _type <> 'saving' then
    delete from public.wallet_allocations
    where wallet_id = _wallet_id
      and user_id = auth.uid();
  end if;

  update public.wallets
  set
    name = trim(_name),
    type = _type,
    cash_kind = case when _type = 'cash' then coalesce(existing_wallet.cash_kind, 'debit_card'::public.cash_kind) else null end,
    debt_kind = case when _type = 'debt' then coalesce(_debt_kind, existing_wallet.debt_kind, 'personal'::public.debt_kind) else null end,
    balance = case when _type in ('credit_card', 'debt') then -abs(_balance) else abs(_balance) end,
    currency = _currency
  where id = _wallet_id
    and user_id = auth.uid()
  returning * into updated_wallet;

  return updated_wallet;
end;
$$;

create or replace function public.delete_wallet(_wallet_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  delete from public.wallets
  where id = _wallet_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.create_wallet_allocation(
  _wallet_id uuid,
  _name text,
  _amount numeric
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
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if _amount < 0 then
    raise exception 'Allocation amount cannot go below 0.';
  end if;

  select *
  into wallet
  from public.wallets
  where id = _wallet_id
    and user_id = auth.uid()
    and type = 'saving';

  if not found then
    raise exception 'Saving wallet not found';
  end if;

  select coalesce(sum(amount), 0)
  into reserved_total
  from public.wallet_allocations
  where wallet_id = _wallet_id
    and user_id = auth.uid();

  if reserved_total + _amount > wallet.balance then
    raise exception 'This allocation would exceed the available savings balance.';
  end if;

  insert into public.wallet_allocations (
    user_id,
    wallet_id,
    name,
    amount
  )
  values (
    auth.uid(),
    _wallet_id,
    trim(_name),
    _amount
  )
  returning * into allocation;

  return allocation;
end;
$$;

create or replace function public.update_wallet_allocation(
  _allocation_id uuid,
  _name text,
  _amount numeric
)
returns public.wallet_allocations
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing_allocation public.wallet_allocations;
  wallet public.wallets;
  reserved_total numeric;
  updated_allocation public.wallet_allocations;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if _amount < 0 then
    raise exception 'Allocation amount cannot go below 0.';
  end if;

  select *
  into existing_allocation
  from public.wallet_allocations
  where id = _allocation_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Allocation not found';
  end if;

  select *
  into wallet
  from public.wallets
  where id = existing_allocation.wallet_id
    and user_id = auth.uid()
    and type = 'saving';

  if not found then
    raise exception 'Saving wallet not found';
  end if;

  select coalesce(sum(amount), 0)
  into reserved_total
  from public.wallet_allocations
  where wallet_id = existing_allocation.wallet_id
    and user_id = auth.uid()
    and id <> _allocation_id;

  if reserved_total + _amount > wallet.balance then
    raise exception 'This allocation would exceed the available savings balance.';
  end if;

  update public.wallet_allocations
  set
    name = trim(_name),
    amount = _amount
  where id = _allocation_id
    and user_id = auth.uid()
  returning * into updated_allocation;

  return updated_allocation;
end;
$$;

create or replace function public.delete_wallet_allocation(_allocation_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  delete from public.wallet_allocations
  where id = _allocation_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.create_wallet(text, public.wallet_type, numeric, public.currency_code, public.debt_kind) to authenticated;
grant execute on function public.update_wallet(uuid, text, public.wallet_type, numeric, public.currency_code, public.debt_kind) to authenticated;
grant execute on function public.delete_wallet(uuid) to authenticated;
grant execute on function public.create_wallet_allocation(uuid, text, numeric) to authenticated;
grant execute on function public.update_wallet_allocation(uuid, text, numeric) to authenticated;
grant execute on function public.delete_wallet_allocation(uuid) to authenticated;
