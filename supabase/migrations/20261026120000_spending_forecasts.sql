-- Month-end spending forecast per budgeted category.
-- 1. spending_forecasts: one row per user, day and category. The daily cron (service role) is the only writer;
--    owners can read their rows. Re-running on the same day overwrites the row (upsert on the unique key).
-- 2. spending_forecast_source: service-role-only source for that cron. It takes a user id, so it is never granted
--    to anon/authenticated (unlike the key-hash MCP wrappers).
-- 3. mcp_get_spending_forecast: key-hash read of the latest stored forecast; it never calls the model.

create table if not exists public.spending_forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  forecast_date date not null,
  month date not null,
  category_id uuid not null references public.finance_categories(id) on delete cascade,
  currency public.currency_code not null,
  budget numeric(14,2) not null,
  spent_to_date numeric(14,2) not null,
  planned_remaining numeric(14,2) not null,
  forecast_p10 numeric(14,2) not null,
  forecast_p50 numeric(14,2) not null,
  forecast_p90 numeric(14,2) not null,
  baseline_runrate numeric(14,2) not null,
  status text not null check (status in ('over_likely', 'over', 'tight', 'ok')),
  expected_overrun_date date,
  method text not null check (method in ('chronos', 'baseline')),
  model text,
  created_at timestamptz not null default now(),
  constraint spending_forecasts_unique_day unique (user_id, forecast_date, category_id),
  constraint spending_forecasts_month_first_day check (month = date_trunc('month', month)::date)
);

create index if not exists spending_forecasts_user_date_idx
  on public.spending_forecasts (user_id, forecast_date desc);

alter table public.spending_forecasts enable row level security;

drop policy if exists "Users read own spending forecasts" on public.spending_forecasts;
create policy "Users read own spending forecasts"
  on public.spending_forecasts for select
  using (auth.uid() = user_id);

revoke all on table public.spending_forecasts from anon, authenticated;
grant select on table public.spending_forecasts to authenticated;

