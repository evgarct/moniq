-- MCP: create/update categories, category descriptions and default currency in the finance context,
-- default currency in the spending report source (budgets are stored as a "[budget: N]" description prefix
-- in the user's default currency).
-- The patched functions are generated from their latest definitions; behaviour outside these additions is unchanged.

create or replace function public.mcp_get_finance_context(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with recursive category_tree as (
    select c.id, c.user_id, c.name, c.description, c.icon, c.type, c.parent_id, c.is_system,
      c.created_at, c.name::text as path
    from public.finance_categories c
    where c.user_id = p_user_id
      and (c.is_system is null or c.is_system = false)
      and (c.parent_id is null or not exists (
        select 1 from public.finance_categories parent
        where parent.id = c.parent_id and parent.user_id = p_user_id
      ))
    union all
    select child.id, child.user_id, child.name, child.description, child.icon, child.type,
      child.parent_id, child.is_system, child.created_at,
      (parent.path || ' / ' || child.name)::text as path
    from public.finance_categories child
    join category_tree parent on parent.id = child.parent_id
    where child.user_id = p_user_id
      and (child.is_system is null or child.is_system = false)
  ),
  category_context as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'type', c.type, 'name', c.name, 'path', c.path,
      'parent_id', c.parent_id, 'description', c.description, 'icon', c.icon, 'is_system', c.is_system,
      'is_selectable', not exists (
        select 1 from public.finance_categories child
        where child.user_id = p_user_id and child.parent_id = c.id
      )
    ) order by c.type, c.path), '[]'::jsonb) as categories
    from category_tree c
  ),
  wallet_context as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', w.id, 'name', w.name, 'type', w.type, 'cash_kind', w.cash_kind,
      'debt_kind', w.debt_kind, 'currency', w.currency, 'balance', w.balance,
      'credit_limit', w.credit_limit
    ) order by w.created_at desc), '[]'::jsonb) as wallets
    from public.wallets w where w.user_id = p_user_id
  ),
  goal_context as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'wallet_id', a.wallet_id, 'name', a.name, 'kind', a.kind,
      'amount', a.amount, 'target_amount', a.target_amount,
      'is_default', a.is_default
    ) order by a.created_at desc), '[]'::jsonb) as goals
    from public.wallet_allocations a where a.user_id = p_user_id
  )
  select jsonb_build_object(
    'wallets', wallet_context.wallets,
    'categories', category_context.categories,
    'default_currency', (select p.default_currency from public.user_preferences p where p.user_id = p_user_id),
    'goals', goal_context.goals,
    'rules', jsonb_build_object(
      'income', 'Requires destination_account_id and an income category_id.',
      'expense', 'Requires source_account_id and an expense category_id.',
      'transfer', 'Requires source_account_id and destination_account_id. destination_allocation_id puts the money into a savings goal of the destination wallet and source_allocation_id takes it from a goal of the source wallet. category_id (an expense category such as Next & Safe) is allowed only together with destination_allocation_id.',
      'debt_payment', 'Requires source_account_id, destination_account_id for a debt wallet, and amount equal to principal_amount + interest_amount + extra_principal_amount. category_id is optional but must be an expense category when provided.'
    )
  ) from wallet_context, category_context, goal_context;
