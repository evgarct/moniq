begin;

do $$
declare
  v_user_id uuid;
  v_schedule_id uuid := gen_random_uuid();
  v_dates date[];
begin
  -- every 9 days
  select array_agg(occurrence_date order by occurrence_date) into v_dates
  from public.mcp_schedule_occurrences('2098-01-01', 9, 'day', null, '2098-01-01', '2098-02-15');
  assert v_dates = array['2098-01-01','2098-01-10','2098-01-19','2098-01-28','2098-02-06','2098-02-15']::date[],
    format('every 9 days produced %s', v_dates);

  -- range starting after the anchor keeps the cadence
  select array_agg(occurrence_date order by occurrence_date) into v_dates
  from public.mcp_schedule_occurrences('2098-01-01', 9, 'day', null, '2098-03-01', '2098-03-31');
  assert v_dates = array['2098-03-05','2098-03-14','2098-03-23']::date[], format('offset range produced %s', v_dates);

  -- every 2 weeks until a date
  select array_agg(occurrence_date order by occurrence_date) into v_dates
  from public.mcp_schedule_occurrences('2098-09-01', 2, 'week', '2098-10-01', '2098-09-15', '2098-12-31');
  assert v_dates = array['2098-09-15','2098-09-29']::date[], format('every 2 weeks produced %s', v_dates);

  -- every 3 months clamps to the anchor day
  select array_agg(occurrence_date order by occurrence_date) into v_dates
  from public.mcp_schedule_occurrences('2098-01-31', 3, 'month', null, '2098-01-01', '2099-01-31');
  assert v_dates = array['2098-01-31','2098-04-30','2098-07-31','2098-10-31','2099-01-31']::date[],
    format('every 3 months produced %s', v_dates);

  -- yearly is 12 months and survives a leap-day anchor
  select array_agg(occurrence_date order by occurrence_date) into v_dates
  from public.mcp_schedule_occurrences('2096-02-29', 12, 'month', null, '2096-01-01', '2100-12-31');
  assert v_dates = array['2096-02-29','2097-02-28','2098-02-28','2099-02-28','2100-02-28']::date[],
    format('yearly produced %s', v_dates);

  -- membership checks agree with generation
  assert public.mcp_schedule_has_occurrence('2098-01-01', null, '2098-01-10', 9, 'day');
  assert not public.mcp_schedule_has_occurrence('2098-01-01', null, '2098-01-11', 9, 'day');
  assert public.mcp_schedule_has_occurrence('2098-01-31', null, '2098-04-30', 3, 'month');
  assert not public.mcp_schedule_has_occurrence('2098-01-31', null, '2098-05-31', 3, 'month');
  assert not public.mcp_schedule_has_occurrence('2098-01-31', '2098-03-01', '2098-04-30', 3, 'month');

  -- table constraints
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then
    raise exception 'Custom recurrence test requires one synthetic auth user';
  end if;

  insert into public.finance_transaction_schedules (
    id, user_id, title, start_date, frequency, interval_count, interval_unit, state, kind, amount
  ) values (
    v_schedule_id, v_user_id, 'custom ok', '2098-01-01', 'custom', 9, 'day', 'active', 'expense', 10
  );

  begin
    insert into public.finance_transaction_schedules (
      user_id, title, start_date, frequency, interval_count, interval_unit, state, kind, amount
    ) values (v_user_id, 'daily but months', '2098-01-01', 'daily', 1, 'month', 'active', 'expense', 10);
    raise exception 'preset/interval mismatch was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.finance_transaction_schedules (
      user_id, title, start_date, frequency, interval_count, interval_unit, state, kind, amount
    ) values (v_user_id, 'zero interval', '2098-01-01', 'custom', 0, 'day', 'active', 'expense', 10);
    raise exception 'zero interval was accepted';
  exception when check_violation then
    null;
  end;
end $$;

rollback;
