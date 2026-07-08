-- Helper: enforce allocations sum <= wallet balance limit on a saving wallet
create or replace function public.enforce_wallet_allocations_limit(
  _wallet_id uuid
) returns void language plpgsql security definer as $$
declare
  _balance           numeric;
  _total_allocated   numeric;
  _excess            numeric;
  _reduction         numeric;
  _alloc             record;
begin
  -- Get current balance of saving wallet
  select balance into _balance
  from public.wallets
  where id = _wallet_id and type = 'saving';

  if not found then
    return;
  end if;

  -- Get total allocated
  select coalesce(sum(amount), 0) into _total_allocated
  from public.wallet_allocations
  where wallet_id = _wallet_id;

  _excess := _total_allocated - _balance;

  if _excess <= 0 then
    return;
  end if;

  -- Loop through allocations of the wallet ordered by updated_at desc, created_at desc
  for _alloc in (
    select id, amount
    from public.wallet_allocations
    where wallet_id = _wallet_id
    order by coalesce(updated_at, created_at) desc, created_at desc
  ) loop
    if _excess <= 0 then
      exit;
    end if;

    _reduction := least(_alloc.amount, _excess);
    if _reduction > 0 then
      update public.wallet_allocations
      set amount = amount - _reduction,
          updated_at = now()
      where id = _alloc.id;

      _excess := _excess - _reduction;
    end if;
  end loop;
end;
$$;

-- Core transaction trigger function update
create or replace function public.sync_wallet_balance_on_transaction()
returns trigger language plpgsql security definer as $$
declare
  _amount      numeric;
  _dst_amount  numeric;
  _affected_wallets uuid[];
  _wuuid uuid;
begin
  _affected_wallets := array[]::uuid[];

  -- ── REVERSE the OLD row's effect (UPDATE / DELETE) ───────────────────────
  if TG_OP in ('UPDATE', 'DELETE') and OLD.status = 'paid' then
    _amount     := OLD.amount;
    _dst_amount := coalesce(OLD.destination_amount, OLD.amount);

    if OLD.source_account_id is not null then
      perform public.adjust_wallet_balance(OLD.source_account_id, +_amount);
      _affected_wallets := array_append(_affected_wallets, OLD.source_account_id);
    end if;
    if OLD.destination_account_id is not null then
      perform public.adjust_wallet_balance(OLD.destination_account_id, -_dst_amount);
      _affected_wallets := array_append(_affected_wallets, OLD.destination_account_id);
    end if;

    -- Adjust allocation amount
    if OLD.allocation_id is not null then
      update public.wallet_allocations
      set amount = amount + case when OLD.kind = 'expense' then _amount else -_amount end,
          updated_at = now()
      where id = OLD.allocation_id;
      
      -- Ensure it doesn't go below 0
      update public.wallet_allocations
      set amount = greatest(0, amount)
      where id = OLD.allocation_id;
    end if;
  end if;

  -- ── APPLY the NEW row's effect (INSERT / UPDATE) ─────────────────────────
  if TG_OP in ('INSERT', 'UPDATE') and NEW.status = 'paid' then
    _amount     := NEW.amount;
    _dst_amount := coalesce(NEW.destination_amount, NEW.amount);

    if NEW.source_account_id is not null then
      perform public.adjust_wallet_balance(NEW.source_account_id, -_amount);
      _affected_wallets := array_append(_affected_wallets, NEW.source_account_id);
    end if;
    if NEW.destination_account_id is not null then
      perform public.adjust_wallet_balance(NEW.destination_account_id, +_dst_amount);
      _affected_wallets := array_append(_affected_wallets, NEW.destination_account_id);
    end if;

    -- Adjust allocation amount
    if NEW.allocation_id is not null then
      update public.wallet_allocations
      set amount = amount + case when NEW.kind = 'expense' then -_amount else _amount end,
          updated_at = now()
      where id = NEW.allocation_id;

      -- Ensure it doesn't go below 0
      update public.wallet_allocations
      set amount = greatest(0, amount)
      where id = NEW.allocation_id;
    end if;
  end if;

  -- Enforce limits on all affected saving wallets
  if array_length(_affected_wallets, 1) is not null then
    foreach _wuuid in array _affected_wallets loop
      perform public.enforce_wallet_allocations_limit(_wuuid);
    end loop;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- Trigger: wallets balance update
create or replace function public.sync_wallet_allocations_on_balance_change()
returns trigger language plpgsql security definer as $$
begin
  if NEW.type = 'saving' and (OLD.balance is null or NEW.balance <> OLD.balance) then
    perform public.enforce_wallet_allocations_limit(NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists wallets_sync_allocations_on_balance_change on public.wallets;
create trigger wallets_sync_allocations_on_balance_change
  after update of balance
  on public.wallets
  for each row
  execute function public.sync_wallet_allocations_on_balance_change();
