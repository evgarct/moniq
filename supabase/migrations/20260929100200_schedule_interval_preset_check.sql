-- A preset frequency is a label for a fixed (interval_count, interval_unit) pair; only
-- `custom` may carry any pair. Keeps direct inserts from storing e.g. daily + month.
alter table public.finance_transaction_schedules
  drop constraint if exists finance_transaction_schedules_preset_interval_check,
  add constraint finance_transaction_schedules_preset_interval_check check (
    frequency::text = 'custom'
    or (frequency::text, interval_count, interval_unit) in (
      ('daily', 1, 'day'),
      ('weekly', 1, 'week'),
      ('monthly', 1, 'month'),
      ('quarterly', 3, 'month'),
      ('yearly', 12, 'month')
    )
  );
