do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'finance_transaction_schedule_frequency'
      and e.enumlabel = 'yearly'
  ) then
    alter type public.finance_transaction_schedule_frequency add value 'yearly';
  end if;
end $$;

alter table public.finance_transaction_schedules
  add column if not exists interval_weeks integer not null default 1;

update public.finance_transaction_schedules
set interval_weeks = 1
where frequency::text <> 'weekly'
  and interval_weeks <> 1;

alter table public.finance_transaction_schedules
  drop constraint if exists finance_transaction_schedules_interval_weeks_check,
  add constraint finance_transaction_schedules_interval_weeks_check
    check (interval_weeks >= 1 and (frequency::text = 'weekly' or interval_weeks = 1));

create or replace function public.mcp_schedule_has_occurrence(
  p_start_date date,
  p_frequency public.finance_transaction_schedule_frequency,
  p_until_date date,
  p_occurrence_date date,
  p_interval_weeks integer default 1
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
      when p_frequency::text = 'daily' then true
      when p_frequency::text = 'weekly' then ((p_occurrence_date - p_start_date) % (7 * greatest(1, coalesce(p_interval_weeks, 1)))) = 0
      when p_frequency::text = 'monthly' then
        p_occurrence_date = make_date(
          extract(year from p_occurrence_date)::integer,
          extract(month from p_occurrence_date)::integer,
          least(
            extract(day from p_start_date)::integer,
            extract(day from (date_trunc('month', p_occurrence_date)::date + interval '1 month - 1 day'))::integer
          )
        )
      when p_frequency::text = 'yearly' then
        extract(month from p_occurrence_date)::integer = extract(month from p_start_date)::integer
        and p_occurrence_date = make_date(
          extract(year from p_occurrence_date)::integer,
          extract(month from p_start_date)::integer,
          least(
            extract(day from p_start_date)::integer,
            extract(day from (date_trunc('month', make_date(extract(year from p_occurrence_date)::integer, extract(month from p_start_date)::integer, 1))::date + interval '1 month - 1 day'))::integer
          )
        )
      else false
    end;
$$;

create or replace function public.mcp_schedule_occurrences(
  p_start_date date,
  p_frequency public.finance_transaction_schedule_frequency,
  p_interval_weeks integer,
  p_until_date date,
  p_range_start date,
  p_range_end date
)
returns table(occurrence_date date)
language sql
stable
set search_path = public
as $$
  with bounds as (
    select
      greatest(p_start_date, p_range_start) as range_start,
      least(coalesce(p_until_date, p_range_end), p_range_end) as range_end,
      greatest(1, coalesce(p_interval_weeks, 1)) as weekly_interval
  )
  select gs::date
  from bounds
  cross join generate_series(range_start, range_end, interval '1 day') gs
  where p_frequency::text = 'daily'

  union all

  select gs::date
  from bounds
  cross join generate_series(
    (
      p_start_date
      + (
        greatest(0, ceil(((p_range_start - p_start_date)::numeric) / (7.0 * weekly_interval))::integer)
        * 7
        * weekly_interval
      )
    )::date,
    range_end,
    make_interval(weeks => weekly_interval)
  ) gs
  where p_frequency::text = 'weekly'

  union all

  select monthly_occurrence.occurrence_date
  from bounds
  cross join generate_series(
    0,
    greatest(
      0,
      (
        (extract(year from range_end)::integer * 12)
        + extract(month from range_end)::integer
      )
      -
      (
        (extract(year from p_start_date)::integer * 12)
        + extract(month from p_start_date)::integer
      )
    )
  ) month_index
  cross join lateral (
    select (date_trunc('month', p_start_date)::date + (month_index::text || ' months')::interval)::date as target_month
  ) target
  cross join lateral (
    select make_date(
      extract(year from target.target_month)::integer,
      extract(month from target.target_month)::integer,
      least(
        extract(day from p_start_date)::integer,
        extract(day from (date_trunc('month', target.target_month)::date + interval '1 month - 1 day'))::integer
      )
    )::date as occurrence_date
  ) monthly_occurrence
  where p_frequency::text = 'monthly'
    and monthly_occurrence.occurrence_date >= p_range_start
    and monthly_occurrence.occurrence_date <= range_end

  union all

  select yearly_occurrence.occurrence_date
  from bounds
  cross join generate_series(
    0,
    greatest(0, extract(year from range_end)::integer - extract(year from p_start_date)::integer)
  ) year_index
  cross join lateral (
    select make_date(
      extract(year from p_start_date)::integer + year_index,
      extract(month from p_start_date)::integer,
      1
    ) as target_month
  ) target
  cross join lateral (
    select make_date(
      extract(year from target.target_month)::integer,
      extract(month from target.target_month)::integer,
      least(
        extract(day from p_start_date)::integer,
        extract(day from (date_trunc('month', target.target_month)::date + interval '1 month - 1 day'))::integer
      )
    )::date as occurrence_date
  ) yearly_occurrence
  where p_frequency::text = 'yearly'
    and yearly_occurrence.occurrence_date >= p_range_start
    and yearly_occurrence.occurrence_date <= range_end;
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

  if tx_frequency::text not in ('daily', 'weekly', 'monthly', 'yearly') then
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
    p_occurrence_date,
    schedule_row.interval_weeks
  ) then
    raise exception 'Occurrence date does not belong to this recurring transaction series';
  end if;

  insert into public.finance_transactions (
    user_id, title, note, occurred_at, status, kind, amount, destination_amount, fx_rate,
    principal_amount, interest_amount, extra_principal_amount, category_id, source_account_id,
    destination_account_id, allocation_id, schedule_id, schedule_occurrence_date, is_schedule_override
  )
  values (
    p_user_id, schedule_row.title, schedule_row.note, p_occurrence_date, 'planned', schedule_row.kind,
    schedule_row.amount, schedule_row.destination_amount, schedule_row.fx_rate, schedule_row.principal_amount,
    schedule_row.interest_amount, schedule_row.extra_principal_amount, schedule_row.category_id,
    schedule_row.source_account_id, schedule_row.destination_account_id, schedule_row.allocation_id,
    schedule_row.id, p_occurrence_date, false
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
            'interval_weeks', s.interval_weeks,
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
    user_id, title, note, start_date, frequency, interval_weeks, until_date, state, kind, amount,
    destination_amount, fx_rate, principal_amount, interest_amount, extra_principal_amount,
    category_id, source_account_id, destination_account_id
  )
  values (
    key_user_id,
    normalized->>'title',
    normalized->>'note',
    (normalized->>'start_date')::date,
    (normalized->>'frequency')::public.finance_transaction_schedule_frequency,
    (normalized->>'interval_weeks')::integer,
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
    interval_weeks = (normalized->>'interval_weeks')::integer,
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
      t.schedule_occurrence_date,
      (normalized->>'interval_weeks')::integer
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
  schedule_frequency public.finance_transaction_schedule_frequency;
  schedule_until date;
  schedule_interval_weeks integer;
  offset_days integer;
  new_start_date date;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  select start_date, frequency, until_date, interval_weeks
  into schedule_start, schedule_frequency, schedule_until, schedule_interval_weeks
  from public.finance_transaction_schedules
  where id = p_schedule_id
    and user_id = key_user_id;

  if schedule_start is null then
    raise exception 'Recurring transaction series not found';
  end if;

  if not public.mcp_schedule_has_occurrence(
    schedule_start,
    schedule_frequency,
    schedule_until,
    p_from_occurrence_date,
    schedule_interval_weeks
  ) then
    raise exception 'From occurrence date does not belong to this recurring transaction series';
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

create or replace function public.mcp_get_transactions_for_period(
  p_key_hash text,
  p_start_date date,
  p_end_date date,
  p_statuses text[] default null,
  p_kinds text[] default null,
  p_account_ids text[] default null,
  p_category_ids text[] default null,
  p_include_context boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  max_transactions integer := 5000;
  returned_transaction_count integer;
  response jsonb;
begin
  if p_start_date is null or p_end_date is null then
    raise exception 'start_date and end_date are required';
  end if;

  if p_start_date > p_end_date then
    raise exception 'start_date must be on or before end_date';
  end if;

  if p_statuses is not null and exists (select 1 from unnest(p_statuses) status where status not in ('paid', 'planned', 'skipped')) then
    raise exception 'statuses must contain only paid, planned, or skipped';
  end if;

  if p_kinds is not null and exists (select 1 from unnest(p_kinds) kind where kind not in ('income', 'expense', 'transfer', 'debt_payment')) then
    raise exception 'kinds must contain only income, expense, transfer, or debt_payment';
  end if;

  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  with
  materialized_occurrences as (
    select t.schedule_id, t.schedule_occurrence_date
    from public.finance_transactions t
    where t.user_id = key_user_id
      and t.schedule_id is not null
      and t.schedule_occurrence_date is not null
      and t.schedule_occurrence_date >= p_start_date
      and t.schedule_occurrence_date <= p_end_date
  ),
  actual_transactions as (
    select
      t.id::text as sort_id,
      t.occurred_at,
      t.created_at,
      t.status::text as status,
      t.kind::text as kind,
      coalesce(source_wallet.currency, destination_wallet.currency)::text as currency,
      t.amount,
      jsonb_build_object(
        'id', t.id,
        'source', 'ledger',
        'is_generated', false,
        'user_id', t.user_id,
        'title', t.title,
        'note', t.note,
        'occurred_at', t.occurred_at,
        'created_at', t.created_at,
        'status', t.status,
        'kind', t.kind,
        'amount', t.amount,
        'destination_amount', t.destination_amount,
        'fx_rate', t.fx_rate,
        'principal_amount', t.principal_amount,
        'interest_amount', t.interest_amount,
        'extra_principal_amount', t.extra_principal_amount,
        'category_id', t.category_id,
        'category_name', category.name,
        'source_account_id', t.source_account_id,
        'source_account_name', source_wallet.name,
        'destination_account_id', t.destination_account_id,
        'destination_account_name', destination_wallet.name,
        'currency', coalesce(source_wallet.currency, destination_wallet.currency),
        'schedule_id', t.schedule_id,
        'schedule_occurrence_date', t.schedule_occurrence_date,
        'is_schedule_override', t.is_schedule_override
      ) as payload
    from public.finance_transactions t
    left join public.wallets source_wallet on source_wallet.id = t.source_account_id and source_wallet.user_id = key_user_id
    left join public.wallets destination_wallet on destination_wallet.id = t.destination_account_id and destination_wallet.user_id = key_user_id
    left join public.finance_categories category on category.id = t.category_id and category.user_id = key_user_id
    where t.user_id = key_user_id
      and t.occurred_at >= p_start_date
      and t.occurred_at <= p_end_date
      and (p_statuses is null or t.status::text = any(p_statuses))
      and (p_kinds is null or t.kind::text = any(p_kinds))
      and (p_account_ids is null or t.source_account_id::text = any(p_account_ids) or t.destination_account_id::text = any(p_account_ids))
      and (p_category_ids is null or t.category_id::text = any(p_category_ids))
  ),
  active_schedules as (
    select
      s.*,
      coalesce(source_wallet.currency, destination_wallet.currency)::text as currency,
      category.name as category_name,
      source_wallet.name as source_account_name,
      destination_wallet.name as destination_account_name
    from public.finance_transaction_schedules s
    left join public.wallets source_wallet on source_wallet.id = s.source_account_id and source_wallet.user_id = key_user_id
    left join public.wallets destination_wallet on destination_wallet.id = s.destination_account_id and destination_wallet.user_id = key_user_id
    left join public.finance_categories category on category.id = s.category_id and category.user_id = key_user_id
    where s.user_id = key_user_id
      and s.state = 'active'
      and s.start_date <= p_end_date
      and (s.until_date is null or s.until_date >= p_start_date)
      and (p_statuses is null or 'planned' = any(p_statuses))
      and (p_kinds is null or s.kind::text = any(p_kinds))
      and (p_account_ids is null or s.source_account_id::text = any(p_account_ids) or s.destination_account_id::text = any(p_account_ids))
      and (p_category_ids is null or s.category_id::text = any(p_category_ids))
  ),
  generated_occurrences as (
    select
      ('schedule:' || s.id::text || ':' || occurrence.occurrence_date::text) as sort_id,
      occurrence.occurrence_date as occurred_at,
      s.created_at,
      'planned'::text as status,
      s.kind::text as kind,
      s.currency,
      s.amount,
      jsonb_build_object(
        'id', 'schedule:' || s.id::text || ':' || occurrence.occurrence_date::text,
        'source', 'schedule',
        'is_generated', true,
        'user_id', s.user_id,
        'title', s.title,
        'note', s.note,
        'occurred_at', occurrence.occurrence_date,
        'created_at', s.created_at,
        'status', 'planned',
        'kind', s.kind,
        'amount', s.amount,
        'destination_amount', s.destination_amount,
        'fx_rate', s.fx_rate,
        'principal_amount', s.principal_amount,
        'interest_amount', s.interest_amount,
        'extra_principal_amount', s.extra_principal_amount,
        'category_id', s.category_id,
        'category_name', s.category_name,
        'source_account_id', s.source_account_id,
        'source_account_name', s.source_account_name,
        'destination_account_id', s.destination_account_id,
        'destination_account_name', s.destination_account_name,
        'currency', s.currency,
        'schedule_id', s.id,
        'schedule_occurrence_date', occurrence.occurrence_date,
        'is_schedule_override', false
      ) as payload
    from active_schedules s
    cross join lateral public.mcp_schedule_occurrences(
      s.start_date,
      s.frequency,
      s.interval_weeks,
      s.until_date,
      p_start_date,
      p_end_date
    ) occurrence
    where not exists (
      select 1
      from materialized_occurrences existing
      where existing.schedule_id = s.id
        and existing.schedule_occurrence_date = occurrence.occurrence_date
    )
  ),
  combined_transactions as (
    select * from actual_transactions
    union all
    select * from generated_occurrences
  )
  select count(*) into returned_transaction_count from combined_transactions;

  if returned_transaction_count > max_transactions then
    raise exception 'Requested period returns % transactions, above limit %. Split the period into smaller ranges.', returned_transaction_count, max_transactions;
  end if;

  with
  materialized_occurrences as (
    select t.schedule_id, t.schedule_occurrence_date
    from public.finance_transactions t
    where t.user_id = key_user_id
      and t.schedule_id is not null
      and t.schedule_occurrence_date is not null
      and t.schedule_occurrence_date >= p_start_date
      and t.schedule_occurrence_date <= p_end_date
  ),
  actual_transactions as (
    select
      t.id::text as sort_id,
      t.occurred_at,
      t.created_at,
      t.status::text as status,
      t.kind::text as kind,
      coalesce(source_wallet.currency, destination_wallet.currency)::text as currency,
      t.amount,
      jsonb_build_object(
        'id', t.id,
        'source', 'ledger',
        'is_generated', false,
        'user_id', t.user_id,
        'title', t.title,
        'note', t.note,
        'occurred_at', t.occurred_at,
        'created_at', t.created_at,
        'status', t.status,
        'kind', t.kind,
        'amount', t.amount,
        'destination_amount', t.destination_amount,
        'fx_rate', t.fx_rate,
        'principal_amount', t.principal_amount,
        'interest_amount', t.interest_amount,
        'extra_principal_amount', t.extra_principal_amount,
        'category_id', t.category_id,
        'category_name', category.name,
        'source_account_id', t.source_account_id,
        'source_account_name', source_wallet.name,
        'destination_account_id', t.destination_account_id,
        'destination_account_name', destination_wallet.name,
        'currency', coalesce(source_wallet.currency, destination_wallet.currency),
        'schedule_id', t.schedule_id,
        'schedule_occurrence_date', t.schedule_occurrence_date,
        'is_schedule_override', t.is_schedule_override
      ) as payload
    from public.finance_transactions t
    left join public.wallets source_wallet on source_wallet.id = t.source_account_id and source_wallet.user_id = key_user_id
    left join public.wallets destination_wallet on destination_wallet.id = t.destination_account_id and destination_wallet.user_id = key_user_id
    left join public.finance_categories category on category.id = t.category_id and category.user_id = key_user_id
    where t.user_id = key_user_id
      and t.occurred_at >= p_start_date
      and t.occurred_at <= p_end_date
      and (p_statuses is null or t.status::text = any(p_statuses))
      and (p_kinds is null or t.kind::text = any(p_kinds))
      and (p_account_ids is null or t.source_account_id::text = any(p_account_ids) or t.destination_account_id::text = any(p_account_ids))
      and (p_category_ids is null or t.category_id::text = any(p_category_ids))
  ),
  active_schedules as (
    select
      s.*,
      coalesce(source_wallet.currency, destination_wallet.currency)::text as currency,
      category.name as category_name,
      source_wallet.name as source_account_name,
      destination_wallet.name as destination_account_name
    from public.finance_transaction_schedules s
    left join public.wallets source_wallet on source_wallet.id = s.source_account_id and source_wallet.user_id = key_user_id
    left join public.wallets destination_wallet on destination_wallet.id = s.destination_account_id and destination_wallet.user_id = key_user_id
    left join public.finance_categories category on category.id = s.category_id and category.user_id = key_user_id
    where s.user_id = key_user_id
      and s.state = 'active'
      and s.start_date <= p_end_date
      and (s.until_date is null or s.until_date >= p_start_date)
      and (p_statuses is null or 'planned' = any(p_statuses))
      and (p_kinds is null or s.kind::text = any(p_kinds))
      and (p_account_ids is null or s.source_account_id::text = any(p_account_ids) or s.destination_account_id::text = any(p_account_ids))
      and (p_category_ids is null or s.category_id::text = any(p_category_ids))
  ),
  generated_occurrences as (
    select
      ('schedule:' || s.id::text || ':' || occurrence.occurrence_date::text) as sort_id,
      occurrence.occurrence_date as occurred_at,
      s.created_at,
      'planned'::text as status,
      s.kind::text as kind,
      s.currency,
      s.amount,
      jsonb_build_object(
        'id', 'schedule:' || s.id::text || ':' || occurrence.occurrence_date::text,
        'source', 'schedule',
        'is_generated', true,
        'user_id', s.user_id,
        'title', s.title,
        'note', s.note,
        'occurred_at', occurrence.occurrence_date,
        'created_at', s.created_at,
        'status', 'planned',
        'kind', s.kind,
        'amount', s.amount,
        'destination_amount', s.destination_amount,
        'fx_rate', s.fx_rate,
        'principal_amount', s.principal_amount,
        'interest_amount', s.interest_amount,
        'extra_principal_amount', s.extra_principal_amount,
        'category_id', s.category_id,
        'category_name', s.category_name,
        'source_account_id', s.source_account_id,
        'source_account_name', s.source_account_name,
        'destination_account_id', s.destination_account_id,
        'destination_account_name', s.destination_account_name,
        'currency', s.currency,
        'schedule_id', s.id,
        'schedule_occurrence_date', occurrence.occurrence_date,
        'is_schedule_override', false
      ) as payload
    from active_schedules s
    cross join lateral public.mcp_schedule_occurrences(s.start_date, s.frequency, s.interval_weeks, s.until_date, p_start_date, p_end_date) occurrence
    where not exists (
      select 1 from materialized_occurrences existing
      where existing.schedule_id = s.id
        and existing.schedule_occurrence_date = occurrence.occurrence_date
    )
  ),
  combined_transactions as (
    select * from actual_transactions
    union all
    select * from generated_occurrences
  ),
  transaction_payload as (
    select coalesce(jsonb_agg(payload order by occurred_at desc, created_at desc, sort_id desc), '[]'::jsonb) as transactions
    from combined_transactions
  ),
  summary_payload as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'currency', currency,
          'transaction_count', transaction_count,
          'total_amount', total_amount,
          'income_amount', income_amount,
          'expense_amount', expense_amount,
          'transfer_amount', transfer_amount,
          'debt_payment_amount', debt_payment_amount,
          'paid_amount', paid_amount,
          'planned_amount', planned_amount,
          'skipped_amount', skipped_amount
        )
        order by currency
      ),
      '[]'::jsonb
    ) as summary_by_currency
    from (
      select
        coalesce(currency, 'unknown') as currency,
        count(*) as transaction_count,
        coalesce(sum(amount), 0) as total_amount,
        coalesce(sum(amount) filter (where kind = 'income'), 0) as income_amount,
        coalesce(sum(amount) filter (where kind = 'expense'), 0) as expense_amount,
        coalesce(sum(amount) filter (where kind = 'transfer'), 0) as transfer_amount,
        coalesce(sum(amount) filter (where kind = 'debt_payment'), 0) as debt_payment_amount,
        coalesce(sum(amount) filter (where status = 'paid'), 0) as paid_amount,
        coalesce(sum(amount) filter (where status = 'planned'), 0) as planned_amount,
        coalesce(sum(amount) filter (where status = 'skipped'), 0) as skipped_amount
      from combined_transactions
      group by coalesce(currency, 'unknown')
    ) grouped
  )
  select jsonb_build_object(
    'period', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date),
    'transactions', transaction_payload.transactions,
    'summary_by_currency', summary_payload.summary_by_currency,
    'limits', jsonb_build_object('max_transactions', max_transactions, 'returned_transactions', returned_transaction_count)
  )
  || case
    when p_include_context then jsonb_build_object(
      'accounts',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', w.id,
              'name', w.name,
              'type', w.type,
              'cash_kind', w.cash_kind,
              'debt_kind', w.debt_kind,
              'currency', w.currency,
              'balance', w.balance,
              'credit_limit', w.credit_limit
            )
            order by w.created_at desc
          )
          from public.wallets w
          where w.user_id = key_user_id
        ),
        '[]'::jsonb
      ),
      'categories',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', c.id,
              'name', c.name,
              'description', c.description,
              'icon', c.icon,
              'type', c.type,
              'parent_id', c.parent_id,
              'is_system', c.is_system
            )
            order by c.type, c.name
          )
          from public.finance_categories c
          where c.user_id = key_user_id
        ),
        '[]'::jsonb
      ),
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
              'interval_weeks', s.interval_weeks,
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
              'source_account_id', s.source_account_id,
              'destination_account_id', s.destination_account_id
            )
            order by s.created_at desc
          )
          from public.finance_transaction_schedules s
          where s.user_id = key_user_id
        ),
        '[]'::jsonb
      )
    )
    else '{}'::jsonb
  end
  into response
  from transaction_payload, summary_payload;

  return response;
