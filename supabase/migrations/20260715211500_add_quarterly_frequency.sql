do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'finance_transaction_schedule_frequency'
      and e.enumlabel = 'quarterly'
  ) then
    alter type public.finance_transaction_schedule_frequency add value 'quarterly';
  end if;
end $$;

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
      when p_frequency::text = 'quarterly' then
        (
          (extract(year from p_occurrence_date)::integer * 12 + extract(month from p_occurrence_date)::integer)
          - (extract(year from p_start_date)::integer * 12 + extract(month from p_start_date)::integer)
        ) % 3 = 0
        and p_occurrence_date = make_date(
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

  select quarterly_occurrence.occurrence_date
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
    ) / 3
  ) quarter_index
  cross join lateral (
    select (date_trunc('month', p_start_date)::date + ((quarter_index * 3)::text || ' months')::interval)::date as target_month
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
  ) quarterly_occurrence
  where p_frequency::text = 'quarterly'
    and quarterly_occurrence.occurrence_date >= p_range_start
    and quarterly_occurrence.occurrence_date <= range_end

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

  if tx_kind = 'income' then
    if tx_source_account_id is not null then
      raise exception 'Recurring transaction "%" income must not include source_account_id', tx_title;
    end if;
    if tx_destination_account_id is null then
      raise exception 'Recurring transaction "%" income must include destination_account_id', tx_title;
    end if;
  elsif tx_kind = 'expense' then
    if tx_source_account_id is null then
      raise exception 'Recurring transaction "%" expense must include source_account_id', tx_title;
    end if;
    if tx_destination_account_id is not null then
      raise exception 'Recurring transaction "%" expense must not include destination_account_id', tx_title;
    end if;
  elsif tx_kind = 'transfer' then
    if tx_source_account_id is null then
      raise exception 'Recurring transaction "%" transfer must include source_account_id', tx_title;
    end if;
    if tx_destination_account_id is null then
      raise exception 'Recurring transaction "%" transfer must include destination_account_id', tx_title;
    end if;
    if tx_category_id is not null then
      raise exception 'Recurring transaction "%" transfer must not include category_id', tx_title;
    end if;
  elsif tx_kind = 'debt_payment' then
    if tx_source_account_id is null then
      raise exception 'Recurring transaction "%" debt payment must include source_account_id', tx_title;
    end if;
    if tx_destination_account_id is null then
      raise exception 'Recurring transaction "%" debt payment must include destination_account_id', tx_title;
    end if;
    if destination_type <> 'debt' then
      raise exception 'Recurring transaction "%" debt payment destination account must be of debt type', tx_title;
    end if;
  end if;

  if tx_category_id is not null then
    select c.kind, exists (select 1 from public.finance_categories child where child.parent_id = c.id)
    into category_type, category_has_children
    from public.finance_categories c
    where c.id = tx_category_id
      and c.user_id = p_user_id;

    if category_type is null then
      raise exception 'Recurring transaction "%" category not found', tx_title;
    end if;

    if category_has_children then
      raise exception 'Recurring transaction "%" cannot use parent category', tx_title;
    end if;

    if tx_kind = 'income' and category_type <> 'income' then
      raise exception 'Recurring transaction "%" income must use income category', tx_title;
    elsif tx_kind = 'expense' and category_type <> 'expense' then
      raise exception 'Recurring transaction "%" expense must use expense category', tx_title;
    end if;
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
