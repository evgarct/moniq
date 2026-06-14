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

        union all

        select child.id, child.user_id, child.parent_id, (parent.path || ' / ' || child.name)::text
        from public.finance_categories child
        join category_tree parent on parent.id = child.parent_id
        where child.user_id = key_user_id
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
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.mcp_delete_transaction(
  p_key_hash text,
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  deleted_payload jsonb;
begin
  select user_id
  into key_user_id
  from public.mcp_api_keys
  where key_hash = p_key_hash
  limit 1;

  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  with recursive category_tree as (
    select c.id, c.user_id, c.parent_id, c.name::text as path
    from public.finance_categories c
    where c.user_id = key_user_id
      and c.parent_id is null

    union all

    select child.id, child.user_id, child.parent_id, (parent.path || ' / ' || child.name)::text
    from public.finance_categories child
    join category_tree parent on parent.id = child.parent_id
    where child.user_id = key_user_id
  ),
  selected as (
    select jsonb_build_object(
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
    ) as payload
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
    where t.id = p_transaction_id
      and t.user_id = key_user_id
  ),
  deleted as (
    delete from public.finance_transactions
    where id = p_transaction_id
      and user_id = key_user_id
    returning id
  )
  select selected.payload
  into deleted_payload
  from selected
  join deleted on true;

  if deleted_payload is null then
    raise exception 'Transaction not found';
  end if;

  return jsonb_build_object('deleted', deleted_payload);
end;
$$;

revoke all on function public.mcp_get_transaction_widget_items(text, uuid[]) from public, anon, authenticated;
grant execute on function public.mcp_get_transaction_widget_items(text, uuid[]) to anon, authenticated;

revoke all on function public.mcp_delete_transaction(text, uuid) from public;
grant execute on function public.mcp_delete_transaction(text, uuid) to anon, authenticated;
