-- MCP budget tools.
-- 1. mcp_get_budget_status_source: everything the Budget screen needs for one month (wallets, categories,
--    paid + planned transactions of the month and the FX rates to convert them), so get_budget_status can run
--    the same envelope helpers as the app. fx_rates is only readable by authenticated users, so the MCP key
--    path needs this SECURITY DEFINER source.
-- 2. mcp_set_category_budgets: set or clear the monthly plan of several top-level expense categories in one
--    atomic call (all or nothing), keeping the "[budget: N]" description prefix format of mcp_update_category.

create or replace function public.mcp_get_budget_status_source(
  p_key_hash text,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  user_currencies text[];
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date or p_end_date - p_start_date > 31 then
    raise exception 'Budget status needs a single month';
  end if;

  select array_agg(distinct currency::text) into user_currencies
  from (
    select w.currency from public.wallets w where w.user_id = key_user_id
    union all
    select p.default_currency from public.user_preferences p where p.user_id = key_user_id and p.default_currency is not null
    union all
    select 'EUR'::public.currency_code
  ) currencies;

  return jsonb_build_object(
    'default_currency', (select p.default_currency from public.user_preferences p where p.user_id = key_user_id),
    'wallets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'user_id', w.user_id, 'name', w.name, 'type', w.type,
        'cash_kind', w.cash_kind, 'debt_kind', w.debt_kind, 'balance', w.balance,
        'credit_limit', w.credit_limit, 'currency', w.currency, 'created_at', w.created_at
      ) order by w.created_at desc)
      from public.wallets w where w.user_id = key_user_id
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'user_id', c.user_id, 'name', c.name, 'description', c.description,
        'icon', c.icon, 'type', c.type, 'parent_id', c.parent_id,
        'purpose', c.purpose,
        'is_system', c.is_system, 'created_at', c.created_at
      ) order by c.created_at)
      from public.finance_categories c
      where c.user_id = key_user_id and not coalesce(c.is_system, false)
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'user_id', t.user_id, 'title', t.title, 'note', t.note,
        'occurred_at', t.occurred_at, 'created_at', t.created_at, 'status', t.status,
        'kind', t.kind, 'amount', t.amount, 'destination_amount', t.destination_amount,
        'fx_rate', t.fx_rate, 'principal_amount', t.principal_amount,
        'interest_amount', t.interest_amount, 'extra_principal_amount', t.extra_principal_amount,
        'category_id', t.category_id, 'source_account_id', t.source_account_id,
        'destination_account_id', t.destination_account_id, 'schedule_id', t.schedule_id,
        'schedule_occurrence_date', t.schedule_occurrence_date,
        'is_schedule_override', t.is_schedule_override, 'allocation_id', t.allocation_id,
        'source_allocation_id', t.source_allocation_id,
        'linked_transaction_id', t.linked_transaction_id,
        'system_generated', t.system_generated
      ) order by t.occurred_at, t.created_at)
      from public.finance_transactions t
      left join public.finance_categories c on c.id = t.category_id
      where t.user_id = key_user_id and t.status in ('paid', 'planned')
        and t.occurred_at between p_start_date and p_end_date
        and (c.is_system is null or c.is_system = false)
    ), '[]'::jsonb),
    -- Rates of the month plus, per pair, the latest one before it: the app converts with the latest rate
    -- dated on or before each transaction (and the latest known rate for future-dated planned ones).
    'exchange_rates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider', r.provider, 'base_currency', r.base_currency, 'quote_currency', r.quote_currency,
        'requested_date', r.requested_date, 'rate_date', r.rate_date, 'rate', r.rate, 'fetched_at', r.fetched_at
      ))
      from (
        select f.* from public.fx_rates f
        where f.requested_date >= p_start_date
          and f.base_currency::text = any(user_currencies) and f.quote_currency::text = any(user_currencies)
        union all
        (
          select distinct on (f.provider, f.base_currency, f.quote_currency) f.*
          from public.fx_rates f
          where f.requested_date < p_start_date
            and f.base_currency::text = any(user_currencies) and f.quote_currency::text = any(user_currencies)
          order by f.provider, f.base_currency, f.quote_currency, f.requested_date desc
        )
      ) r
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.mcp_set_category_budgets(
  p_key_hash text,
  p_budgets jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  item jsonb;
  item_id uuid;
  item_budget numeric;
  current_row public.finance_categories%rowtype;
  budget_match text[];
  cur_text text;
  results jsonb := '[]'::jsonb;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  if jsonb_typeof(p_budgets) <> 'array' or jsonb_array_length(p_budgets) = 0 then
    raise exception 'budgets must be a non-empty array';
  end if;
  if jsonb_array_length(p_budgets) > 100 then
    raise exception 'budgets accepts at most 100 items';
  end if;
  if (select count(distinct value->>'category_id') from jsonb_array_elements(p_budgets)) <> jsonb_array_length(p_budgets) then
    raise exception 'Each category can appear only once';
  end if;

  for item in select value from jsonb_array_elements(p_budgets)
  loop
    if jsonb_typeof(item) <> 'object' or not (item ? 'category_id') or not (item ? 'budget_amount') then
      raise exception 'Each budget needs category_id and budget_amount';
    end if;
    item_id := (item->>'category_id')::uuid;
    item_budget := nullif(item->>'budget_amount', '')::numeric;

    select * into current_row
    from public.finance_categories
    where id = item_id and user_id = key_user_id
    for update;
    if not found then
      raise exception 'Category not found';
    end if;
    if coalesce(current_row.is_system, false) then
      raise exception 'System categories cannot be edited';
    end if;
    if current_row.type <> 'expense' or current_row.parent_id is not null then
      raise exception 'budget_amount can only be set on a top-level expense category';
    end if;
    if item_budget is not null and item_budget < 0 then
      raise exception 'budget_amount must not be negative';
    end if;

    budget_match := regexp_match(coalesce(current_row.description, ''), '^\[budget:\s*([0-9.]+)\]\s*([\s\S]*)$');
    cur_text := case when budget_match is not null
      then nullif(btrim(budget_match[2]), '')
      else nullif(btrim(coalesce(current_row.description, '')), '') end;

    update public.finance_categories
    set description = case when item_budget is not null
      then nullif(btrim('[budget: ' || trim_scale(item_budget)::text || '] ' || coalesce(cur_text, '')), '')
      else cur_text end
    where id = item_id and user_id = key_user_id;

    results := results || jsonb_build_array(jsonb_build_object(
      'category_id', current_row.id,
      'name', current_row.name,
      'budget_amount', item_budget
    ));
  end loop;

  return jsonb_build_object('budgets', results);
end;
$$;

revoke all on function public.mcp_get_budget_status_source(text, date, date) from public;
revoke all on function public.mcp_set_category_budgets(text, jsonb) from public;
grant execute on function public.mcp_get_budget_status_source(text, date, date) to anon, authenticated;
grant execute on function public.mcp_set_category_budgets(text, jsonb) to anon, authenticated;
