-- Persist is_contribution on MCP category creation and expose it in the finance context.
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

  insert into public.finance_categories (user_id, name, description, icon, type, parent_id, is_contribution)
  values (
    key_user_id,
    cat_name,
    case when cat_budget is not null
      then nullif(btrim('[budget: ' || trim_scale(cat_budget)::text || '] ' || coalesce(cat_description, '')), '')
      else cat_description end,
    cat_icon,
    cat_type,
    cat_parent_id,
    cat_type::text = 'expense' and coalesce((p_category->>'is_contribution')::boolean, false)
  )
  returning * into created_row;

  return jsonb_build_object('category', jsonb_build_object(
    'id', created_row.id,
    'name', created_row.name,
    'type', created_row.type,
    'parent_id', created_row.parent_id,
    'description', cat_description,
    'budget_amount', cat_budget,
    'icon', created_row.icon,
    'is_contribution', created_row.is_contribution
  ));
end;
$$;

create or replace function public.mcp_get_finance_context(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with recursive category_tree as (
    select c.id, c.user_id, c.name, c.description, c.icon, c.type, c.parent_id, c.is_system, c.is_contribution,
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
      child.parent_id, child.is_system, child.is_contribution, child.created_at,
      (parent.path || ' / ' || child.name)::text as path
    from public.finance_categories child
    join category_tree parent on parent.id = child.parent_id
    where child.user_id = p_user_id
      and (child.is_system is null or child.is_system = false)
  ),
  category_context as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'type', c.type, 'name', c.name, 'path', c.path,
      'parent_id', c.parent_id, 'description', c.description, 'icon', c.icon, 'is_system', c.is_system, 'is_contribution', c.is_contribution,
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
      'credit_limit', w.credit_limit, 'pension_state', w.pension_state
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
      'expense', 'Requires source_account_id and an expense category_id. An expense from a savings goal uses source_allocation_id, never destination_allocation_id.',
      'transfer', 'Requires source_account_id and destination_account_id. destination_allocation_id puts the money into a savings goal of the destination wallet and source_allocation_id takes it from a goal of the source wallet. category_id (an expense category such as Next & Safe) is allowed only together with destination_allocation_id.',
      'debt_payment', 'Requires source_account_id, destination_account_id for a debt or credit_card wallet, and amount equal to principal_amount + interest_amount + extra_principal_amount. Only principal plus extra principal reduces debt. category_id is optional but must be an expense category when provided.'
    )
  ) from wallet_context, category_context, goal_context;
$$;

revoke all on function public.mcp_create_category(text, jsonb) from public;
grant execute on function public.mcp_create_category(text, jsonb) to anon, authenticated;
