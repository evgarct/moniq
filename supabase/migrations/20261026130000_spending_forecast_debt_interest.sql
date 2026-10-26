-- The Budget screen counts only the interest of a debt payment as envelope spending (principal reduces the debt,
-- it is not consumption). spending_forecast_source ignored debt_payment rows, so an envelope with a mortgage
-- looked cheaper than on the screen. Count interest_amount of paid and upcoming debt payments as expense.
-- Same signature and grants as 20261026120000; only the history and planned selections change.

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
    -- Paid spending from the start of the history window (the month start is inside it) up to today:
    -- expenses at full amount, debt payments at their interest only.
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'occurred_at', t.occurred_at, 'amount', spend.amount, 'category_id', t.category_id,
        'source_account_id', t.source_account_id, 'schedule_id', t.schedule_id
      ))
      from public.finance_transactions t
      left join public.finance_categories c on c.id = t.category_id
      cross join lateral (
        select case when t.kind = 'debt_payment' then coalesce(t.interest_amount, 0) else t.amount end as amount
      ) spend
      where t.user_id = p_user_id
        and t.status = 'paid'
        and t.kind in ('expense', 'debt_payment')
        and spend.amount > 0
        and not coalesce(t.system_generated, false)
        and t.occurred_at between p_history_start and p_today
        and (c.is_system is null or c.is_system = false)
    ), '[]'::jsonb),
    -- Known upcoming spending from tomorrow to month end: materialized planned rows plus occurrences of active
    -- schedules that are not materialized yet (same rule as mcp_get_transactions_for_period).
    'planned', coalesce((
      select jsonb_agg(to_jsonb(planned_rows))
      from (
        select t.occurred_at, spend.amount, t.category_id, t.source_account_id
        from public.finance_transactions t
        left join public.finance_categories c on c.id = t.category_id
        cross join lateral (
          select case when t.kind = 'debt_payment' then coalesce(t.interest_amount, 0) else t.amount end as amount
        ) spend
        where t.user_id = p_user_id
          and t.status = 'planned'
          and t.kind in ('expense', 'debt_payment')
          and spend.amount > 0
          and not coalesce(t.system_generated, false)
          and t.occurred_at between p_today + 1 and p_month_end
          and (c.is_system is null or c.is_system = false)
        union all
        select occurrence.occurrence_date as occurred_at, spend.amount, s.category_id, s.source_account_id
        from public.finance_transaction_schedules s
        left join public.finance_categories c on c.id = s.category_id
        cross join lateral (
          select case when s.kind = 'debt_payment' then coalesce(s.interest_amount, 0) else s.amount end as amount
        ) spend
        cross join lateral public.mcp_schedule_occurrences(
          s.start_date, s.interval_count, s.interval_unit, s.until_date, p_today + 1, p_month_end
        ) occurrence
        where s.user_id = p_user_id
          and s.state = 'active'
          and s.kind in ('expense', 'debt_payment')
          and spend.amount > 0
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

revoke all on function public.spending_forecast_source(uuid, date, date, date) from public, anon, authenticated;
grant execute on function public.spending_forecast_source(uuid, date, date, date) to service_role;
