-- Allow a transfer to draw from a specific savings goal (source_allocation_id),
-- enabling goal-to-goal transfers (including across different savings wallets)
-- in addition to the existing destination-goal support via allocation_id.

create or replace function public.sync_wallet_balance_on_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tx_amount numeric;
  destination_amount numeric;
  source_wallet public.wallets;
  reserved_total numeric;
  free_amount numeric;
  net_outflow numeric;
  fallback_amount numeric;
  default_allocation public.wallet_allocations;
  source_allocation public.wallet_allocations;
  destination_allocation public.wallet_allocations;
  linked_release public.finance_transactions;
  affected_wallets uuid[] := array[]::uuid[];
  affected_wallet_id uuid;
begin
  -- Synthetic goal releases are ledger-only rows. Their parent operation owns
  -- wallet and allocation reconciliation.
  if (TG_OP <> 'DELETE' and NEW.system_generated) or (TG_OP = 'DELETE' and OLD.system_generated) then
    if coalesce(current_setting('moniq.disallow_allocation_enforcement', true), 'false') <> 'true' then
      raise exception 'System-generated savings releases cannot be changed directly.';
    end if;
    if TG_OP = 'DELETE' then return OLD; end if;
    return NEW;
  end if;

  perform set_config('moniq.disallow_allocation_enforcement', 'true', true);

  if TG_OP in ('UPDATE', 'DELETE') and OLD.status = 'paid' then
    select * into linked_release
    from public.finance_transactions
    where linked_transaction_id = OLD.id and system_generated
    for update;

    if found then
      update public.wallet_allocations
      set amount = amount + linked_release.amount, updated_at = now()
      where id = linked_release.source_allocation_id;

      delete from public.finance_transactions where id = linked_release.id;
    end if;

    tx_amount := OLD.amount;
    destination_amount := coalesce(OLD.destination_amount, OLD.amount);

    if OLD.source_account_id is not null then
      perform public.adjust_wallet_balance(OLD.source_account_id, tx_amount);
      affected_wallets := array_append(affected_wallets, OLD.source_account_id);
    end if;
    if OLD.destination_account_id is not null then
      perform public.adjust_wallet_balance(OLD.destination_account_id, -destination_amount);
      affected_wallets := array_append(affected_wallets, OLD.destination_account_id);
    end if;

    if OLD.allocation_id is not null then
      update public.wallet_allocations
      set amount = amount + case when OLD.kind = 'expense' then tx_amount else -tx_amount end,
          updated_at = now()
      where id = OLD.allocation_id;
    end if;

    if OLD.source_allocation_id is not null then
      update public.wallet_allocations
      set amount = amount + tx_amount, updated_at = now()
      where id = OLD.source_allocation_id;
    end if;
  end if;

  if TG_OP in ('INSERT', 'UPDATE') and NEW.status = 'paid' then
    tx_amount := NEW.amount;
    destination_amount := coalesce(NEW.destination_amount, NEW.amount);

    select * into source_wallet
    from public.wallets
    where id = NEW.source_account_id
    for update;

    if NEW.source_allocation_id is not null then
      if NEW.kind <> 'transfer' then
        raise exception 'A source goal can only be selected for transfers.';
      end if;
      if not found or source_wallet.type <> 'saving' then
        raise exception 'Selected source goal does not belong to a savings account.';
      end if;

      select * into source_allocation
      from public.wallet_allocations
      where id = NEW.source_allocation_id
      for update;

      if not found or source_allocation.wallet_id <> source_wallet.id then
        raise exception 'Selected source goal does not belong to the source account.';
      end if;

      if NEW.allocation_id is not null and NEW.allocation_id = NEW.source_allocation_id then
        raise exception 'Choose two different goals.';
      end if;
    end if;

    if NEW.allocation_id is not null and NEW.kind = 'transfer' then
      if NEW.destination_account_id is null then
        raise exception 'A destination goal requires a destination account.';
      end if;

      select * into destination_allocation
      from public.wallet_allocations
      where id = NEW.allocation_id;

      if found and destination_allocation.wallet_id <> NEW.destination_account_id then
        raise exception 'Selected destination goal does not belong to the destination account.';
      end if;
    end if;

    if found and source_wallet.type = 'saving' and NEW.allocation_id is null and NEW.source_allocation_id is null then
      net_outflow := tx_amount - case
        when NEW.destination_account_id = NEW.source_account_id then destination_amount
        else 0
      end;

      if net_outflow > 0 then
        select coalesce(sum(amount), 0) into reserved_total
        from public.wallet_allocations
        where wallet_id = source_wallet.id;

        free_amount := source_wallet.balance - reserved_total;
        fallback_amount := greatest(net_outflow - greatest(free_amount, 0), 0);

        if fallback_amount > 0 then
          select * into default_allocation
          from public.wallet_allocations
          where wallet_id = source_wallet.id and is_default
          for update;

          if not found or default_allocation.amount < fallback_amount then
            raise exception 'Savings operation exceeds Free plus the default goal balance.';
          end if;

          update public.wallet_allocations
          set amount = amount - fallback_amount, updated_at = now()
          where id = default_allocation.id;

          insert into public.finance_transactions (
            user_id, title, note, occurred_at, status, kind, amount,
            destination_amount, source_account_id, destination_account_id,
            source_allocation_id, linked_transaction_id, system_generated
          ) values (
            NEW.user_id, default_allocation.name, null, NEW.occurred_at, 'paid', 'transfer', fallback_amount,
            fallback_amount, source_wallet.id, source_wallet.id,
            default_allocation.id, NEW.id, true
          );
        end if;
      end if;
    end if;

    if NEW.source_allocation_id is not null then
      if source_allocation.amount < tx_amount then
        raise exception 'Selected goal does not have enough funds for this transfer.';
      end if;

      update public.wallet_allocations
      set amount = amount - tx_amount, updated_at = now()
      where id = source_allocation.id;
    end if;

    if NEW.source_account_id is not null then
      perform public.adjust_wallet_balance(NEW.source_account_id, -tx_amount);
      affected_wallets := array_append(affected_wallets, NEW.source_account_id);
    end if;
    if NEW.destination_account_id is not null then
      perform public.adjust_wallet_balance(NEW.destination_account_id, destination_amount);
      affected_wallets := array_append(affected_wallets, NEW.destination_account_id);
    end if;

    if NEW.allocation_id is not null then
      update public.wallet_allocations
      set amount = amount + case when NEW.kind = 'expense' then -tx_amount else tx_amount end,
          updated_at = now()
      where id = NEW.allocation_id;

      if exists (select 1 from public.wallet_allocations where id = NEW.allocation_id and amount < 0) then
        raise exception 'Savings goal balance cannot go below zero.';
      end if;
    end if;
  end if;

  perform set_config('moniq.disallow_allocation_enforcement', 'false', true);
  if array_length(affected_wallets, 1) is not null then
    foreach affected_wallet_id in array affected_wallets loop
      perform public.enforce_wallet_allocations_limit(affected_wallet_id);
    end loop;
  end if;

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;
