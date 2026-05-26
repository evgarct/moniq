-- MCP edit/delete support for draft inbox rows and direct ledger transactions.

alter table public.mcp_batch_items
  add column if not exists resolved_destination_account_id uuid references public.wallets(id) on delete set null;

create or replace function public.mcp_list_transaction_batches(
  p_key_hash text,
  p_status text default 'pending'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  result jsonb;
begin
  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  if p_status is not null and p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'status must be pending, approved, or rejected';
  end if;

  select coalesce(jsonb_agg(batch_payload order by created_at desc), '[]'::jsonb)
  into result
  from (
    select
      b.created_at,
      jsonb_build_object(
        'id', b.id,
        'status', b.status,
        'source_description', b.source_description,
        'submitted_by', b.submitted_by,
        'created_at', b.created_at,
        'reviewed_at', b.reviewed_at,
        'item_count', count(i.id),
        'pending_count', count(i.id) filter (where i.status = 'pending'),
        'approved_count', count(i.id) filter (where i.status = 'approved'),
        'rejected_count', count(i.id) filter (where i.status = 'rejected')
      ) as batch_payload
    from public.mcp_transaction_batches b
    left join public.mcp_batch_items i on i.batch_id = b.id and i.user_id = key_user_id
    where b.user_id = key_user_id
      and (p_status is null or b.status = p_status)
    group by b.id
  ) batches;

  return jsonb_build_object('batches', result);
end;
$$;

create or replace function public.mcp_get_transaction_batch(
  p_key_hash text,
  p_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  result jsonb;
begin
  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  select jsonb_build_object(
    'id', b.id,
    'status', b.status,
    'source_description', b.source_description,
    'submitted_by', b.submitted_by,
    'created_at', b.created_at,
    'reviewed_at', b.reviewed_at,
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'title', i.title,
          'amount', i.amount,
          'occurred_at', i.occurred_at,
          'kind', i.kind,
          'currency', i.currency,
          'note', i.note,
          'suggested_category_name', i.suggested_category_name,
          'status', i.status,
          'resolved_category_id', i.resolved_category_id,
          'resolved_account_id', i.resolved_account_id,
          'resolved_destination_account_id', i.resolved_destination_account_id,
          'finance_transaction_id', i.finance_transaction_id,
          'created_at', i.created_at
        )
        order by i.created_at
      ) filter (where i.id is not null),
      '[]'::jsonb
    )
  )
  into result
  from public.mcp_transaction_batches b
  left join public.mcp_batch_items i on i.batch_id = b.id and i.user_id = key_user_id
  where b.id = p_batch_id
    and b.user_id = key_user_id
  group by b.id;

  if result is null then
    raise exception 'Batch not found';
  end if;

  return result;
end;
$$;