end;
$$;

revoke all on function public.mcp_schedule_has_occurrence(date, public.finance_transaction_schedule_frequency, date, date, integer) from public, anon, authenticated;
revoke all on function public.mcp_schedule_occurrences(date, public.finance_transaction_schedule_frequency, integer, date, date, date) from public, anon, authenticated;
revoke all on function public.mcp_normalize_recurring_schedule(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.mcp_materialize_recurring_occurrence(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.mcp_get_transactions_for_period(text, date, date, text[], text[], text[], text[], boolean) from public;
revoke all on function public.mcp_get_recurring_transaction_schedules(text, text[]) from public;
revoke all on function public.mcp_create_recurring_transaction_schedule(text, jsonb) from public;
revoke all on function public.mcp_update_recurring_transaction_schedule(text, uuid, jsonb) from public;
revoke all on function public.mcp_reschedule_recurring_transaction_series_from_occurrence(text, uuid, date, date) from public;

grant execute on function public.mcp_get_transactions_for_period(text, date, date, text[], text[], text[], text[], boolean) to anon, authenticated;
grant execute on function public.mcp_get_recurring_transaction_schedules(text, text[]) to anon, authenticated;
grant execute on function public.mcp_create_recurring_transaction_schedule(text, jsonb) to anon, authenticated;
grant execute on function public.mcp_update_recurring_transaction_schedule(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.mcp_reschedule_recurring_transaction_series_from_occurrence(text, uuid, date, date) to anon, authenticated;
