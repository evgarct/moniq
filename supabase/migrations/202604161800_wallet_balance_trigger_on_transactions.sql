-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: apply a signed delta to a wallet balance
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.adjust_wallet_balance(
  _wallet_id uuid,
  _delta     numeric
) returns void language plpgsql security definer as $$
begin
  update public.wallets
  set    balance = balance + _delta
  where  id = _wallet_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Core trigger function
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sync_wallet_balance_on_transaction()
returns trigger language plpgsql security definer as $$
declare
  _amount      numeric;
  _dst_amount  numeric;
begin

  -- ── REVERSE the OLD row's effect (UPDATE / DELETE) ───────────────────────
  if TG_OP in ('UPDATE', 'DELETE') and OLD.status = 'paid' then
    _amount     := OLD.amount;
    _dst_amount := coalesce(OLD.destination_amount, OLD.amount);

    if OLD.source_account_id is not null then
      perform public.adjust_wallet_balance(OLD.source_account_id, +_amount);
    end if;
    if OLD.destination_account_id is not null then
      perform public.adjust_wallet_balance(OLD.destination_account_id, -_dst_amount);
    end if;
  end if;

  -- ── APPLY the NEW row's effect (INSERT / UPDATE) ─────────────────────────
  if TG_OP in ('INSERT', 'UPDATE') and NEW.status = 'paid' then
    _amount     := NEW.amount;
    _dst_amount := coalesce(NEW.destination_amount, NEW.amount);

    if NEW.source_account_id is not null then
      perform public.adjust_wallet_balance(NEW.source_account_id, -_amount);
    end if;
    if NEW.destination_account_id is not null then
      perform public.adjust_wallet_balance(NEW.destination_account_id, +_dst_amount);
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Attach trigger to finance_transactions
-- ─────────────────────────────────────────────────────────────────────────────
drop trigger if exists finance_transactions_sync_wallet_balance
  on public.finance_transactions;

create trigger finance_transactions_sync_wallet_balance
  after insert or update or delete
  on public.finance_transactions
  for each row
  execute function public.sync_wallet_balance_on_transaction();
