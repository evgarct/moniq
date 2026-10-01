-- The spending report separates investing from spending by the category purpose
-- (the envelope that contains the investment-purpose category), so the report source returns it.

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
        'purpose', c.purpose,
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
