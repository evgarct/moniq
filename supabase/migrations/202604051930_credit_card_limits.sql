alter table public.wallets
  add column if not exists credit_limit numeric(14, 2);

update public.wallets
set credit_limit = abs(balance)
where type = 'credit_card'
  and credit_limit is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wallets_credit_limit_non_negative'
  ) then
    alter table public.wallets
      add constraint wallets_credit_limit_non_negative
      check (credit_limit is null or credit_limit >= 0);
  end if;
end $$;

drop function if exists public.create_wallet(text, public.wallet_type, numeric, public.currency_code, public.debt_kind);
create or replace function public.create_wallet(
  _name text,
  _type public.wallet_type,
  _balance numeric,
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
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  resolved_credit_limit := case
    when _type = 'credit_card' then abs(coalesce(_credit_limit, 0))
    else null
  end;

  if _type = 'credit_card' and resolved_credit_limit <= 0 then
    raise exception 'Credit limit is required for a credit card.';
  end if;

  if _type = 'credit_card' and abs(_balance) > resolved_credit_limit then
    raise exception 'Current balance cannot exceed the credit limit.';
  end if;

  insert into public.wallets (
    user_id,
    name,
    type,
    cash_kind,
    debt_kind,
    balance,
    credit_limit,
    currency
  )
  values (
    auth.uid(),
    trim(_name),
    _type,
    case when _type = 'cash' then 'debit_card'::public.cash_kind else null end,
    case when _type = 'debt' then coalesce(_debt_kind, 'personal'::public.debt_kind) else null end,
    case when _type in ('credit_card', 'debt') then -abs(_balance) else abs(_balance) end,
    resolved_credit_limit,
    _currency
  )
  returning * into wallet;

  return wallet;
end;
$$;

drop function if exists public.update_wallet(uuid, text, public.wallet_type, numeric, public.currency_code, public.debt_kind);
create or replace function public.update_wallet(
  _wallet_id uuid,
  _name text,
  _type public.wallet_type,
  _balance numeric,
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
  existing_wallet public.wallets;
  updated_wallet public.wallets;
  resolved_credit_limit numeric;
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

  resolved_credit_limit := case
    when _type = 'credit_card' then abs(coalesce(_credit_limit, existing_wallet.credit_limit, 0))
    else null
  end;

  if _type = 'credit_card' and resolved_credit_limit <= 0 then
    raise exception 'Credit limit is required for a credit card.';
  end if;

  if _type = 'credit_card' and abs(_balance) > resolved_credit_limit then
    raise exception 'Current balance cannot exceed the credit limit.';
  end if;

  update public.wallets
  set
    name = trim(_name),
    type = _type,
    cash_kind = case when _type = 'cash' then coalesce(existing_wallet.cash_kind, 'debit_card'::public.cash_kind) else null end,
    debt_kind = case when _type = 'debt' then coalesce(_debt_kind, existing_wallet.debt_kind, 'personal'::public.debt_kind) else null end,
    balance = case when _type in ('credit_card', 'debt') then -abs(_balance) else abs(_balance) end,
    credit_limit = resolved_credit_limit,
    currency = _currency
  where id = _wallet_id
    and user_id = auth.uid()
  returning * into updated_wallet;

  return updated_wallet;
end;
$$;

grant execute on function public.create_wallet(text, public.wallet_type, numeric, numeric, public.currency_code, public.debt_kind) to authenticated;
grant execute on function public.update_wallet(uuid, text, public.wallet_type, numeric, numeric, public.currency_code, public.debt_kind) to authenticated;
