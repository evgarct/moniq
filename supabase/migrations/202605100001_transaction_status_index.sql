-- Index to support the (user_id, occurred_at) OR (user_id, status = 'planned') query
-- used when loading the finance snapshot with a 12-month history cutoff.
create index if not exists finance_transactions_status_idx
  on public.finance_transactions(user_id, status)
  where status = 'planned';
