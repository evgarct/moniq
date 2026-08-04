begin;

do $$
declare
  v_user_id uuid;
  v_schedule_id uuid := gen_random_uuid();
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then
    raise exception 'Recurring occurrence RPC test requires one synthetic auth user';
  end if;
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  insert into public.finance_transaction_schedules (
    id, user_id, title, start_date, frequency, state, kind, amount
  ) values (
    v_schedule_id, v_user_id, 'RPC scope test', '2098-01-01', 'monthly', 'active', 'expense', 100
  );

  insert into public.finance_transactions (
    user_id, title, occurred_at, status, kind, amount,
    schedule_id, schedule_occurrence_date, is_schedule_override
  ) values
    (v_user_id, 'RPC scope test', '2098-01-01', 'planned', 'expense', 100, v_schedule_id, '2098-01-01', false),
    (v_user_id, 'RPC scope test', '2098-02-01', 'planned', 'expense', 100, v_schedule_id, '2098-02-01', false),
    (v_user_id, 'Manual override', '2098-03-01', 'planned', 'expense', 90, v_schedule_id, '2098-03-01', true),
    (v_user_id, 'Paid history', '2098-04-01', 'paid', 'expense', 100, v_schedule_id, '2098-04-01', false);

  perform public.apply_recurring_occurrence_changes(
    v_schedule_id,
    '2098-02-01',
    '{"note":"Updated note","amount":125}'::jsonb
  );

  if not exists (
    select 1 from public.finance_transactions
    where schedule_id = v_schedule_id and schedule_occurrence_date = '2098-01-01'
      and amount = 100 and note is null and is_schedule_override
  ) then
    raise exception 'Earlier planned occurrence was not preserved';
  end if;

  if 2 <> (
    select count(*) from public.finance_transactions
    where schedule_id = v_schedule_id and status = 'planned'
      and schedule_occurrence_date >= '2098-02-01'
      and amount = 125 and note = 'Updated note' and not is_schedule_override
  ) then
    raise exception 'Selected and following planned occurrences were not replaced';
  end if;

  if not exists (
    select 1 from public.finance_transactions
    where schedule_id = v_schedule_id and status = 'paid'
      and schedule_occurrence_date = '2098-04-01' and amount = 100 and note is null
  ) then
    raise exception 'Paid history was changed';
  end if;

  perform public.apply_recurring_occurrence_changes(
    v_schedule_id,
    '2098-02-01',
    '{"occurred_at":"2098-02-03"}'::jsonb
  );

  if not exists (
    select 1 from public.finance_transaction_schedules
    where id = v_schedule_id and start_date = '2098-01-03'
  ) or 2 <> (
    select count(*) from public.finance_transactions
    where schedule_id = v_schedule_id and status = 'planned'
      and schedule_occurrence_date in ('2098-02-03', '2098-03-03')
  ) then
    raise exception 'Planned dates and schedule anchor were not shifted';
  end if;
end;
$$;

rollback;
