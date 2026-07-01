-- Migration: Hide system categories and transactions with system categories from MCP.
-- This prevents AI agents from seeing balance adjustments or internal system categories and transactions in MCP reports.

-- 1. Redefine mcp_get_finance_context to filter out system categories
create or replace function public.mcp_get_finance_context(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with recursive category_tree as (
    select
      c.id,
      c.user_id,
      c.name,
      c.icon,
      c.type,
      c.parent_id,
      c.is_system,
      c.created_at,
      c.name::text as path
    from public.finance_categories c
    where c.user_id = p_user_id
      and (c.is_system is null or c.is_system = false)
      and (
        c.parent_id is null
        or not exists (
          select 1
          from public.finance_categories parent
          where parent.id = c.parent_id
            and parent.user_id = p_user_id
        )
      )

    union all

    select
      child.id,
      child.user_id,
      child.name,
      child.icon,
      child.type,
      child.parent_id,
      child.is_system,
      child.created_at,
      (parent.path || ' / ' || child.name)::text as path
    from public.finance_categories child
    join category_tree parent on parent.id = child.parent_id
    where child.user_id = p_user_id
      and (child.is_system is null or child.is_system = false)
  ),
  category_context as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'type', c.type,
          'name', c.name,
          'path', c.path,
          'parent_id', c.parent_id,
          'icon', c.icon,
          'is_system', c.is_system,
          'is_selectable', not exists (
            select 1
            from public.finance_categories child
            where child.user_id = p_user_id
              and child.parent_id = c.id
          )
        )
        order by c.type, c.path
      ),
      '[]'::jsonb
    ) as categories
    from category_tree c
  ),
  wallet_context as (
    select coalesce(
      jsonb_agg(
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
      ),
      '[]'::jsonb
    ) as wallets
    from public.wallets w
    where w.user_id = p_user_id
  )
  select jsonb_build_object(
    'wallets', wallet_context.wallets,
    'categories', category_context.categories,
    'rules', jsonb_build_object(
      'income', 'Requires destination_account_id and an income category_id.',
      'expense', 'Requires source_account_id and an expense category_id.',
      'transfer', 'Requires source_account_id and destination_account_id; category_id must be null.',
      'debt_payment', 'Requires source_account_id, destination_account_id for a debt wallet, and amount equal to principal_amount + interest_amount + extra_principal_amount. category_id is optional but must be an expense category when provided.'
    )
  )
  from wallet_context, category_context;
$$;

revoke execute on function public.mcp_get_finance_context(uuid) from public, anon, authenticated;
grant execute on function public.mcp_get_finance_context(uuid) to service_role;


-- 2. Redefine mcp_get_transactions_for_period to filter out transactions with system categories
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
      and (category.is_system is null or category.is_system = false)
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
      and (category.is_system is null or category.is_system = false)
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
      and (category.is_system is null or category.is_system = false)
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
      and (category.is_system is null or category.is_system = false)
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
      'context', jsonb_build_object(
        'wallets', coalesce(
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
              and w.id in (
                select distinct source_account_id from combined_transactions where source_account_id is not null
                union
                select distinct destination_account_id from combined_transactions where destination_account_id is not null
              )
          ),
          '[]'::jsonb
        ),
        'categories', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', c.id,
                'type', c.type,
                'name', c.name,
                'path', c.path,
                'parent_id', c.parent_id,
                'icon', c.icon,
                'is_system', c.is_system,
                'is_selectable', c.is_selectable
              )
              order by c.type, c.path
            )
            from (
              select distinct
                cat.id,
                cat.type,
                cat.name,
                cat.path,
                cat.parent_id,
                cat.icon,
                cat.is_system,
                not exists (
                  select 1
                  from public.finance_categories child
                  where child.user_id = key_user_id
                    and child.parent_id = cat.id
                ) as is_selectable
              from public.finance_transactions tx
              join public.finance_categories cat on cat.id = tx.category_id
              where tx.user_id = key_user_id
                and tx.occurred_at >= p_start_date
                and tx.occurred_at <= p_end_date
                and (cat.is_system is null or cat.is_system = false)
            ) cat
          ),
          '[]'::jsonb
        )
      )
    )
    else '{}'::jsonb
  end into response;

  return response;
end;
$$;

revoke all on function public.mcp_get_transactions_for_period(text, date, date, text[], text[], text[], text[], boolean) from public;
grant execute on function public.mcp_get_transactions_for_period(text, date, date, text[], text[], text[], text[], boolean) to anon, authenticated;


