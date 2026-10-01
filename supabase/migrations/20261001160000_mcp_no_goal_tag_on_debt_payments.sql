-- Follow-up to 20261001150000: reject goal tags on debt payments.
-- The wallet balance trigger subtracts a tagged goal only for expenses and adds for every other kind,
-- so a tagged debt payment would have increased the goal. No existing debt payment carries a goal tag.

create or replace function public.mcp_create_transactions(
  p_user_id uuid,
  p_transactions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  idx integer := 0;
  tx_id uuid;
  tx_title text;
  tx_note text;
  tx_occurred_at date;
  tx_status public.finance_transaction_status;
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
  tx_allocation_id uuid;
  tx_source_allocation_id uuid;
  source_exists boolean;
  destination_exists boolean;
  destination_type public.wallet_type;
  category_type public.finance_category_type;
  category_has_children boolean;
  created jsonb := '[]'::jsonb;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if jsonb_typeof(p_transactions) <> 'array' or jsonb_array_length(p_transactions) = 0 then
    raise exception 'transactions must be a non-empty array';
  end if;

  for item in select value from jsonb_array_elements(p_transactions)
  loop
    idx := idx + 1;

    tx_title := nullif(btrim(item->>'title'), '');
    tx_note := nullif(btrim(coalesce(item->>'note', '')), '');
    tx_occurred_at := (item->>'occurred_at')::date;
    tx_status := (item->>'status')::public.finance_transaction_status;
    tx_kind := (item->>'kind')::public.finance_transaction_kind;
    tx_amount := (item->>'amount')::numeric;
    tx_destination_amount := nullif(item->>'destination_amount', '')::numeric;
    tx_fx_rate := nullif(item->>'fx_rate', '')::numeric;
    tx_principal_amount := coalesce(nullif(item->>'principal_amount', '')::numeric, 0);
    tx_interest_amount := coalesce(nullif(item->>'interest_amount', '')::numeric, 0);
    tx_extra_principal_amount := coalesce(nullif(item->>'extra_principal_amount', '')::numeric, 0);
    tx_category_id := nullif(item->>'category_id', '')::uuid;
    tx_source_account_id := nullif(item->>'source_account_id', '')::uuid;
    tx_destination_account_id := nullif(item->>'destination_account_id', '')::uuid;
    tx_allocation_id := nullif(item->>'destination_allocation_id', '')::uuid;
    tx_source_allocation_id := nullif(item->>'source_allocation_id', '')::uuid;

    if tx_title is null then
      raise exception 'Transaction % must have a title', idx;
    end if;

    if tx_amount is null or tx_amount <= 0 then
      raise exception 'Transaction "%" must have a positive amount', tx_title;
    end if;

    if tx_status not in ('paid', 'planned') then
      raise exception 'Transaction "%" status must be paid or planned', tx_title;
    end if;

    if tx_kind not in ('income', 'expense', 'transfer', 'debt_payment') then
      raise exception 'Transaction "%" kind is not supported', tx_title;
    end if;

    if tx_destination_amount is not null and tx_destination_amount <= 0 then
      raise exception 'Transaction "%" destination_amount must be positive when provided', tx_title;
    end if;

    if tx_fx_rate is not null and tx_fx_rate <= 0 then
      raise exception 'Transaction "%" fx_rate must be positive when provided', tx_title;
    end if;

    if tx_source_account_id is not null then
      select exists (
        select 1 from public.wallets
        where id = tx_source_account_id
          and user_id = p_user_id
      ) into source_exists;

      if not source_exists then
        raise exception 'Transaction "%" source account not found', tx_title;
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
        raise exception 'Transaction "%" destination account not found', tx_title;
      end if;
    else
      destination_type := null;
    end if;

    if tx_source_account_id is not null
      and tx_destination_account_id is not null
      and tx_source_account_id = tx_destination_account_id then
      raise exception 'Transaction "%" source and destination accounts must be different', tx_title;
    end if;

    if tx_category_id is not null then
      select c.type
      into category_type
      from public.finance_categories c
      where c.id = tx_category_id
        and c.user_id = p_user_id;

      if category_type is null then
        raise exception 'Transaction "%" category not found', tx_title;
      end if;

      select exists (
        select 1
        from public.finance_categories child
        where child.user_id = p_user_id
          and child.parent_id = tx_category_id
      ) into category_has_children;

      if category_has_children then
        raise exception 'Transaction "%" category must be a selectable leaf category', tx_title;
      end if;
    else
      category_type := null;
    end if;

    if tx_source_allocation_id is not null and tx_kind <> 'transfer' then
      raise exception 'Transaction "%" source_allocation_id is only supported on transfers', tx_title;
    end if;
    if tx_allocation_id is not null and tx_kind = 'debt_payment' then
      raise exception 'Transaction "%" goal tags are not supported on debt payments', tx_title;
    end if;
    if tx_allocation_id is not null and not exists (
      select 1 from public.wallet_allocations a
      where a.id = tx_allocation_id and a.user_id = p_user_id and a.wallet_id = case when tx_kind = 'expense' then tx_source_account_id else tx_destination_account_id end
    ) then
      raise exception 'Transaction "%" destination_allocation_id must be a goal of the wallet that holds the money (source wallet for expenses, destination wallet for transfers and income)', tx_title;
    end if;
    if tx_source_allocation_id is not null and not exists (
      select 1 from public.wallet_allocations a
      where a.id = tx_source_allocation_id and a.user_id = p_user_id and a.wallet_id = tx_source_account_id
    ) then
      raise exception 'Transaction "%" source_allocation_id must be a goal of the source wallet', tx_title;
    end if;
    if tx_allocation_id is not null and tx_allocation_id = tx_source_allocation_id then
      raise exception 'Transaction "%" source and destination goals must be different', tx_title;
    end if;

    if tx_kind = 'income' then
      if tx_destination_account_id is null then
        raise exception 'Transaction "%" income must include destination_account_id', tx_title;
      end if;
      if tx_source_account_id is not null then
        raise exception 'Transaction "%" income must not include source_account_id', tx_title;
      end if;
      if tx_category_id is null or category_type <> 'income' then
        raise exception 'Transaction "%" income must use an income category', tx_title;
      end if;
      tx_destination_amount := null;
      tx_fx_rate := null;
      tx_principal_amount := null;
      tx_interest_amount := null;
      tx_extra_principal_amount := null;
    elsif tx_kind = 'expense' then
      if tx_source_account_id is null then
        raise exception 'Transaction "%" expense must include source_account_id', tx_title;
      end if;
      if tx_destination_account_id is not null then
        raise exception 'Transaction "%" expense must not include destination_account_id', tx_title;
      end if;
      if tx_category_id is null or category_type <> 'expense' then
        raise exception 'Transaction "%" expense must use an expense category', tx_title;
      end if;
      tx_destination_amount := null;
      tx_fx_rate := null;
      tx_principal_amount := null;
      tx_interest_amount := null;
      tx_extra_principal_amount := null;
    elsif tx_kind = 'transfer' then
      if tx_source_account_id is null or tx_destination_account_id is null then
        raise exception 'Transaction "%" transfer must include source_account_id and destination_account_id', tx_title;
      end if;
      if tx_category_id is not null and tx_allocation_id is null then
        raise exception 'Transaction "%" only transfers into a savings goal (destination_allocation_id) can use a category', tx_title;
      end if;
      if tx_category_id is not null and category_type <> 'expense' then
        raise exception 'Transaction "%" transfer category must be an expense category', tx_title;
      end if;
      tx_destination_amount := coalesce(tx_destination_amount, tx_amount);
      tx_principal_amount := null;
      tx_interest_amount := null;
      tx_extra_principal_amount := null;
    elsif tx_kind = 'debt_payment' then
      if tx_source_account_id is null or tx_destination_account_id is null then
        raise exception 'Transaction "%" debt_payment must include source_account_id and destination_account_id', tx_title;
      end if;
      if destination_type <> 'debt' then
        raise exception 'Transaction "%" debt_payment destination must be a debt wallet', tx_title;
      end if;
      if tx_principal_amount < 0 or tx_interest_amount < 0 or tx_extra_principal_amount < 0 then
        raise exception 'Transaction "%" debt payment breakdown values must be non-negative', tx_title;
      end if;
      if tx_principal_amount + tx_interest_amount + tx_extra_principal_amount <= 0 then
        raise exception 'Transaction "%" debt_payment must include at least one breakdown amount', tx_title;
      end if;
      if abs((tx_principal_amount + tx_interest_amount + tx_extra_principal_amount) - tx_amount) > 0.01 then
        raise exception 'Transaction "%" amount must equal principal_amount + interest_amount + extra_principal_amount', tx_title;
      end if;
      if tx_category_id is not null and category_type <> 'expense' then
        raise exception 'Transaction "%" debt_payment category must be an expense category', tx_title;
      end if;
      tx_destination_amount := null;
      tx_fx_rate := null;
    end if;

    insert into public.finance_transactions (
      user_id,
      title,
      note,
      occurred_at,
      status,
      kind,
      amount,
      destination_amount,
      fx_rate,
      principal_amount,
      interest_amount,
      extra_principal_amount,
      category_id,
      source_account_id,
      destination_account_id,
      allocation_id,
      source_allocation_id
    )
    values (
      p_user_id,
      tx_title,
      tx_note,
      tx_occurred_at,
      tx_status,
      tx_kind,
      tx_amount,
      tx_destination_amount,
      tx_fx_rate,
      tx_principal_amount,
      tx_interest_amount,
      tx_extra_principal_amount,
      tx_category_id,
      tx_source_account_id,
      tx_destination_account_id,
      tx_allocation_id,
      tx_source_allocation_id
    )
    returning id into tx_id;

    created := created || jsonb_build_array(
      jsonb_build_object(
        'id', tx_id,
        'title', tx_title,
        'kind', tx_kind,
        'amount', tx_amount,
        'occurred_at', tx_occurred_at,
        'category_id', tx_category_id,
        'destination_allocation_id', tx_allocation_id,
        'source_allocation_id', tx_source_allocation_id
      )
    );
  end loop;

  return jsonb_build_object('created', created);
end;
$$;

create or replace function public.mcp_update_transaction(
  p_key_hash text,
  p_transaction_id uuid,
  p_transaction jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  tx_title text;
  tx_note text;
  tx_occurred_at date;
  tx_status public.finance_transaction_status;
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
  tx_allocation_id uuid;
  tx_source_allocation_id uuid;
  source_exists boolean;
  destination_type public.wallet_type;
  category_type public.finance_category_type;
  category_has_children boolean;
  updated_payload jsonb;
begin
  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  if not exists (select 1 from public.finance_transactions where id = p_transaction_id and user_id = key_user_id) then
    raise exception 'Transaction not found';
  end if;

  tx_title := nullif(btrim(p_transaction->>'title'), '');
  tx_note := nullif(btrim(coalesce(p_transaction->>'note', '')), '');
  tx_occurred_at := (p_transaction->>'occurred_at')::date;
  tx_status := (p_transaction->>'status')::public.finance_transaction_status;
  tx_kind := (p_transaction->>'kind')::public.finance_transaction_kind;
  tx_amount := (p_transaction->>'amount')::numeric;
  tx_destination_amount := nullif(p_transaction->>'destination_amount', '')::numeric;
  tx_fx_rate := nullif(p_transaction->>'fx_rate', '')::numeric;
  tx_principal_amount := coalesce(nullif(p_transaction->>'principal_amount', '')::numeric, 0);
  tx_interest_amount := coalesce(nullif(p_transaction->>'interest_amount', '')::numeric, 0);
  tx_extra_principal_amount := coalesce(nullif(p_transaction->>'extra_principal_amount', '')::numeric, 0);
  tx_category_id := nullif(p_transaction->>'category_id', '')::uuid;
  tx_source_account_id := nullif(p_transaction->>'source_account_id', '')::uuid;
  tx_destination_account_id := nullif(p_transaction->>'destination_account_id', '')::uuid;

  -- Goal ids are kept when the payload omits them and cleared when sent as null.
  select t.allocation_id, t.source_allocation_id
  into tx_allocation_id, tx_source_allocation_id
  from public.finance_transactions t
  where t.id = p_transaction_id and t.user_id = key_user_id;
  if p_transaction ? 'destination_allocation_id' then
    tx_allocation_id := nullif(p_transaction->>'destination_allocation_id', '')::uuid;
  end if;
  if p_transaction ? 'source_allocation_id' then
    tx_source_allocation_id := nullif(p_transaction->>'source_allocation_id', '')::uuid;
  end if;
  -- The goal tag (allocation_id) is also valid on expenses, debt payments and income and is kept when omitted.
  if tx_kind <> 'transfer' then
    if nullif(p_transaction->>'source_allocation_id', '') is not null then
      raise exception 'Transaction "%" source_allocation_id is only supported on transfers', tx_title;
    end if;
    tx_source_allocation_id := null;
  end if;

  if tx_title is null then raise exception 'Transaction must have a title'; end if;
  if tx_amount is null or tx_amount <= 0 then raise exception 'Transaction "%" must have a positive amount', tx_title; end if;
  if tx_status not in ('paid', 'planned') then raise exception 'Transaction "%" status must be paid or planned', tx_title; end if;
  if tx_kind not in ('income', 'expense', 'transfer', 'debt_payment') then raise exception 'Transaction "%" kind is not supported', tx_title; end if;
  if tx_destination_amount is not null and tx_destination_amount <= 0 then raise exception 'Transaction "%" destination_amount must be positive when provided', tx_title; end if;
  if tx_fx_rate is not null and tx_fx_rate <= 0 then raise exception 'Transaction "%" fx_rate must be positive when provided', tx_title; end if;

  if tx_source_account_id is not null then
    select exists(select 1 from public.wallets where id = tx_source_account_id and user_id = key_user_id) into source_exists;
    if not source_exists then raise exception 'Transaction "%" source account not found', tx_title; end if;
  end if;

  if tx_destination_account_id is not null then
    select type into destination_type from public.wallets where id = tx_destination_account_id and user_id = key_user_id;
    if destination_type is null then raise exception 'Transaction "%" destination account not found', tx_title; end if;
  else
    destination_type := null;
  end if;

  if tx_source_account_id is not null and tx_destination_account_id is not null and tx_source_account_id = tx_destination_account_id then
    raise exception 'Transaction "%" source and destination accounts must be different', tx_title;
  end if;

  if tx_category_id is not null then
    select type into category_type from public.finance_categories where id = tx_category_id and user_id = key_user_id;
    if category_type is null then raise exception 'Transaction "%" category not found', tx_title; end if;
    select exists(select 1 from public.finance_categories child where child.user_id = key_user_id and child.parent_id = tx_category_id) into category_has_children;
    if category_has_children then raise exception 'Transaction "%" category must be a selectable leaf category', tx_title; end if;
  else
    category_type := null;
  end if;

  if tx_allocation_id is not null and tx_kind = 'debt_payment' then
    raise exception 'Transaction "%" goal tags are not supported on debt payments', tx_title;
  end if;
  if tx_allocation_id is not null and not exists (
    select 1 from public.wallet_allocations a
    where a.id = tx_allocation_id and a.user_id = key_user_id and a.wallet_id = case when tx_kind = 'expense' then tx_source_account_id else tx_destination_account_id end
  ) then
    raise exception 'Transaction "%" destination_allocation_id must be a goal of the wallet that holds the money (source wallet for expenses, destination wallet for transfers and income)', tx_title;
  end if;
  if tx_source_allocation_id is not null and not exists (
    select 1 from public.wallet_allocations a
    where a.id = tx_source_allocation_id and a.user_id = key_user_id and a.wallet_id = tx_source_account_id
  ) then
    raise exception 'Transaction "%" source_allocation_id must be a goal of the source wallet', tx_title;
  end if;
  if tx_allocation_id is not null and tx_allocation_id = tx_source_allocation_id then
    raise exception 'Transaction "%" source and destination goals must be different', tx_title;
  end if;

  if tx_kind = 'income' then
    if tx_destination_account_id is null then raise exception 'Transaction "%" income must include destination_account_id', tx_title; end if;
    if tx_source_account_id is not null then raise exception 'Transaction "%" income must not include source_account_id', tx_title; end if;
    if tx_category_id is null or category_type <> 'income' then raise exception 'Transaction "%" income must use an income category', tx_title; end if;
    tx_destination_amount := null; tx_fx_rate := null; tx_principal_amount := null; tx_interest_amount := null; tx_extra_principal_amount := null;
  elsif tx_kind = 'expense' then
    if tx_source_account_id is null then raise exception 'Transaction "%" expense must include source_account_id', tx_title; end if;
    if tx_destination_account_id is not null then raise exception 'Transaction "%" expense must not include destination_account_id', tx_title; end if;
    if tx_category_id is null or category_type <> 'expense' then raise exception 'Transaction "%" expense must use an expense category', tx_title; end if;
    tx_destination_amount := null; tx_fx_rate := null; tx_principal_amount := null; tx_interest_amount := null; tx_extra_principal_amount := null;
  elsif tx_kind = 'transfer' then
    if tx_source_account_id is null or tx_destination_account_id is null then raise exception 'Transaction "%" transfer must include source_account_id and destination_account_id', tx_title; end if;
    if tx_category_id is not null and tx_allocation_id is null then raise exception 'Transaction "%" only transfers into a savings goal (destination_allocation_id) can use a category', tx_title; end if;
    if tx_category_id is not null and category_type <> 'expense' then raise exception 'Transaction "%" transfer category must be an expense category', tx_title; end if;
    tx_destination_amount := coalesce(tx_destination_amount, tx_amount); tx_principal_amount := null; tx_interest_amount := null; tx_extra_principal_amount := null;
  elsif tx_kind = 'debt_payment' then
    if tx_source_account_id is null or tx_destination_account_id is null then raise exception 'Transaction "%" debt_payment must include source_account_id and destination_account_id', tx_title; end if;
    if destination_type <> 'debt' then raise exception 'Transaction "%" debt_payment destination must be a debt wallet', tx_title; end if;
    if tx_principal_amount < 0 or tx_interest_amount < 0 or tx_extra_principal_amount < 0 then raise exception 'Transaction "%" debt payment breakdown values must be non-negative', tx_title; end if;
    if tx_principal_amount + tx_interest_amount + tx_extra_principal_amount <= 0 then raise exception 'Transaction "%" debt_payment must include at least one breakdown amount', tx_title; end if;
    if abs((tx_principal_amount + tx_interest_amount + tx_extra_principal_amount) - tx_amount) > 0.01 then raise exception 'Transaction "%" amount must equal principal_amount + interest_amount + extra_principal_amount', tx_title; end if;
    if tx_category_id is not null and category_type <> 'expense' then raise exception 'Transaction "%" debt_payment category must be an expense category', tx_title; end if;
    tx_destination_amount := null; tx_fx_rate := null;
  end if;

  update public.finance_transactions
  set
    title = tx_title,
    note = tx_note,
    occurred_at = tx_occurred_at,
    status = tx_status,
    kind = tx_kind,
    amount = tx_amount,
    destination_amount = tx_destination_amount,
    fx_rate = tx_fx_rate,
    principal_amount = tx_principal_amount,
    interest_amount = tx_interest_amount,
    extra_principal_amount = tx_extra_principal_amount,
    category_id = tx_category_id,
    source_account_id = tx_source_account_id,
    destination_account_id = tx_destination_account_id,
    allocation_id = tx_allocation_id,
    source_allocation_id = tx_source_allocation_id,
    is_schedule_override = case when schedule_id is not null then true else is_schedule_override end
  where id = p_transaction_id
    and user_id = key_user_id
  returning jsonb_build_object(
    'id', id,
    'title', title,
    'kind', kind,
    'status', status,
    'amount', amount,
    'occurred_at', occurred_at,
    'category_id', category_id,
    'source_account_id', source_account_id,
    'destination_account_id', destination_account_id,
    'destination_allocation_id', allocation_id,
    'source_allocation_id', source_allocation_id
  ) into updated_payload;

  return jsonb_build_object('updated', updated_payload);
end;
$$;

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
  tx_interval_count integer;
  tx_interval_unit text;
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
  tx_allocation_id uuid;
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
  tx_interval_count := nullif(p_schedule->>'interval_count', '')::integer;
  tx_interval_unit := nullif(btrim(p_schedule->>'interval_unit'), '');
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
  tx_allocation_id := nullif(p_schedule->>'destination_allocation_id', '')::uuid;

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

  if tx_frequency::text not in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom') then
    raise exception 'Recurring transaction "%" frequency is not supported', tx_title;
  end if;

  if tx_frequency::text = 'custom' then
    if tx_interval_count is null or tx_interval_count < 1 then
      raise exception 'Recurring transaction "%" custom frequency needs interval_count of at least 1', tx_title;
    end if;
    if tx_interval_unit is null or tx_interval_unit not in ('day', 'week', 'month') then
      raise exception 'Recurring transaction "%" custom frequency needs interval_unit of day, week, or month', tx_title;
    end if;
  else
    -- Presets define their own interval. A client that echoes the stored pair back
    -- (get -> edit -> update) is fine; a conflicting pair is an error, not silently ignored.
    declare
      preset_count integer := case tx_frequency::text when 'quarterly' then 3 when 'yearly' then 12 else 1 end;
      preset_unit text := case tx_frequency::text when 'daily' then 'day' when 'weekly' then 'week' else 'month' end;
    begin
      if (tx_interval_count is not null and tx_interval_count <> preset_count)
        or (tx_interval_unit is not null and tx_interval_unit <> preset_unit) then
        raise exception 'Recurring transaction "%" interval_count and interval_unit are only for frequency custom; use frequency custom for a different interval', tx_title;
      end if;
      tx_interval_count := preset_count;
      tx_interval_unit := preset_unit;
    end;
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

  if tx_allocation_id is not null and tx_kind = 'debt_payment' then
    raise exception 'Recurring transaction "%" goal tags are not supported on debt payments', tx_title;
  end if;
  if tx_allocation_id is not null and not exists (
    select 1 from public.wallet_allocations a
    where a.id = tx_allocation_id and a.user_id = p_user_id and a.wallet_id = case when tx_kind = 'expense' then tx_source_account_id else tx_destination_account_id end
  ) then
    raise exception 'Recurring transaction "%" destination_allocation_id must be a goal of the wallet that holds the money (source wallet for expenses, destination wallet for transfers and income)', tx_title;
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
    if tx_category_id is not null and tx_allocation_id is null then
      raise exception 'Recurring transaction "%" only transfers into a savings goal (destination_allocation_id) can use a category', tx_title;
    end if;
    if tx_category_id is not null and category_type <> 'expense' then
      raise exception 'Recurring transaction "%" transfer category must be an expense category', tx_title;
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
    'interval_count', tx_interval_count,
    'interval_unit', tx_interval_unit,
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
    'destination_account_id', tx_destination_account_id,
    'allocation_id', tx_allocation_id
  );
end;
$$;
