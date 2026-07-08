-- 1. Redefine mcp_get_finance_context to return goals (allocations)
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
  ),
  goal_context as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'wallet_id', a.wallet_id,
          'name', a.name,
          'kind', a.kind,
          'amount', a.amount,
          'target_amount', a.target_amount
        )
        order by a.created_at desc
      ),
      '[]'::jsonb
    ) as goals
    from public.wallet_allocations a
    where a.user_id = p_user_id
  )
  select jsonb_build_object(
    'wallets', wallet_context.wallets,
    'categories', category_context.categories,
    'goals', goal_context.goals,
    'rules', jsonb_build_object(
      'income', 'Requires destination_account_id and an income category_id.',
      'expense', 'Requires source_account_id and an expense category_id.',
      'transfer', 'Requires source_account_id and destination_account_id; category_id must be null.',
      'debt_payment', 'Requires source_account_id, destination_account_id for a debt wallet, and amount equal to principal_amount + interest_amount + extra_principal_amount. category_id is optional but must be an expense category when provided.'
    )
  )
  from wallet_context, category_context, goal_context;
$$;

-- 2. Define user-id based direct RPCs
create or replace function public.mcp_create_wallet_allocation(
  p_user_id uuid,
  p_wallet_id uuid,
  p_name text,
  p_kind public.allocation_kind,
  p_amount numeric,
  p_target_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_alloc public.wallet_allocations;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if p_amount < 0 then
    raise exception 'Allocation amount cannot go below 0.';
  end if;

  if p_kind = 'goal_targeted'::public.allocation_kind and (p_target_amount is null or p_target_amount <= 0) then
    raise exception 'Target amount is required for a targeted goal.';
  end if;

  if p_kind = 'goal_open'::public.allocation_kind then
    p_target_amount := null;
  end if;

  if not exists (
    select 1 from public.wallets
    where id = p_wallet_id and user_id = p_user_id and type = 'saving'
  ) then
    raise exception 'Savings wallet not found or invalid.';
  end if;

  insert into public.wallet_allocations (
    user_id,
    wallet_id,
    name,
    kind,
    amount,
    target_amount
  ) values (
    p_user_id,
    p_wallet_id,
    p_name,
    p_kind,
    p_amount,
    p_target_amount
  )
  returning * into new_alloc;

  return jsonb_build_object(
    'id', new_alloc.id,
    'wallet_id', new_alloc.wallet_id,
    'name', new_alloc.name,
    'kind', new_alloc.kind,
    'amount', new_alloc.amount,
    'target_amount', new_alloc.target_amount
  );
end;
$$;

create or replace function public.mcp_update_wallet_allocation(
  p_user_id uuid,
  p_allocation_id uuid,
  p_name text,
  p_kind public.allocation_kind,
  p_amount numeric,
  p_target_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_alloc public.wallet_allocations;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if p_amount < 0 then
    raise exception 'Allocation amount cannot go below 0.';
  end if;

  if p_kind = 'goal_targeted'::public.allocation_kind and (p_target_amount is null or p_target_amount <= 0) then
    raise exception 'Target amount is required for a targeted goal.';
  end if;

  if p_kind = 'goal_open'::public.allocation_kind then
    p_target_amount := null;
  end if;

  update public.wallet_allocations
  set
    name = p_name,
    kind = p_kind,
    amount = p_amount,
    target_amount = p_target_amount,
    updated_at = clock_timestamp()
  where id = p_allocation_id and user_id = p_user_id
  returning * into updated_alloc;

  if not found then
    raise exception 'Savings goal not found.';
  end if;

  return jsonb_build_object(
    'id', updated_alloc.id,
    'wallet_id', updated_alloc.wallet_id,
    'name', updated_alloc.name,
    'kind', updated_alloc.kind,
    'amount', updated_alloc.amount,
    'target_amount', updated_alloc.target_amount
  );
end;
$$;

create or replace function public.mcp_delete_wallet_allocation(
  p_user_id uuid,
  p_allocation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_alloc public.wallet_allocations;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  delete from public.wallet_allocations
  where id = p_allocation_id and user_id = p_user_id
  returning * into deleted_alloc;

  if not found then
    raise exception 'Savings goal not found.';
  end if;

  return jsonb_build_object(
    'id', deleted_alloc.id,
    'wallet_id', deleted_alloc.wallet_id,
    'name', deleted_alloc.name
  );
end;
$$;

-- 3. Define key-hash wrappers
create or replace function public.mcp_create_wallet_allocation(
  p_key_hash text,
  p_wallet_id uuid,
  p_name text,
  p_kind public.allocation_kind,
  p_amount numeric,
  p_target_amount numeric
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

  return public.mcp_create_wallet_allocation(key_user_id, p_wallet_id, p_name, p_kind, p_amount, p_target_amount);
end;
$$;

create or replace function public.mcp_update_wallet_allocation(
  p_key_hash text,
  p_allocation_id uuid,
  p_name text,
  p_kind public.allocation_kind,
  p_amount numeric,
  p_target_amount numeric
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

  return public.mcp_update_wallet_allocation(key_user_id, p_allocation_id, p_name, p_kind, p_amount, p_target_amount);
end;
$$;

create or replace function public.mcp_delete_wallet_allocation(
  p_key_hash text,
  p_allocation_id uuid
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

  return public.mcp_delete_wallet_allocation(key_user_id, p_allocation_id);
end;
$$;

-- 4. Set grants and permissions
revoke execute on function public.mcp_create_wallet_allocation(uuid, uuid, text, public.allocation_kind, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.mcp_update_wallet_allocation(uuid, uuid, text, public.allocation_kind, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.mcp_delete_wallet_allocation(uuid, uuid) from public, anon, authenticated;

grant execute on function public.mcp_create_wallet_allocation(uuid, uuid, text, public.allocation_kind, numeric, numeric) to service_role;
grant execute on function public.mcp_update_wallet_allocation(uuid, uuid, text, public.allocation_kind, numeric, numeric) to service_role;
grant execute on function public.mcp_delete_wallet_allocation(uuid, uuid) to service_role;

revoke execute on function public.mcp_create_wallet_allocation(text, uuid, text, public.allocation_kind, numeric, numeric) from public;
revoke execute on function public.mcp_update_wallet_allocation(text, uuid, text, public.allocation_kind, numeric, numeric) from public;
revoke execute on function public.mcp_delete_wallet_allocation(text, uuid) from public;

grant execute on function public.mcp_create_wallet_allocation(text, uuid, text, public.allocation_kind, numeric, numeric) to anon, authenticated;
grant execute on function public.mcp_update_wallet_allocation(text, uuid, text, public.allocation_kind, numeric, numeric) to anon, authenticated;
grant execute on function public.mcp_delete_wallet_allocation(text, uuid) to anon, authenticated;