-- 3. Redefine mcp_get_category_spending_report_source to filter out system categories and their transactions
create or replace function public.mcp_get_category_spending_report_source(
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
begin
  select user_id
  into key_user_id
  from public.mcp_api_keys
  where key_hash = p_key_hash
  limit 1;

  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  return jsonb_build_object(
    'wallets',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', w.id,
            'user_id', w.user_id,
            'name', w.name,
            'type', w.type,
            'cash_kind', w.cash_kind,
            'debt_kind', w.debt_kind,
            'balance', w.balance,
            'credit_limit', w.credit_limit,
            'currency', w.currency,
            'created_at', w.created_at
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
            'user_id', c.user_id,
            'name', c.name,
            'description', c.description,
            'icon', c.icon,
            'type', c.type,
            'parent_id', c.parent_id,
            'is_system', c.is_system,
            'created_at', c.created_at
          )
          order by c.created_at asc
        )
        from public.finance_categories c
        where c.user_id = key_user_id
          and (c.is_system is null or c.is_system = false)
      ),
      '[]'::jsonb
    ),
    'transactions',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', t.id,
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
            'source_account_id', t.source_account_id,
            'destination_account_id', t.destination_account_id,
            'schedule_id', t.schedule_id,
            'schedule_occurrence_date', t.schedule_occurrence_date,
            'is_schedule_override', t.is_schedule_override,
            'allocation_id', t.allocation_id
          )
          order by t.occurred_at desc, t.created_at desc
        )
        from public.finance_transactions t
        left join public.finance_categories c on c.id = t.category_id
        where t.user_id = key_user_id
          and t.status = 'paid'
          and t.kind <> 'transfer'
          and t.occurred_at >= p_start_date
          and t.occurred_at <= p_end_date
          and (c.is_system is null or c.is_system = false)
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.mcp_get_category_spending_report_source(text, date, date) from public;
grant execute on function public.mcp_get_category_spending_report_source(text, date, date) to anon, authenticated;


-- 4. Redefine mcp_get_transaction_widget_items to filter out transactions with system categories
create or replace function public.mcp_get_transaction_widget_items(
  p_key_hash text,
  p_transaction_ids uuid[]
)
returns jsonb
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

  return coalesce(
    (
      with recursive category_tree as (
        select c.id, c.user_id, c.parent_id, c.name::text as path
        from public.finance_categories c
        where c.user_id = key_user_id
          and c.parent_id is null
          and (c.is_system is null or c.is_system = false)

        union all

        select child.id, child.user_id, child.parent_id, (parent.path || ' / ' || child.name)::text
        from public.finance_categories child
        join category_tree parent on parent.id = child.parent_id
        where child.user_id = key_user_id
          and (child.is_system is null or child.is_system = false)
      )
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'title', t.title,
          'note', t.note,
          'occurred_at', t.occurred_at,
          'status', t.status,
          'kind', t.kind,
          'amount', t.amount,
          'destination_amount', t.destination_amount,
          'principal_amount', t.principal_amount,
          'interest_amount', t.interest_amount,
          'extra_principal_amount', t.extra_principal_amount,
          'currency', coalesce(source_wallet.currency, destination_wallet.currency),
          'destination_currency', destination_wallet.currency,
          'source_account_name', source_wallet.name,
          'destination_account_name', destination_wallet.name,
          'category_name', category.name,
          'category_path', category_tree.path
        )
        order by array_position(p_transaction_ids, t.id)
      )
      from public.finance_transactions t
      left join public.wallets source_wallet
        on source_wallet.id = t.source_account_id
        and source_wallet.user_id = key_user_id
      left join public.wallets destination_wallet
        on destination_wallet.id = t.destination_account_id
        and destination_wallet.user_id = key_user_id
      left join public.finance_categories category
        on category.id = t.category_id
        and category.user_id = key_user_id
      left join category_tree on category_tree.id = t.category_id
      where t.user_id = key_user_id
        and t.id = any(coalesce(p_transaction_ids, '{}'::uuid[]))
        and (category.is_system is null or category.is_system = false)
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.mcp_get_transaction_widget_items(text, uuid[]) from public, anon, authenticated;
grant execute on function public.mcp_get_transaction_widget_items(text, uuid[]) to anon, authenticated;
