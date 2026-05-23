create or replace function public.mcp_reschedule_recurring_transaction_series_from_occurrence(
  p_key_hash text,
  p_schedule_id uuid,
  p_from_occurrence_date date,
  p_new_occurrence_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  schedule_start date;
  schedule_frequency public.finance_transaction_schedule_frequency;
  schedule_until date;
  offset_days integer;
  new_start_date date;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  select start_date, frequency, until_date
  into schedule_start, schedule_frequency, schedule_until
  from public.finance_transaction_schedules
  where id = p_schedule_id
    and user_id = key_user_id;

  if schedule_start is null then
    raise exception 'Recurring transaction series not found';
  end if;

  if not public.mcp_schedule_has_occurrence(
    schedule_start,
    schedule_frequency,
    schedule_until,
    p_from_occurrence_date
  ) then
    raise exception 'From occurrence date does not belong to this recurring transaction series';
  end if;

  offset_days := p_new_occurrence_date - p_from_occurrence_date;
  new_start_date := schedule_start + offset_days;

  update public.finance_transaction_schedules
  set start_date = new_start_date
  where id = p_schedule_id
    and user_id = key_user_id;

  delete from public.finance_transactions
  where user_id = key_user_id
    and schedule_id = p_schedule_id
    and status = 'planned'
    and is_schedule_override = false
    and occurred_at >= p_from_occurrence_date;

  delete from public.finance_transactions
  where user_id = key_user_id
    and schedule_id = p_schedule_id
    and status = 'planned'
    and is_schedule_override = true
    and schedule_occurrence_date >= p_from_occurrence_date;

  return jsonb_build_object('schedule_id', p_schedule_id, 'start_date', new_start_date);
end;
$$;

revoke all on function public.mcp_reschedule_recurring_transaction_series_from_occurrence(text, uuid, date, date) from public;
grant execute on function public.mcp_reschedule_recurring_transaction_series_from_occurrence(text, uuid, date, date) to anon, authenticated;