create or replace function public.spending_forecast_source(
  p_user_id uuid,
  p_today date,
  p_month_end date,
  p_history_start date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  user_currencies text[];
  base_currency text;
begin
  if p_user_id is null or p_today is null or p_month_end is null or p_history_start is null then
    raise exception 'user, today, month end and history start are required';
  end if;
  if p_month_end < p_today or p_today - p_history_start > 800 then
    raise exception 'Invalid forecast window';
  end if;

  select coalesce(
    (select p.default_currency::text from public.user_preferences p where p.user_id = p_user_id),
    (select w.currency::text from public.wallets w where w.user_id = p_user_id group by w.currency order by count(*) desc limit 1)
  ) into base_currency;

  select array_agg(distinct currency) into user_currencies
  from (
    select w.currency::text as currency from public.wallets w where w.user_id = p_user_id
    union all
    select base_currency where base_currency is not null
    union all
    select 'EUR'
  ) currencies;

  return jsonb_build_object(
    'default_currency', base_currency,
    'wallets', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'currency', w.currency))
      from public.wallets w where w.user_id = p_user_id
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'description', c.description, 'icon', c.icon,
        'type', c.type, 'parent_id', c.parent_id, 'purpose', c.purpose,
        'is_contribution', coalesce(c.is_contribution, false)
      ))
      from public.finance_categories c
      where c.user_id = p_user_id and not coalesce(c.is_system, false)
    ), '[]'::jsonb),
    -- Paid expenses from the start of the history window (the month start is inside it) up to today.
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'occurred_at', t.occurred_at, 'amount', t.amount, 'category_id', t.category_id,
        'source_account_id', t.source_account_id, 'schedule_id', t.schedule_id
      ))
      from public.finance_transactions t
      left join public.finance_categories c on c.id = t.category_id
      where t.user_id = p_user_id
        and t.status = 'paid'
        and t.kind = 'expense'
        and not coalesce(t.system_generated, false)
        and t.occurred_at between p_history_start and p_today
        and (c.is_system is null or c.is_system = false)
    ), '[]'::jsonb),
    -- Known upcoming expenses from tomorrow to month end: materialized planned rows plus occurrences of active
    -- schedules that are not materialized yet (same rule as mcp_get_transactions_for_period).
    'planned', coalesce((
      select jsonb_agg(to_jsonb(planned_rows))
      from (
        select t.occurred_at, t.amount, t.category_id, t.source_account_id
        from public.finance_transactions t
        left join public.finance_categories c on c.id = t.category_id
        where t.user_id = p_user_id
          and t.status = 'planned'
          and t.kind = 'expense'
          and not coalesce(t.system_generated, false)
          and t.occurred_at between p_today + 1 and p_month_end
          and (c.is_system is null or c.is_system = false)
        union all
        select occurrence.occurrence_date as occurred_at, s.amount, s.category_id, s.source_account_id
        from public.finance_transaction_schedules s
        left join public.finance_categories c on c.id = s.category_id
        cross join lateral public.mcp_schedule_occurrences(
          s.start_date, s.interval_count, s.interval_unit, s.until_date, p_today + 1, p_month_end
        ) occurrence
        where s.user_id = p_user_id
          and s.state = 'active'
          and s.kind = 'expense'
          and s.start_date <= p_month_end
          and (s.until_date is null or s.until_date >= p_today + 1)
          and (c.is_system is null or c.is_system = false)
          and not exists (
            select 1 from public.finance_transactions m
            where m.user_id = p_user_id
              and m.schedule_id = s.id
              and m.schedule_occurrence_date = occurrence.occurrence_date
          )
      ) planned_rows
    ), '[]'::jsonb),
    'exchange_rates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider', r.provider, 'base_currency', r.base_currency, 'quote_currency', r.quote_currency,
        'requested_date', r.requested_date, 'rate_date', r.rate_date, 'rate', r.rate, 'fetched_at', r.fetched_at
      ))
      from (
        select f.* from public.fx_rates f
        where f.requested_date >= p_history_start
          and f.base_currency::text = any(user_currencies) and f.quote_currency::text = any(user_currencies)
        union all
        (
          select distinct on (f.provider, f.base_currency, f.quote_currency) f.*
          from public.fx_rates f
          where f.requested_date < p_history_start
            and f.base_currency::text = any(user_currencies) and f.quote_currency::text = any(user_currencies)
          order by f.provider, f.base_currency, f.quote_currency, f.requested_date desc
        )
      ) r
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.mcp_get_spending_forecast(
  p_key_hash text,
  p_month date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  target_month date;
  latest_date date;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  target_month := coalesce(date_trunc('month', p_month)::date, (
    select max(f.month) from public.spending_forecasts f where f.user_id = key_user_id
  ));

  select max(f.forecast_date) into latest_date
  from public.spending_forecasts f
  where f.user_id = key_user_id and f.month = target_month;

  if latest_date is null then
    return jsonb_build_object('month', target_month, 'forecast_date', null, 'forecasts', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'month', target_month,
    'forecast_date', latest_date,
    'forecasts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'category_id', f.category_id,
        'category_name', c.name,
        'category_icon', c.icon,
        'currency', f.currency,
        'budget', f.budget,
        'spent_to_date', f.spent_to_date,
        'planned_remaining', f.planned_remaining,
        'forecast_p10', f.forecast_p10,
        'forecast_p50', f.forecast_p50,
        'forecast_p90', f.forecast_p90,
        'baseline_runrate', f.baseline_runrate,
        'status', f.status,
        'expected_overrun_date', f.expected_overrun_date,
        'method', f.method,
        'model', f.model
      ) order by f.forecast_p50 / nullif(f.budget, 0) desc nulls last)
      from public.spending_forecasts f
      join public.finance_categories c on c.id = f.category_id
      where f.user_id = key_user_id and f.month = target_month and f.forecast_date = latest_date
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.spending_forecast_source(uuid, date, date, date) from public, anon, authenticated;
grant execute on function public.spending_forecast_source(uuid, date, date, date) to service_role;
revoke all on function public.mcp_get_spending_forecast(text, date) from public;
grant execute on function public.mcp_get_spending_forecast(text, date) to anon, authenticated;
