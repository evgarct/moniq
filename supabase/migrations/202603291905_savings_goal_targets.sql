do $$
begin
  if not exists (select 1 from pg_type where typname = 'allocation_kind') then
    create type public.allocation_kind as enum ('goal_open', 'goal_targeted');
  end if;
end $$;

alter table public.wallet_allocations
  add column if not exists kind public.allocation_kind,
  add column if not exists target_amount numeric(14, 2);

update public.wallet_allocations
set kind = 'goal_open'::public.allocation_kind
where kind is null;

alter table public.wallet_allocations
  alter column kind set default 'goal_open'::public.allocation_kind;

alter table public.wallet_allocations
  alter column kind set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wallet_allocations_kind_target_amount_check'
  ) then
    alter table public.wallet_allocations
      add constraint wallet_allocations_kind_target_amount_check
      check (
        (kind = 'goal_open'::public.allocation_kind and target_amount is null)
        or
        (kind = 'goal_targeted'::public.allocation_kind and target_amount is not null and target_amount > 0)
      );
  end if;
end $$;

drop function if exists public.create_wallet_allocation(uuid, text, numeric);
create function public.create_wallet_allocation(
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
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if _amount < 0 then
    raise exception 'Allocation amount cannot go below 0.';
  end if;

  if _kind = 'goal_targeted'::public.allocation_kind and (_target_amount is null or _target_amount <= 0) then
    raise exception 'Target amount is required for a targeted goal.';
  end if;

  if _kind = 'goal_open'::public.allocation_kind then
    _target_amount := null;
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
    kind,
    amount,
    target_amount
  )
  values (
    auth.uid(),
    _wallet_id,
    trim(_name),
    _kind,
    _amount,
    _target_amount
  )
  returning * into allocation;

  return allocation;
end;
$$;

drop function if exists public.update_wallet_allocation(uuid, text, numeric);
create function public.update_wallet_allocation(
  _allocation_id uuid,
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

  if _kind = 'goal_targeted'::public.allocation_kind and (_target_amount is null or _target_amount <= 0) then
    raise exception 'Target amount is required for a targeted goal.';
  end if;

  if _kind = 'goal_open'::public.allocation_kind then
    _target_amount := null;
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
    kind = _kind,
    amount = _amount,
    target_amount = _target_amount
  where id = _allocation_id
    and user_id = auth.uid()
  returning * into updated_allocation;

  return updated_allocation;
end;
$$;

grant execute on function public.create_wallet_allocation(uuid, text, public.allocation_kind, numeric, numeric) to authenticated;
grant execute on function public.update_wallet_allocation(uuid, text, public.allocation_kind, numeric, numeric) to authenticated;
