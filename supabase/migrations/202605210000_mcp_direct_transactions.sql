-- Direct MCP transaction creation.
-- These RPCs trust a user_id that has already been resolved from the MCP
-- bearer API key by the server route. They must not be executable through
-- public anon/authenticated REST RPC calls with caller-supplied user IDs.

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

create or replace function public.mcp_create_transactions(
  p_user_id uuid,
  p_transactions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  idx integer := 0;
  tx_id uuid;
  tx_title text;
  tx_note text;
  tx_occurred_at date;
  tx_status public.finance_transaction_status;
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
  created jsonb := '[]'::jsonb;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if jsonb_typeof(p_transactions) <> 'array' or jsonb_array_length(p_transactions) = 0 then
    raise exception 'transactions must be a non-empty array';
  end if;

  for item in select value from jsonb_array_elements(p_transactions)
  loop
    idx := idx + 1;

    tx_title := nullif(btrim(item->>'title'), '');
    tx_note := nullif(btrim(coalesce(item->>'note', '')), '');
    tx_occurred_at := (item->>'occurred_at')::date;
    tx_status := (item->>'status')::public.finance_transaction_status;
    tx_kind := (item->>'kind')::public.finance_transaction_kind;
    tx_amount := (item->>'amount')::numeric;
    tx_destination_amount := nullif(item->>'destination_amount', '')::numeric;
    tx_fx_rate := nullif(item->>'fx_rate', '')::numeric;
    tx_principal_amount := coalesce(nullif(item->>'principal_amount', '')::numeric, 0);
    tx_interest_amount := coalesce(nullif(item->>'interest_amount', '')::numeric, 0);
    tx_extra_principal_amount := coalesce(nullif(item->>'extra_principal_amount', '')::numeric, 0);
    tx_category_id := nullif(item->>'category_id', '')::uuid;
    tx_source_account_id := nullif(item->>'source_account_id', '')::uuid;
    tx_destination_account_id := nullif(item->>'destination_account_id', '')::uuid;

    if tx_title is null then
      raise exception 'Transaction % must have a title', idx;
    end if;

    if tx_amount is null or tx_amount <= 0 then
      raise exception 'Transaction "%" must have a positive amount', tx_title;
    end if;

    if tx_status not in ('paid', 'planned') then
      raise exception 'Transaction "%" status must be paid or planned', tx_title;
    end if;

    if tx_kind not in ('income', 'expense', 'transfer', 'debt_payment') then
      raise exception 'Transaction "%" kind is not supported', tx_title;
    end if;

    if tx_destination_amount is not null and tx_destination_amount <= 0 then
      raise exception 'Transaction "%" destination_amount must be positive when provided', tx_title;
    end if;

    if tx_fx_rate is not null and tx_fx_rate <= 0 then
      raise exception 'Transaction "%" fx_rate must be positive when provided', tx_title;
    end if;

    if tx_source_account_id is not null then
      select exists (
        select 1 from public.wallets
        where id = tx_source_account_id
          and user_id = p_user_id
      ) into source_exists;

      if not source_exists then
        raise exception 'Transaction "%" source account not found', tx_title;
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
        raise exception 'Transaction "%" destination account not found', tx_title;
      end if;
    else
      destination_type := null;
    end if;

    if tx_source_account_id is not null
      and tx_destination_account_id is not null
      and tx_source_account_id = tx_destination_account_id then
      raise exception 'Transaction "%" source and destination accounts must be different', tx_title;
    end if;

    if tx_category_id is not null then
      select c.type
      into category_type
      from public.finance_categories c
      where c.id = tx_category_id
        and c.user_id = p_user_id;

      if category_type is null then
        raise exception 'Transaction "%" category not found', tx_title;
      end if;

      select exists (
        select 1
        from public.finance_categories child
        where child.user_id = p_user_id
          and child.parent_id = tx_category_id
      ) into category_has_children;

      if category_has_children then
        raise exception 'Transaction "%" category must be a selectable leaf category', tx_title;
      end if;
    else
      category_type := null;
    end if;

    if tx_kind = 'income' then
      if tx_destination_account_id is null then
        raise exception 'Transaction "%" income must include destination_account_id', tx_title;
      end if;
      if tx_source_account_id is not null then
        raise exception 'Transaction "%" income must not include source_account_id', tx_title;
      end if;
      if tx_category_id is null or category_type <> 'income' then
        raise exception 'Transaction "%" income must use an income category', tx_title;
      end if;
      tx_destination_amount := null;
      tx_fx_rate := null;
      tx_principal_amount := null;
      tx_interest_amount := null;
      tx_extra_principal_amount := null;
    elsif tx_kind = 'expense' then
      if tx_source_account_id is null then
        raise exception 'Transaction "%" expense must include source_account_id', tx_title;
      end if;
      if tx_destination_account_id is not null then
        raise exception 'Transaction "%" expense must not include destination_account_id', tx_title;
      end if;
      if tx_category_id is null or category_type <> 'expense' then
        raise exception 'Transaction "%" expense must use an expense category', tx_title;
      end if;
      tx_destination_amount := null;
      tx_fx_rate := null;
      tx_principal_amount := null;
      tx_interest_amount := null;
      tx_extra_principal_amount := null;
    elsif tx_kind = 'transfer' then
      if tx_source_account_id is null or tx_destination_account_id is null then
        raise exception 'Transaction "%" transfer must include source_account_id and destination_account_id', tx_title;
      end if;
      if tx_category_id is not null then
        raise exception 'Transaction "%" transfer must not include category_id', tx_title;
      end if;
      tx_destination_amount := coalesce(tx_destination_amount, tx_amount);
      tx_principal_amount := null;
      tx_interest_amount := null;
      tx_extra_principal_amount := null;
    elsif tx_kind = 'debt_payment' then
      if tx_source_account_id is null or tx_destination_account_id is null then
        raise exception 'Transaction "%" debt_payment must include source_account_id and destination_account_id', tx_title;
      end if;
      if destination_type <> 'debt' then
        raise exception 'Transaction "%" debt_payment destination must be a debt wallet', tx_title;
      end if;
      if tx_principal_amount < 0 or tx_interest_amount < 0 or tx_extra_principal_amount < 0 then
        raise exception 'Transaction "%" debt payment breakdown values must be non-negative', tx_title;
      end if;
      if tx_principal_amount + tx_interest_amount + tx_extra_principal_amount <= 0 then
        raise exception 'Transaction "%" debt_payment must include at least one breakdown amount', tx_title;
      end if;
      if abs((tx_principal_amount + tx_interest_amount + tx_extra_principal_amount) - tx_amount) > 0.01 then
        raise exception 'Transaction "%" amount must equal principal_amount + interest_amount + extra_principal_amount', tx_title;
      end if;
      if tx_category_id is not null and category_type <> 'expense' then
        raise exception 'Transaction "%" debt_payment category must be an expense category', tx_title;
      end if;
      tx_destination_amount := null;
      tx_fx_rate := null;
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
      destination_account_id
    )
    values (
      p_user_id,
      tx_title,
      tx_note,
      tx_occurred_at,
      tx_status,
      tx_kind,
      tx_amount,
      tx_destination_amount,
      tx_fx_rate,
      tx_principal_amount,
      tx_interest_amount,
      tx_extra_principal_amount,
      tx_category_id,
      tx_source_account_id,
      tx_destination_account_id
    )
    returning id into tx_id;

    created := created || jsonb_build_array(
      jsonb_build_object(
        'id', tx_id,
        'title', tx_title,
        'kind', tx_kind,
        'amount', tx_amount,
        'occurred_at', tx_occurred_at
      )
    );
  end loop;

  return jsonb_build_object('created', created);
end;
$$;

revoke execute on function public.mcp_get_finance_context(uuid) from public, anon, authenticated;
revoke execute on function public.mcp_create_transactions(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.mcp_get_finance_context(uuid) to service_role;
grant execute on function public.mcp_create_transactions(uuid, jsonb) to service_role;
