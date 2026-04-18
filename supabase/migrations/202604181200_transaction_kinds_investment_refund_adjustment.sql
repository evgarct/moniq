-- Add new transaction kind values to the enum.
-- Postgres requires each ADD VALUE to be a separate statement.
alter type public.finance_transaction_kind add value if not exists 'investment';
alter type public.finance_transaction_kind add value if not exists 'refund';
alter type public.finance_transaction_kind add value if not exists 'adjustment';
