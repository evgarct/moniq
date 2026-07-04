-- ─────────────────────────────────────────────────────────────────────────────
-- Fix Cozy Nest balance and adjust trigger on finance_transactions
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
    if OLD.kind = 'debt_payment' then
      _dst_amount := coalesce(OLD.principal_amount, 0) + coalesce(OLD.extra_principal_amount, 0);
      if _dst_amount = 0 and OLD.amount > 0 then
        _dst_amount := coalesce(OLD.destination_amount, OLD.amount);
      end if;
    else
      _dst_amount := coalesce(OLD.destination_amount, OLD.amount);
    end if;

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
    if NEW.kind = 'debt_payment' then
      _dst_amount := coalesce(NEW.principal_amount, 0) + coalesce(NEW.extra_principal_amount, 0);
      if _dst_amount = 0 and NEW.amount > 0 then
        _dst_amount := coalesce(NEW.destination_amount, NEW.amount);
      end if;
    else
      _dst_amount := coalesce(NEW.destination_amount, NEW.amount);
    end if;

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