$$;

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
declare key_user_id uuid;
begin
  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then raise exception 'Invalid MCP API key'; end if;

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
        'is_system', c.is_system, 'created_at', c.created_at
      ) order by c.created_at)
      from public.finance_categories c
      where c.user_id = key_user_id and not coalesce(c.is_system, false)
    ), '[]'::jsonb),
    'allocations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'wallet_id', a.wallet_id, 'name', a.name,
        'kind', a.kind, 'amount', a.amount, 'target_amount', a.target_amount,
        'is_default', a.is_default
      ) order by a.created_at)
      from public.wallet_allocations a where a.user_id = key_user_id
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
      ) order by t.occurred_at desc, t.created_at desc)
      from public.finance_transactions t
      left join public.finance_categories c on c.id = t.category_id
      where t.user_id = key_user_id and t.status = 'paid'
        and t.occurred_at between p_start_date and p_end_date
        and (c.is_system is null or c.is_system = false)
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.mcp_create_category(
  p_key_hash text,
  p_category jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  cat_name text;
  cat_type public.finance_category_type;
  cat_parent_id uuid;
  cat_description text;
  cat_icon text;
  cat_budget numeric;
  parent_row public.finance_categories%rowtype;
  created_row public.finance_categories%rowtype;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  if jsonb_typeof(p_category) <> 'object' then
    raise exception 'category must be an object';
  end if;

  cat_name := nullif(btrim(p_category->>'name'), '');
  if cat_name is null then
    raise exception 'Category must have a name';
  end if;

  cat_parent_id := nullif(p_category->>'parent_id', '')::uuid;
  cat_description := nullif(btrim(coalesce(p_category->>'description', '')), '');
  cat_icon := nullif(btrim(coalesce(p_category->>'icon', '')), '');
  cat_budget := nullif(p_category->>'budget_amount', '')::numeric;

  if cat_parent_id is not null then
    select * into parent_row
    from public.finance_categories
    where id = cat_parent_id and user_id = key_user_id and not coalesce(is_system, false);
    if not found then
      raise exception 'Parent category not found';
    end if;
    cat_type := parent_row.type;
    if p_category->>'type' is not null and (p_category->>'type')::public.finance_category_type <> cat_type then
      raise exception 'Category type must match its parent category type';
    end if;
  else
    if p_category->>'type' is null then
      raise exception 'Category type is required for a top-level category';
    end if;
    cat_type := (p_category->>'type')::public.finance_category_type;
  end if;

  if cat_budget is not null then
    if cat_budget < 0 then
      raise exception 'budget_amount must not be negative';
    end if;
    if cat_type <> 'expense' or cat_parent_id is not null then
      raise exception 'budget_amount can only be set on a top-level expense category';
    end if;
  end if;

  if exists (
    select 1 from public.finance_categories c
    where c.user_id = key_user_id
      and c.parent_id is not distinct from cat_parent_id
      and lower(c.name) = lower(cat_name)
  ) then
    raise exception 'A category named "%" already exists in this place', cat_name;
  end if;

  insert into public.finance_categories (user_id, name, description, icon, type, parent_id)
  values (
    key_user_id,
    cat_name,
    case when cat_budget is not null
      then nullif(btrim('[budget: ' || trim_scale(cat_budget)::text || '] ' || coalesce(cat_description, '')), '')
      else cat_description end,
    cat_icon,
    cat_type,
    cat_parent_id
  )
  returning * into created_row;

  return jsonb_build_object('category', jsonb_build_object(
    'id', created_row.id,
    'name', created_row.name,
    'type', created_row.type,
    'parent_id', created_row.parent_id,
    'description', cat_description,
    'budget_amount', cat_budget,
    'icon', created_row.icon
  ));
end;
$$;

create or replace function public.mcp_update_category(
  p_key_hash text,
  p_category_id uuid,
  p_category jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  current_row public.finance_categories%rowtype;
  parent_row public.finance_categories%rowtype;
  budget_match text[];
  cur_budget numeric;
  cur_text text;
  new_name text;
  new_parent_id uuid;
  new_icon text;
  new_text text;
  new_budget numeric;
  updated_row public.finance_categories%rowtype;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  if jsonb_typeof(p_category) <> 'object' then
    raise exception 'category must be an object';
  end if;

  select * into current_row
  from public.finance_categories
  where id = p_category_id and user_id = key_user_id
  for update;
  if not found then
    raise exception 'Category not found';
  end if;
  if coalesce(current_row.is_system, false) then
    raise exception 'System categories cannot be edited';
  end if;
  if p_category ? 'type' and (p_category->>'type')::public.finance_category_type <> current_row.type then
    raise exception 'Category type cannot be changed';
  end if;

  budget_match := regexp_match(coalesce(current_row.description, ''), '^\[budget:\s*([0-9.]+)\]\s*([\s\S]*)$');
  if budget_match is not null then
    cur_budget := budget_match[1]::numeric;
    cur_text := nullif(btrim(budget_match[2]), '');
  else
    cur_budget := null;
    cur_text := nullif(btrim(coalesce(current_row.description, '')), '');
  end if;

  new_name := case when p_category ? 'name' then nullif(btrim(p_category->>'name'), '') else current_row.name end;
  if new_name is null then
    raise exception 'Category must have a name';
  end if;
  new_parent_id := case when p_category ? 'parent_id' then nullif(p_category->>'parent_id', '')::uuid else current_row.parent_id end;
  new_icon := case when p_category ? 'icon' then nullif(btrim(coalesce(p_category->>'icon', '')), '') else current_row.icon end;
  new_text := case when p_category ? 'description' then nullif(btrim(coalesce(p_category->>'description', '')), '') else cur_text end;
  new_budget := case when p_category ? 'budget_amount' then nullif(p_category->>'budget_amount', '')::numeric else cur_budget end;

  if new_parent_id is not null then
    if new_parent_id = p_category_id then
      raise exception 'A category cannot be its own parent';
    end if;
    select * into parent_row
    from public.finance_categories
    where id = new_parent_id and user_id = key_user_id and not coalesce(is_system, false);
    if not found then
      raise exception 'Parent category not found';
    end if;
    if parent_row.type <> current_row.type then
      raise exception 'Parent category must have the same type';
    end if;
    if exists (
      with recursive descendants as (
        select c.id from public.finance_categories c where c.parent_id = p_category_id and c.user_id = key_user_id
        union all
        select child.id from public.finance_categories child join descendants d on child.parent_id = d.id where child.user_id = key_user_id
      )
      select 1 from descendants where id = new_parent_id
    ) then
      raise exception 'A category cannot be moved under its own descendant';
    end if;
  end if;

  if new_budget is not null then
    if new_budget < 0 then
      raise exception 'budget_amount must not be negative';
    end if;
    if current_row.type <> 'expense' or new_parent_id is not null then
      raise exception 'budget_amount can only be set on a top-level expense category';
    end if;
  end if;

  if exists (
    select 1 from public.finance_categories c
    where c.user_id = key_user_id
      and c.id <> p_category_id
      and c.parent_id is not distinct from new_parent_id
      and lower(c.name) = lower(new_name)
  ) then
    raise exception 'A category named "%" already exists in this place', new_name;
  end if;

  update public.finance_categories
  set
    name = new_name,
    description = case when new_budget is not null
      then nullif(btrim('[budget: ' || trim_scale(new_budget)::text || '] ' || coalesce(new_text, '')), '')
      else new_text end,
    icon = new_icon,
    parent_id = new_parent_id
  where id = p_category_id and user_id = key_user_id
  returning * into updated_row;

  return jsonb_build_object('category', jsonb_build_object(
    'id', updated_row.id,
    'name', updated_row.name,
    'type', updated_row.type,
    'parent_id', updated_row.parent_id,
    'description', new_text,
    'budget_amount', new_budget,
    'icon', updated_row.icon
  ));
end;
$$;

revoke all on function public.mcp_create_category(text, jsonb) from public;
revoke all on function public.mcp_update_category(text, uuid, jsonb) from public;
grant execute on function public.mcp_create_category(text, jsonb) to anon, authenticated;
grant execute on function public.mcp_update_category(text, uuid, jsonb) to anon, authenticated;
