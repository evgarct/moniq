do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'finance_transaction_schedule_frequency'
      and e.enumlabel = 'custom'
  ) then
    alter type public.finance_transaction_schedule_frequency add value 'custom';
  end if;
end $$;
