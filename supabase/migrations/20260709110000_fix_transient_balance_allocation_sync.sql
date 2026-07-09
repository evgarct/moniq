-- Disable enforcement during transaction balance updates to prevent transient overallocation drops
create or replace function public.sync_wallet_allocations_on_balance_change()
returns trigger language plpgsql security definer as $$
begin
  if current_setting('moniq.disallow_allocation_enforcement', true) = 'true' then
    return NEW;
  end if;

  if NEW.type = 'saving' and (OLD.balance is null or NEW.balance <> OLD.balance) then
    perform public.enforce_wallet_allocations_limit(NEW.id);
  end if;
  return NEW;
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
  -- Block nested allocation limit checks for transient balance adjustments
  perform set_config('moniq.disallow_allocation_enforcement', 'true', true);

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

  -- Restore checking setting
  perform set_config('moniq.disallow_allocation_enforcement', 'false', true);

  -- Enforce limits on all affected saving wallets exactly once at the end
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
