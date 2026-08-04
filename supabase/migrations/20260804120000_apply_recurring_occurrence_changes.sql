create or replace function public.apply_recurring_occurrence_changes(
  p_schedule_id uuid,
  p_from_occurrence_date date,
  p_changes jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_schedule public.finance_transaction_schedules%rowtype;
  v_occurrence public.finance_transactions%rowtype;
  v_new_occurrence_date date;
  v_offset_days integer := 0;
  v_row record;
  v_unknown_changes jsonb;
begin
  if p_changes is null or p_changes = '{}'::jsonb then
    raise exception 'At least one recurring occurrence change is required';
  end if;

  v_unknown_changes := p_changes - array[
    'title', 'note', 'occurred_at', 'kind', 'amount', 'destination_amount', 'fx_rate',
    'principal_amount', 'interest_amount', 'extra_principal_amount', 'category_id',
    'source_account_id', 'destination_account_id', 'allocation_id'
  ];
  if v_unknown_changes <> '{}'::jsonb then
    raise exception 'Unsupported recurring occurrence changes: %', v_unknown_changes;
  end if;

  select *
  into v_schedule
  from public.finance_transaction_schedules
  where id = p_schedule_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Transaction schedule not found';
  end if;

  select *
  into v_occurrence
  from public.finance_transactions
  where user_id = auth.uid()
    and schedule_id = p_schedule_id
    and schedule_occurrence_date = p_from_occurrence_date
    and status = 'planned'
  for update;

  if not found then
    raise exception 'Planned recurring occurrence not found';
  end if;

  if p_changes ? 'occurred_at' then
    v_new_occurrence_date := (p_changes ->> 'occurred_at')::date;
    v_offset_days := v_new_occurrence_date - v_occurrence.occurred_at;
  end if;

  update public.finance_transactions
  set is_schedule_override = true
  where user_id = auth.uid()
    and schedule_id = p_schedule_id
    and status = 'planned'
    and schedule_occurrence_date < p_from_occurrence_date;

  update public.finance_transaction_schedules
  set
    title = case when p_changes ? 'title' then trim(p_changes ->> 'title') else title end,
    note = case when p_changes ? 'note' then p_changes ->> 'note' else note end,
    start_date = start_date + v_offset_days,
    kind = case when p_changes ? 'kind' then (p_changes ->> 'kind')::public.finance_transaction_kind else kind end,
    amount = case when p_changes ? 'amount' then (p_changes ->> 'amount')::numeric else amount end,
    destination_amount = case when p_changes ? 'destination_amount' then (p_changes ->> 'destination_amount')::numeric else destination_amount end,
    fx_rate = case when p_changes ? 'fx_rate' then (p_changes ->> 'fx_rate')::numeric else fx_rate end,
    principal_amount = case when p_changes ? 'principal_amount' then (p_changes ->> 'principal_amount')::numeric else principal_amount end,
    interest_amount = case when p_changes ? 'interest_amount' then (p_changes ->> 'interest_amount')::numeric else interest_amount end,
    extra_principal_amount = case when p_changes ? 'extra_principal_amount' then (p_changes ->> 'extra_principal_amount')::numeric else extra_principal_amount end,
    category_id = case when p_changes ? 'category_id' then (p_changes ->> 'category_id')::uuid else category_id end,
    source_account_id = case when p_changes ? 'source_account_id' then (p_changes ->> 'source_account_id')::uuid else source_account_id end,
    destination_account_id = case when p_changes ? 'destination_account_id' then (p_changes ->> 'destination_account_id')::uuid else destination_account_id end,
    allocation_id = case when p_changes ? 'allocation_id' then (p_changes ->> 'allocation_id')::uuid else allocation_id end
  where id = p_schedule_id
    and user_id = auth.uid();

  for v_row in
    select id
    from public.finance_transactions
    where user_id = auth.uid()
      and schedule_id = p_schedule_id
      and status = 'planned'
      and schedule_occurrence_date >= p_from_occurrence_date
    order by
      case when v_offset_days > 0 then schedule_occurrence_date end desc,
      case when v_offset_days <= 0 then schedule_occurrence_date end asc
    for update
  loop
    update public.finance_transactions
    set
      title = case when p_changes ? 'title' then trim(p_changes ->> 'title') else title end,
      note = case when p_changes ? 'note' then p_changes ->> 'note' else note end,
      occurred_at = occurred_at + v_offset_days,
      schedule_occurrence_date = schedule_occurrence_date + v_offset_days,
      kind = case when p_changes ? 'kind' then (p_changes ->> 'kind')::public.finance_transaction_kind else kind end,
      amount = case when p_changes ? 'amount' then (p_changes ->> 'amount')::numeric else amount end,
      destination_amount = case when p_changes ? 'destination_amount' then (p_changes ->> 'destination_amount')::numeric else destination_amount end,
      fx_rate = case when p_changes ? 'fx_rate' then (p_changes ->> 'fx_rate')::numeric else fx_rate end,
      principal_amount = case when p_changes ? 'principal_amount' then (p_changes ->> 'principal_amount')::numeric else principal_amount end,
      interest_amount = case when p_changes ? 'interest_amount' then (p_changes ->> 'interest_amount')::numeric else interest_amount end,
      extra_principal_amount = case when p_changes ? 'extra_principal_amount' then (p_changes ->> 'extra_principal_amount')::numeric else extra_principal_amount end,
      category_id = case when p_changes ? 'category_id' then (p_changes ->> 'category_id')::uuid else category_id end,
      source_account_id = case when p_changes ? 'source_account_id' then (p_changes ->> 'source_account_id')::uuid else source_account_id end,
      destination_account_id = case when p_changes ? 'destination_account_id' then (p_changes ->> 'destination_account_id')::uuid else destination_account_id end,
      allocation_id = case when p_changes ? 'allocation_id' then (p_changes ->> 'allocation_id')::uuid else allocation_id end,
      is_schedule_override = false
    where id = v_row.id
      and user_id = auth.uid();
  end loop;
end;
$$;

revoke all on function public.apply_recurring_occurrence_changes(uuid, date, jsonb) from public;
revoke all on function public.apply_recurring_occurrence_changes(uuid, date, jsonb) from anon;
grant execute on function public.apply_recurring_occurrence_changes(uuid, date, jsonb) to authenticated;