create or replace function public.mcp_update_transaction_draft(
  p_key_hash text,
  p_batch_id uuid,
  p_item_id uuid,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  batch_status text;
  updated_item jsonb;
begin
  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  select status into batch_status
  from public.mcp_transaction_batches
  where id = p_batch_id and user_id = key_user_id;

  if batch_status is null then
    raise exception 'Batch not found';
  end if;

  if batch_status <> 'pending' then
    raise exception 'Batch has already been reviewed';
  end if;

  if p_patch ? 'amount' and (p_patch->>'amount')::numeric <= 0 then
    raise exception 'amount must be positive';
  end if;

  if p_patch ? 'occurred_at' and (p_patch->>'occurred_at')::date is null then
    raise exception 'occurred_at must be a valid date';
  end if;

  if p_patch ? 'kind' and p_patch->>'kind' not in ('income', 'expense', 'transfer', 'debt_payment') then
    raise exception 'kind must be income, expense, transfer, or debt_payment';
  end if;

  if p_patch ? 'status' and p_patch->>'status' not in ('pending', 'approved', 'rejected') then
    raise exception 'status must be pending, approved, or rejected';
  end if;

  update public.mcp_batch_items
  set
    title = case when p_patch ? 'title' then nullif(btrim(p_patch->>'title'), '') else title end,
    amount = case when p_patch ? 'amount' then (p_patch->>'amount')::numeric else amount end,
    occurred_at = case when p_patch ? 'occurred_at' then (p_patch->>'occurred_at')::date else occurred_at end,
    kind = case when p_patch ? 'kind' then p_patch->>'kind' else kind end,
    currency = case when p_patch ? 'currency' then nullif(btrim(coalesce(p_patch->>'currency', '')), '') else currency end,
    note = case when p_patch ? 'note' then nullif(btrim(coalesce(p_patch->>'note', '')), '') else note end,
    suggested_category_name = case when p_patch ? 'suggested_category_name' then nullif(btrim(coalesce(p_patch->>'suggested_category_name', '')), '') else suggested_category_name end,
    status = case when p_patch ? 'status' then p_patch->>'status' else status end,
    resolved_category_id = case when p_patch ? 'resolved_category_id' then nullif(p_patch->>'resolved_category_id', '')::uuid else resolved_category_id end,
    resolved_account_id = case when p_patch ? 'resolved_account_id' then nullif(p_patch->>'resolved_account_id', '')::uuid else resolved_account_id end,
    resolved_destination_account_id = case when p_patch ? 'resolved_destination_account_id' then nullif(p_patch->>'resolved_destination_account_id', '')::uuid else resolved_destination_account_id end
  where id = p_item_id
    and batch_id = p_batch_id
    and user_id = key_user_id
  returning jsonb_build_object(
    'id', id,
    'batch_id', batch_id,
    'title', title,
    'amount', amount,
    'occurred_at', occurred_at,
    'kind', kind,
    'currency', currency,
    'note', note,
    'suggested_category_name', suggested_category_name,
    'status', status,
    'resolved_category_id', resolved_category_id,
    'resolved_account_id', resolved_account_id,
    'resolved_destination_account_id', resolved_destination_account_id,
    'finance_transaction_id', finance_transaction_id,
    'created_at', created_at
  ) into updated_item;

  if updated_item is null then
    raise exception 'Draft transaction not found';
  end if;

  return jsonb_build_object('updated', updated_item);
end;
$$;

create or replace function public.mcp_delete_transaction_draft(
  p_key_hash text,
  p_batch_id uuid,
  p_item_id uuid,
  p_mode text default 'reject'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  batch_status text;
  item_payload jsonb;
begin
  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  select status into batch_status
  from public.mcp_transaction_batches
  where id = p_batch_id and user_id = key_user_id;

  if batch_status is null then
    raise exception 'Batch not found';
  end if;

  if batch_status <> 'pending' then
    raise exception 'Batch has already been reviewed';
  end if;

  if coalesce(p_mode, 'reject') not in ('reject', 'hard_delete') then
    raise exception 'mode must be reject or hard_delete';
  end if;

  select jsonb_build_object(
    'id', id,
    'batch_id', batch_id,
    'title', title,
    'amount', amount,
    'occurred_at', occurred_at,
    'kind', kind,
    'currency', currency,
    'status', status
  )
  into item_payload
  from public.mcp_batch_items
  where id = p_item_id
    and batch_id = p_batch_id
    and user_id = key_user_id;

  if item_payload is null then
    raise exception 'Draft transaction not found';
  end if;

  if coalesce(p_mode, 'reject') = 'hard_delete' then
    delete from public.mcp_batch_items
    where id = p_item_id
      and batch_id = p_batch_id
      and user_id = key_user_id;

    return jsonb_build_object('deleted', item_payload, 'mode', 'hard_delete');
  end if;

  update public.mcp_batch_items
  set status = 'rejected'
  where id = p_item_id
    and batch_id = p_batch_id
    and user_id = key_user_id;

  return jsonb_build_object('deleted', item_payload || jsonb_build_object('status', 'rejected'), 'mode', 'reject');
end;
$$;

create or replace function public.mcp_update_transaction(
  p_key_hash text,
  p_transaction_id uuid,
  p_transaction jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
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
  destination_type public.wallet_type;
  category_type public.finance_category_type;
  category_has_children boolean;
  updated_payload jsonb;
begin
  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  if not exists (select 1 from public.finance_transactions where id = p_transaction_id and user_id = key_user_id) then
    raise exception 'Transaction not found';
  end if;

  tx_title := nullif(btrim(p_transaction->>'title'), '');
  tx_note := nullif(btrim(coalesce(p_transaction->>'note', '')), '');
  tx_occurred_at := (p_transaction->>'occurred_at')::date;
  tx_status := (p_transaction->>'status')::public.finance_transaction_status;
  tx_kind := (p_transaction->>'kind')::public.finance_transaction_kind;
  tx_amount := (p_transaction->>'amount')::numeric;
  tx_destination_amount := nullif(p_transaction->>'destination_amount', '')::numeric;
  tx_fx_rate := nullif(p_transaction->>'fx_rate', '')::numeric;
  tx_principal_amount := coalesce(nullif(p_transaction->>'principal_amount', '')::numeric, 0);
  tx_interest_amount := coalesce(nullif(p_transaction->>'interest_amount', '')::numeric, 0);
  tx_extra_principal_amount := coalesce(nullif(p_transaction->>'extra_principal_amount', '')::numeric, 0);
  tx_category_id := nullif(p_transaction->>'category_id', '')::uuid;
  tx_source_account_id := nullif(p_transaction->>'source_account_id', '')::uuid;
  tx_destination_account_id := nullif(p_transaction->>'destination_account_id', '')::uuid;

  if tx_title is null then raise exception 'Transaction must have a title'; end if;
  if tx_amount is null or tx_amount <= 0 then raise exception 'Transaction "%" must have a positive amount', tx_title; end if;
  if tx_status not in ('paid', 'planned') then raise exception 'Transaction "%" status must be paid or planned', tx_title; end if;
  if tx_kind not in ('income', 'expense', 'transfer', 'debt_payment') then raise exception 'Transaction "%" kind is not supported', tx_title; end if;
  if tx_destination_amount is not null and tx_destination_amount <= 0 then raise exception 'Transaction "%" destination_amount must be positive when provided', tx_title; end if;
  if tx_fx_rate is not null and tx_fx_rate <= 0 then raise exception 'Transaction "%" fx_rate must be positive when provided', tx_title; end if;

  if tx_source_account_id is not null then
    select exists(select 1 from public.wallets where id = tx_source_account_id and user_id = key_user_id) into source_exists;
    if not source_exists then raise exception 'Transaction "%" source account not found', tx_title; end if;
  end if;

  if tx_destination_account_id is not null then
    select type into destination_type from public.wallets where id = tx_destination_account_id and user_id = key_user_id;
    if destination_type is null then raise exception 'Transaction "%" destination account not found', tx_title; end if;
  else
    destination_type := null;
  end if;

  if tx_source_account_id is not null and tx_destination_account_id is not null and tx_source_account_id = tx_destination_account_id then
    raise exception 'Transaction "%" source and destination accounts must be different', tx_title;
  end if;

  if tx_category_id is not null then
    select type into category_type from public.finance_categories where id = tx_category_id and user_id = key_user_id;
    if category_type is null then raise exception 'Transaction "%" category not found', tx_title; end if;
    select exists(select 1 from public.finance_categories child where child.user_id = key_user_id and child.parent_id = tx_category_id) into category_has_children;
    if category_has_children then raise exception 'Transaction "%" category must be a selectable leaf category', tx_title; end if;
  else
    category_type := null;
  end if;

  if tx_kind = 'income' then
    if tx_destination_account_id is null then raise exception 'Transaction "%" income must include destination_account_id', tx_title; end if;
    if tx_source_account_id is not null then raise exception 'Transaction "%" income must not include source_account_id', tx_title; end if;
    if tx_category_id is null or category_type <> 'income' then raise exception 'Transaction "%" income must use an income category', tx_title; end if;
    tx_destination_amount := null; tx_fx_rate := null; tx_principal_amount := null; tx_interest_amount := null; tx_extra_principal_amount := null;
  elsif tx_kind = 'expense' then
    if tx_source_account_id is null then raise exception 'Transaction "%" expense must include source_account_id', tx_title; end if;
    if tx_destination_account_id is not null then raise exception 'Transaction "%" expense must not include destination_account_id', tx_title; end if;
    if tx_category_id is null or category_type <> 'expense' then raise exception 'Transaction "%" expense must use an expense category', tx_title; end if;
    tx_destination_amount := null; tx_fx_rate := null; tx_principal_amount := null; tx_interest_amount := null; tx_extra_principal_amount := null;
  elsif tx_kind = 'transfer' then
    if tx_source_account_id is null or tx_destination_account_id is null then raise exception 'Transaction "%" transfer must include source_account_id and destination_account_id', tx_title; end if;
    if tx_category_id is not null then raise exception 'Transaction "%" transfer must not include category_id', tx_title; end if;
    tx_destination_amount := coalesce(tx_destination_amount, tx_amount); tx_principal_amount := null; tx_interest_amount := null; tx_extra_principal_amount := null;
  elsif tx_kind = 'debt_payment' then
    if tx_source_account_id is null or tx_destination_account_id is null then raise exception 'Transaction "%" debt_payment must include source_account_id and destination_account_id', tx_title; end if;
    if destination_type <> 'debt' then raise exception 'Transaction "%" debt_payment destination must be a debt wallet', tx_title; end if;
    if tx_principal_amount < 0 or tx_interest_amount < 0 or tx_extra_principal_amount < 0 then raise exception 'Transaction "%" debt payment breakdown values must be non-negative', tx_title; end if;
    if tx_principal_amount + tx_interest_amount + tx_extra_principal_amount <= 0 then raise exception 'Transaction "%" debt_payment must include at least one breakdown amount', tx_title; end if;
    if abs((tx_principal_amount + tx_interest_amount + tx_extra_principal_amount) - tx_amount) > 0.01 then raise exception 'Transaction "%" amount must equal principal_amount + interest_amount + extra_principal_amount', tx_title; end if;
    if tx_category_id is not null and category_type <> 'expense' then raise exception 'Transaction "%" debt_payment category must be an expense category', tx_title; end if;
    tx_destination_amount := null; tx_fx_rate := null;
  end if;

  update public.finance_transactions
  set
    title = tx_title,
    note = tx_note,
    occurred_at = tx_occurred_at,
    status = tx_status,
    kind = tx_kind,
    amount = tx_amount,
    destination_amount = tx_destination_amount,
    fx_rate = tx_fx_rate,
    principal_amount = tx_principal_amount,
    interest_amount = tx_interest_amount,
    extra_principal_amount = tx_extra_principal_amount,
    category_id = tx_category_id,
    source_account_id = tx_source_account_id,
    destination_account_id = tx_destination_account_id,
    is_schedule_override = case when schedule_id is not null then true else is_schedule_override end
  where id = p_transaction_id
    and user_id = key_user_id
  returning jsonb_build_object(
    'id', id,
    'title', title,
    'kind', kind,
    'status', status,
    'amount', amount,
    'occurred_at', occurred_at,
    'category_id', category_id,
    'source_account_id', source_account_id,
    'destination_account_id', destination_account_id
  ) into updated_payload;

  return jsonb_build_object('updated', updated_payload);
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
  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  delete from public.finance_transactions
  where id = p_transaction_id
    and user_id = key_user_id
  returning jsonb_build_object(
    'id', id,
    'title', title,
    'kind', kind,
    'status', status,
    'amount', amount,
    'occurred_at', occurred_at
  ) into deleted_payload;

  if deleted_payload is null then
    raise exception 'Transaction not found';
  end if;

  return jsonb_build_object('deleted', deleted_payload);
end;
$$;

revoke all on function public.mcp_list_transaction_batches(text, text) from public;
revoke all on function public.mcp_get_transaction_batch(text, uuid) from public;
revoke all on function public.mcp_update_transaction_draft(text, uuid, uuid, jsonb) from public;
revoke all on function public.mcp_delete_transaction_draft(text, uuid, uuid, text) from public;
revoke all on function public.mcp_update_transaction(text, uuid, jsonb) from public;
revoke all on function public.mcp_delete_transaction(text, uuid) from public;

grant execute on function public.mcp_list_transaction_batches(text, text) to anon, authenticated;
grant execute on function public.mcp_get_transaction_batch(text, uuid) to anon, authenticated;
grant execute on function public.mcp_update_transaction_draft(text, uuid, uuid, jsonb) to anon, authenticated;
grant execute on function public.mcp_delete_transaction_draft(text, uuid, uuid, text) to anon, authenticated;
grant execute on function public.mcp_update_transaction(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.mcp_delete_transaction(text, uuid) to anon, authenticated;
