create or replace function public.mcp_recurring_key_user_id(p_key_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
begin
  select user_id
  into key_user_id
  from public.mcp_api_keys
  where key_hash = p_key_hash
  limit 1;

  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  return key_user_id;
end;
$$;

create or replace function public.mcp_schedule_has_occurrence(
  p_start_date date,
  p_frequency public.finance_transaction_schedule_frequency,
  p_until_date date,
  p_occurrence_date date
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    p_occurrence_date is not null
    and p_occurrence_date >= p_start_date
    and (p_until_date is null or p_occurrence_date <= p_until_date)
    and case
      when p_frequency = 'daily' then true
      when p_frequency = 'weekly' then ((p_occurrence_date - p_start_date) % 7) = 0
      when p_frequency = 'monthly' then
        p_occurrence_date = make_date(
          extract(year from p_occurrence_date)::integer,
          extract(month from p_occurrence_date)::integer,
          least(
            extract(day from p_start_date)::integer,
            extract(day from (date_trunc('month', p_occurrence_date)::date + interval '1 month - 1 day'))::integer
          )
        )
      else false
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

  if tx_frequency not in ('daily', 'weekly', 'monthly') then
    raise exception 'Recurring transaction "%" frequency is not supported', tx_title;
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

create or replace function public.mcp_materialize_recurring_occurrence(
  p_user_id uuid,
  p_schedule_id uuid,
  p_occurrence_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  schedule_row public.finance_transaction_schedules%rowtype;
  tx_id uuid;
begin
  select id
  into tx_id
  from public.finance_transactions
  where user_id = p_user_id
    and schedule_id = p_schedule_id
    and schedule_occurrence_date = p_occurrence_date
  limit 1;

  if tx_id is not null then
    return tx_id;
  end if;

  select *
  into schedule_row
  from public.finance_transaction_schedules
  where id = p_schedule_id
    and user_id = p_user_id;

  if schedule_row.id is null then
    raise exception 'Recurring transaction series not found';
  end if;

  if not public.mcp_schedule_has_occurrence(
    schedule_row.start_date,
    schedule_row.frequency,
    schedule_row.until_date,
    p_occurrence_date
  ) then
    raise exception 'Occurrence date does not belong to this recurring transaction series';
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
    schedule_id,
    schedule_occurrence_date,
    is_schedule_override
  )
  values (
    p_user_id,
    schedule_row.title,
    schedule_row.note,
    p_occurrence_date,
    'planned',
    schedule_row.kind,
    schedule_row.amount,
    schedule_row.destination_amount,
    schedule_row.fx_rate,
    schedule_row.principal_amount,
    schedule_row.interest_amount,
    schedule_row.extra_principal_amount,
    schedule_row.category_id,
    schedule_row.source_account_id,
    schedule_row.destination_account_id,
    schedule_row.allocation_id,
    schedule_row.id,
    p_occurrence_date,
    false
  )
  returning id into tx_id;

  return tx_id;
end;
$$;

create or replace function public.mcp_get_recurring_transaction_schedules(
  p_key_hash text,
  p_states text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
begin
  if p_states is not null and exists (
    select 1 from unnest(p_states) state where state not in ('active', 'paused')
  ) then
    raise exception 'states must contain only active or paused';
  end if;

  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  return jsonb_build_object(
    'schedules',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'title', s.title,
            'note', s.note,
            'start_date', s.start_date,
            'frequency', s.frequency,
            'until_date', s.until_date,
            'state', s.state,
            'kind', s.kind,
            'amount', s.amount,
            'destination_amount', s.destination_amount,
            'fx_rate', s.fx_rate,
            'principal_amount', s.principal_amount,
            'interest_amount', s.interest_amount,
            'extra_principal_amount', s.extra_principal_amount,
            'category_id', s.category_id,
            'category_name', c.name,
            'source_account_id', s.source_account_id,
            'source_account_name', source_wallet.name,
            'destination_account_id', s.destination_account_id,
            'destination_account_name', destination_wallet.name,
            'currency', coalesce(source_wallet.currency, destination_wallet.currency),
            'created_at', s.created_at,
            'updated_at', s.updated_at
          )
          order by s.created_at desc
        )
        from public.finance_transaction_schedules s
        left join public.wallets source_wallet
          on source_wallet.id = s.source_account_id and source_wallet.user_id = key_user_id
        left join public.wallets destination_wallet
          on destination_wallet.id = s.destination_account_id and destination_wallet.user_id = key_user_id
        left join public.finance_categories c
          on c.id = s.category_id and c.user_id = key_user_id
        where s.user_id = key_user_id
          and (p_states is null or s.state::text = any(p_states))
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.mcp_create_recurring_transaction_schedule(
  p_key_hash text,
  p_schedule jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  normalized jsonb;
  schedule_id uuid;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);
  normalized := public.mcp_normalize_recurring_schedule(key_user_id, p_schedule);

  insert into public.finance_transaction_schedules (
    user_id,
    title,
    note,
    start_date,
    frequency,
    until_date,
    state,
    kind,
    amount,
    destination_amount,
    fx_rate,
    principal_amount,
    interest_amount,
    extra_principal_amount,
    category_id,
    source_account_id,
    destination_account_id
  )
  values (
    key_user_id,
    normalized->>'title',
    normalized->>'note',
    (normalized->>'start_date')::date,
    (normalized->>'frequency')::public.finance_transaction_schedule_frequency,
    nullif(normalized->>'until_date', '')::date,
    'active',
    (normalized->>'kind')::public.finance_transaction_kind,
    (normalized->>'amount')::numeric,
    nullif(normalized->>'destination_amount', '')::numeric,
    nullif(normalized->>'fx_rate', '')::numeric,
    nullif(normalized->>'principal_amount', '')::numeric,
    nullif(normalized->>'interest_amount', '')::numeric,
    nullif(normalized->>'extra_principal_amount', '')::numeric,
    nullif(normalized->>'category_id', '')::uuid,
    nullif(normalized->>'source_account_id', '')::uuid,
    nullif(normalized->>'destination_account_id', '')::uuid
  )
  returning id into schedule_id;

  return jsonb_build_object('schedule_id', schedule_id);
end;
$$;

create or replace function public.mcp_update_recurring_transaction_schedule(
  p_key_hash text,
  p_schedule_id uuid,
  p_schedule jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  normalized jsonb;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);
  normalized := public.mcp_normalize_recurring_schedule(key_user_id, p_schedule);

  update public.finance_transaction_schedules
  set
    title = normalized->>'title',
    note = normalized->>'note',
    start_date = (normalized->>'start_date')::date,
    frequency = (normalized->>'frequency')::public.finance_transaction_schedule_frequency,
    until_date = nullif(normalized->>'until_date', '')::date,
    kind = (normalized->>'kind')::public.finance_transaction_kind,
    amount = (normalized->>'amount')::numeric,
    destination_amount = nullif(normalized->>'destination_amount', '')::numeric,
    fx_rate = nullif(normalized->>'fx_rate', '')::numeric,
    principal_amount = nullif(normalized->>'principal_amount', '')::numeric,
    interest_amount = nullif(normalized->>'interest_amount', '')::numeric,
    extra_principal_amount = nullif(normalized->>'extra_principal_amount', '')::numeric,
    category_id = nullif(normalized->>'category_id', '')::uuid,
    source_account_id = nullif(normalized->>'source_account_id', '')::uuid,
    destination_account_id = nullif(normalized->>'destination_account_id', '')::uuid
  where id = p_schedule_id
    and user_id = key_user_id;

  if not found then
    raise exception 'Recurring transaction series not found';
  end if;

  update public.finance_transactions
  set
    title = normalized->>'title',
    note = normalized->>'note',
    kind = (normalized->>'kind')::public.finance_transaction_kind,
    amount = (normalized->>'amount')::numeric,
    destination_amount = nullif(normalized->>'destination_amount', '')::numeric,
    fx_rate = nullif(normalized->>'fx_rate', '')::numeric,
    principal_amount = nullif(normalized->>'principal_amount', '')::numeric,
    interest_amount = nullif(normalized->>'interest_amount', '')::numeric,
    extra_principal_amount = nullif(normalized->>'extra_principal_amount', '')::numeric,
    category_id = nullif(normalized->>'category_id', '')::uuid,
    source_account_id = nullif(normalized->>'source_account_id', '')::uuid,
    destination_account_id = nullif(normalized->>'destination_account_id', '')::uuid
  where user_id = key_user_id
    and schedule_id = p_schedule_id
    and status = 'planned'
    and is_schedule_override = false;

  delete from public.finance_transactions t
  where t.user_id = key_user_id
    and t.schedule_id = p_schedule_id
    and t.status = 'planned'
    and t.is_schedule_override = false
    and not public.mcp_schedule_has_occurrence(
      (normalized->>'start_date')::date,
      (normalized->>'frequency')::public.finance_transaction_schedule_frequency,
      nullif(normalized->>'until_date', '')::date,
      t.schedule_occurrence_date
    );

  return jsonb_build_object('schedule_id', p_schedule_id);
end;
$$;

create or replace function public.mcp_reschedule_recurring_transaction_series_from_occurrence(
  p_key_hash text,
  p_schedule_id uuid,
  p_from_occurrence_date date,
  p_new_occurrence_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  schedule_start date;
  offset_days integer;
  new_start_date date;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  select start_date
  into schedule_start
  from public.finance_transaction_schedules
  where id = p_schedule_id
    and user_id = key_user_id;

  if schedule_start is null then
    raise exception 'Recurring transaction series not found';
  end if;

  offset_days := p_new_occurrence_date - p_from_occurrence_date;
  new_start_date := schedule_start + offset_days;

  update public.finance_transaction_schedules
  set start_date = new_start_date
  where id = p_schedule_id
    and user_id = key_user_id;

  delete from public.finance_transactions
  where user_id = key_user_id
    and schedule_id = p_schedule_id
    and status = 'planned'
    and is_schedule_override = false
    and occurred_at >= p_from_occurrence_date;

  delete from public.finance_transactions
  where user_id = key_user_id
    and schedule_id = p_schedule_id
    and status = 'planned'
    and is_schedule_override = true
    and schedule_occurrence_date >= p_from_occurrence_date;

  return jsonb_build_object('schedule_id', p_schedule_id, 'start_date', new_start_date);
end;
$$;

create or replace function public.mcp_update_recurring_transaction_occurrence(
  p_key_hash text,
  p_transaction_id uuid,
  p_schedule_id uuid,
  p_occurrence_date date,
  p_transaction jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  tx_id uuid;
  result jsonb;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  if p_transaction_id is not null then
    select id
    into tx_id
    from public.finance_transactions
    where id = p_transaction_id
      and user_id = key_user_id
      and schedule_id is not null;

    if tx_id is null then
      raise exception 'Recurring occurrence not found';
    end if;
  else
    tx_id := public.mcp_materialize_recurring_occurrence(key_user_id, p_schedule_id, p_occurrence_date);
  end if;

  result := public.mcp_create_transactions(key_user_id, jsonb_build_array(p_transaction));

  update public.finance_transactions target
  set
    title = created.title,
    note = created.note,
    occurred_at = created.occurred_at,
    status = created.status,
    kind = created.kind,
    amount = created.amount,
    destination_amount = created.destination_amount,
    fx_rate = created.fx_rate,
    principal_amount = created.principal_amount,
    interest_amount = created.interest_amount,
    extra_principal_amount = created.extra_principal_amount,
    category_id = created.category_id,
    source_account_id = created.source_account_id,
    destination_account_id = created.destination_account_id,
    is_schedule_override = true
  from public.finance_transactions created
  where created.id = ((result #>> '{created,0,id}')::uuid)
    and target.id = tx_id
    and target.user_id = key_user_id;

  delete from public.finance_transactions
  where id = ((result #>> '{created,0,id}')::uuid)
    and user_id = key_user_id;

  return jsonb_build_object('transaction_id', tx_id);
end;
$$;

create or replace function public.mcp_set_recurring_transaction_occurrence_status(
  p_key_hash text,
  p_transaction_id uuid,
  p_schedule_id uuid,
  p_occurrence_date date,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  tx_id uuid;
begin
  if p_status not in ('paid', 'skipped') then
    raise exception 'status must be paid or skipped';
  end if;

  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  if p_transaction_id is not null then
    select id
    into tx_id
    from public.finance_transactions
    where id = p_transaction_id
      and user_id = key_user_id
      and schedule_id is not null;

    if tx_id is null then
      raise exception 'Recurring occurrence not found';
    end if;
  else
    tx_id := public.mcp_materialize_recurring_occurrence(key_user_id, p_schedule_id, p_occurrence_date);
  end if;

  update public.finance_transactions
  set status = p_status::public.finance_transaction_status
  where id = tx_id
    and user_id = key_user_id;

  return jsonb_build_object('transaction_id', tx_id, 'status', p_status);
end;
$$;

create or replace function public.mcp_set_recurring_transaction_schedule_state(
  p_key_hash text,
  p_schedule_id uuid,
  p_state text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
begin
  if p_state not in ('active', 'paused') then
    raise exception 'state must be active or paused';
  end if;

  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  update public.finance_transaction_schedules
  set state = p_state::public.finance_transaction_schedule_state
  where id = p_schedule_id
    and user_id = key_user_id;

  if not found then
    raise exception 'Recurring transaction series not found';
  end if;

  return jsonb_build_object('schedule_id', p_schedule_id, 'state', p_state);
end;
$$;

create or replace function public.mcp_delete_recurring_transaction_schedule(
  p_key_hash text,
  p_schedule_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  delete from public.finance_transactions
  where user_id = key_user_id
    and schedule_id = p_schedule_id
    and status <> 'paid'
    and schedule_occurrence_date >= current_date;

  delete from public.finance_transaction_schedules
  where id = p_schedule_id
    and user_id = key_user_id;

  if not found then
    raise exception 'Recurring transaction series not found';
  end if;

  return jsonb_build_object('schedule_id', p_schedule_id, 'deleted', true);
end;
$$;

revoke all on function public.mcp_recurring_key_user_id(text) from public, anon, authenticated;
revoke all on function public.mcp_schedule_has_occurrence(date, public.finance_transaction_schedule_frequency, date, date) from public, anon, authenticated;
revoke all on function public.mcp_normalize_recurring_schedule(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.mcp_materialize_recurring_occurrence(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.mcp_get_recurring_transaction_schedules(text, text[]) from public;
revoke all on function public.mcp_create_recurring_transaction_schedule(text, jsonb) from public;
revoke all on function public.mcp_update_recurring_transaction_schedule(text, uuid, jsonb) from public;
revoke all on function public.mcp_reschedule_recurring_transaction_series_from_occurrence(text, uuid, date, date) from public;
revoke all on function public.mcp_update_recurring_transaction_occurrence(text, uuid, uuid, date, jsonb) from public;
revoke all on function public.mcp_set_recurring_transaction_occurrence_status(text, uuid, uuid, date, text) from public;
revoke all on function public.mcp_set_recurring_transaction_schedule_state(text, uuid, text) from public;
revoke all on function public.mcp_delete_recurring_transaction_schedule(text, uuid) from public;

grant execute on function public.mcp_get_recurring_transaction_schedules(text, text[]) to anon, authenticated;
grant execute on function public.mcp_create_recurring_transaction_schedule(text, jsonb) to anon, authenticated;
grant execute on function public.mcp_update_recurring_transaction_schedule(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.mcp_reschedule_recurring_transaction_series_from_occurrence(text, uuid, date, date) to anon, authenticated;
grant execute on function public.mcp_update_recurring_transaction_occurrence(text, uuid, uuid, date, jsonb) to anon, authenticated;
grant execute on function public.mcp_set_recurring_transaction_occurrence_status(text, uuid, uuid, date, text) to anon, authenticated;
grant execute on function public.mcp_set_recurring_transaction_schedule_state(text, uuid, text) to anon, authenticated;
grant execute on function public.mcp_delete_recurring_transaction_schedule(text, uuid) to anon, authenticated;
