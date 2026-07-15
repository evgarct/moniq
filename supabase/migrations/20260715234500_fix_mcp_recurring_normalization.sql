-- Fix mcp_normalize_recurring_schedule definition to restore validation, cleaning, and correct type lookup
create or replace function public.mcp_normalize_recurring_schedule(
  p_user_id uuid,
  p_schedule jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tx_title text;
  tx_note text;
  tx_start_date date;
  tx_frequency public.finance_transaction_schedule_frequency;
  tx_interval_weeks integer;
  tx_until_date date;
  tx_kind public.finance_transaction_kind;
  tx_amount numeric;
  tx_destination_amount numeric;
  tx_fx_rate numeric;
  tx_principal_amount numeric;
  tx_interest_amount numeric;
  tx_extra_principal_amount numeric;
  tx_category_id uuid;
  tx_source_account_id uuid;
  tx_destination_account_id uuid;
  source_exists boolean;
  destination_exists boolean;
  destination_type public.wallet_type;
  category_type public.finance_category_type;
  category_has_children boolean;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if jsonb_typeof(p_schedule) <> 'object' then
    raise exception 'schedule must be an object';
  end if;

  tx_title := nullif(btrim(p_schedule->>'title'), '');
  tx_note := nullif(btrim(coalesce(p_schedule->>'note', '')), '');
  tx_start_date := (p_schedule->>'start_date')::date;
  tx_frequency := (p_schedule->>'frequency')::public.finance_transaction_schedule_frequency;
  tx_interval_weeks := greatest(1, coalesce(nullif(p_schedule->>'interval_weeks', '')::integer, 1));
  tx_until_date := nullif(p_schedule->>'until_date', '')::date;
  tx_kind := (p_schedule->>'kind')::public.finance_transaction_kind;
  tx_amount := (p_schedule->>'amount')::numeric;
  tx_destination_amount := nullif(p_schedule->>'destination_amount', '')::numeric;
  tx_fx_rate := nullif(p_schedule->>'fx_rate', '')::numeric;
  tx_principal_amount := coalesce(nullif(p_schedule->>'principal_amount', '')::numeric, 0);
  tx_interest_amount := coalesce(nullif(p_schedule->>'interest_amount', '')::numeric, 0);
  tx_extra_principal_amount := coalesce(nullif(p_schedule->>'extra_principal_amount', '')::numeric, 0);
  tx_category_id := nullif(p_schedule->>'category_id', '')::uuid;
  tx_source_account_id := nullif(p_schedule->>'source_account_id', '')::uuid;
  tx_destination_account_id := nullif(p_schedule->>'destination_account_id', '')::uuid;

  if tx_title is null then
    raise exception 'Recurring transaction must have a title';
  end if;

  if tx_start_date is null then
    raise exception 'Recurring transaction "%" must have a start_date', tx_title;
  end if;

  if tx_until_date is not null and tx_until_date < tx_start_date then
    raise exception 'Recurring transaction "%" until_date must be on or after start_date', tx_title;
  end if;

  if tx_amount is null or tx_amount <= 0 then
    raise exception 'Recurring transaction "%" must have a positive amount', tx_title;
  end if;

  if tx_frequency::text not in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly') then
    raise exception 'Recurring transaction "%" frequency is not supported', tx_title;
  end if;

  if tx_frequency::text <> 'weekly' then
    tx_interval_weeks := 1;
  end if;

  if tx_kind not in ('income', 'expense', 'transfer', 'debt_payment') then
    raise exception 'Recurring transaction "%" kind is not supported', tx_title;
  end if;

  if tx_destination_amount is not null and tx_destination_amount <= 0 then
    raise exception 'Recurring transaction "%" destination_amount must be positive when provided', tx_title;
  end if;

  if tx_fx_rate is not null and tx_fx_rate <= 0 then
    raise exception 'Recurring transaction "%" fx_rate must be positive when provided', tx_title;
  end if;

  if tx_source_account_id is not null then
    select exists (
      select 1 from public.wallets
      where id = tx_source_account_id
        and user_id = p_user_id
    ) into source_exists;

    if not source_exists then
      raise exception 'Recurring transaction "%" source account not found', tx_title;
    end if;
  end if;

  if tx_destination_account_id is not null then
    select w.type
    into destination_type
    from public.wallets w
    where w.id = tx_destination_account_id
      and w.user_id = p_user_id;

    destination_exists := destination_type is not null;
    if not destination_exists then
      raise exception 'Recurring transaction "%" destination account not found', tx_title;
    end if;
  else
    destination_type := null;
  end if;

  if tx_source_account_id is not null
    and tx_destination_account_id is not null
    and tx_source_account_id = tx_destination_account_id then
    raise exception 'Recurring transaction "%" source and destination accounts must be different', tx_title;
  end if;

  if tx_category_id is not null then
    select c.type
    into category_type
    from public.finance_categories c
    where c.id = tx_category_id
      and c.user_id = p_user_id;

    if category_type is null then
      raise exception 'Recurring transaction "%" category not found', tx_title;
    end if;

    select exists (
      select 1
      from public.finance_categories child
      where child.user_id = p_user_id
        and child.parent_id = tx_category_id
    ) into category_has_children;

    if category_has_children then
      raise exception 'Recurring transaction "%" category must be a selectable leaf category', tx_title;
    end if;
  else
    category_type := null;
  end if;

  if tx_kind = 'income' then
    if tx_destination_account_id is null then
      raise exception 'Recurring transaction "%" income must include destination_account_id', tx_title;
    end if;
    if tx_source_account_id is not null then
      raise exception 'Recurring transaction "%" income must not include source_account_id', tx_title;
    end if;
    if tx_category_id is null or category_type <> 'income' then
      raise exception 'Recurring transaction "%" income must use an income category', tx_title;
    end if;
    tx_destination_amount := null;
    tx_fx_rate := null;
    tx_principal_amount := null;
    tx_interest_amount := null;
    tx_extra_principal_amount := null;
  elsif tx_kind = 'expense' then
    if tx_source_account_id is null then
      raise exception 'Recurring transaction "%" expense must include source_account_id', tx_title;
    end if;
    if tx_destination_account_id is not null then
      raise exception 'Recurring transaction "%" expense must not include destination_account_id', tx_title;
    end if;
    if tx_category_id is null or category_type <> 'expense' then
      raise exception 'Recurring transaction "%" expense must use an expense category', tx_title;
    end if;
    tx_destination_amount := null;
    tx_fx_rate := null;
    tx_principal_amount := null;
    tx_interest_amount := null;
    tx_extra_principal_amount := null;
  elsif tx_kind = 'transfer' then
    if tx_source_account_id is null or tx_destination_account_id is null then
      raise exception 'Recurring transaction "%" transfer must include source_account_id and destination_account_id', tx_title;
    end if;
    if tx_category_id is not null then
      raise exception 'Recurring transaction "%" transfer must not include category_id', tx_title;
    end if;
    tx_destination_amount := coalesce(tx_destination_amount, tx_amount);
    tx_principal_amount := null;
    tx_interest_amount := null;
    tx_extra_principal_amount := null;
  elsif tx_kind = 'debt_payment' then
    if tx_source_account_id is null or tx_destination_account_id is null then
      raise exception 'Recurring transaction "%" debt_payment must include source_account_id and destination_account_id', tx_title;
    end if;
    if destination_type <> 'debt' then
      raise exception 'Recurring transaction "%" debt_payment destination must be a debt wallet', tx_title;
    end if;
    if tx_principal_amount < 0 or tx_interest_amount < 0 or tx_extra_principal_amount < 0 then
      raise exception 'Recurring transaction "%" debt payment breakdown values must be non-negative', tx_title;
    end if;
    if tx_principal_amount + tx_interest_amount + tx_extra_principal_amount <= 0 then
      raise exception 'Recurring transaction "%" debt_payment must include at least one breakdown amount', tx_title;
    end if;
    if abs((tx_principal_amount + tx_interest_amount + tx_extra_principal_amount) - tx_amount) > 0.01 then
      raise exception 'Recurring transaction "%" amount must equal principal_amount + interest_amount + extra_principal_amount', tx_title;
    end if;
    if tx_category_id is not null and category_type <> 'expense' then
      raise exception 'Recurring transaction "%" debt_payment category must be an expense category', tx_title;
    end if;
    tx_destination_amount := null;
    tx_fx_rate := null;
  end if;

  return jsonb_build_object(
    'title', tx_title,
    'note', tx_note,
    'start_date', tx_start_date,
    'frequency', tx_frequency,
    'interval_weeks', tx_interval_weeks,
    'until_date', tx_until_date,
    'kind', tx_kind,
    'amount', tx_amount,
    'destination_amount', tx_destination_amount,
    'fx_rate', tx_fx_rate,
    'principal_amount', tx_principal_amount,
    'interest_amount', tx_interest_amount,
    'extra_principal_amount', tx_extra_principal_amount,
    'category_id', tx_category_id,
    'source_account_id', tx_source_account_id,
    'destination_account_id', tx_destination_account_id
  );
end;
$$;

-- Repair any transfer schedules with null destination_amount created while the bug was active
update public.finance_transaction_schedules
set destination_amount = amount
where kind = 'transfer'
  and destination_amount is null;
