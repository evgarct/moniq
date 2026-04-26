-- Simplify transaction kinds: keep only expense, income, transfer, debt_payment.
-- Remove: save_to_goal, spend_from_goal, investment, refund, adjustment.

-- ── 1. System flag on categories ─────────────────────────────────────────────
alter table public.finance_categories
  add column if not exists is_system boolean not null default false;

-- ── 2. Remove save_to_goal / spend_from_goal entirely ────────────────────────
delete from public.finance_transactions
  where kind in ('save_to_goal', 'spend_from_goal');

delete from public.finance_transaction_schedules
  where kind in ('save_to_goal', 'spend_from_goal');

-- ── 3. investment → expense ───────────────────────────────────────────────────
update public.finance_transactions
  set kind = 'expense'::public.finance_transaction_kind,
      destination_account_id = null,
      destination_amount = null,
      fx_rate = null
  where kind = 'investment';

update public.finance_transaction_schedules
  set kind = 'expense'::public.finance_transaction_kind,
      destination_account_id = null,
      destination_amount = null,
      fx_rate = null
  where kind = 'investment';

-- ── 4. refund → income (keep category for history) ────────────────────────────
update public.finance_transactions
  set kind = 'income'::public.finance_transaction_kind,
      source_account_id = null
  where kind = 'refund';

update public.finance_transaction_schedules
  set kind = 'income'::public.finance_transaction_kind,
      source_account_id = null
  where kind = 'refund';

-- ── 5. adjustment → expense / income with a system category ──────────────────
do $$
declare
  r            record;
  exp_cat_id   uuid;
  inc_cat_id   uuid;
begin
  for r in
    select distinct user_id from public.finance_transactions where kind = 'adjustment'
  loop
    -- expense-type system category
    select id into exp_cat_id
      from public.finance_categories
      where user_id = r.user_id and is_system = true and type = 'expense'
      limit 1;

    if exp_cat_id is null then
      insert into public.finance_categories (user_id, name, type, icon, is_system)
      values (r.user_id, 'Adjustment', 'expense', 'scale', true)
      returning id into exp_cat_id;
    end if;

    -- income-type system category
    select id into inc_cat_id
      from public.finance_categories
      where user_id = r.user_id and is_system = true and type = 'income'
      limit 1;

    if inc_cat_id is null then
      insert into public.finance_categories (user_id, name, type, icon, is_system)
      values (r.user_id, 'Adjustment', 'income', 'scale', true)
      returning id into inc_cat_id;
    end if;

    -- adjustment with source → money left account → expense
    update public.finance_transactions
      set kind        = 'expense'::public.finance_transaction_kind,
          category_id = exp_cat_id,
          destination_account_id = null
      where kind = 'adjustment'
        and user_id = r.user_id
        and source_account_id is not null;

    -- adjustment with destination → money entered account → income
    update public.finance_transactions
      set kind        = 'income'::public.finance_transaction_kind,
          category_id = inc_cat_id,
          source_account_id = null
      where kind = 'adjustment'
        and user_id = r.user_id
        and destination_account_id is not null;
  end loop;
end;
$$;

-- ── 6. Drop allocation_id columns ─────────────────────────────────────────────
alter table public.finance_transactions
  drop column if exists allocation_id;

alter table public.finance_transaction_schedules
  drop column if exists allocation_id;

-- ── 7. Drop wallet_allocations table ─────────────────────────────────────────
drop table if exists public.wallet_allocations cascade;

-- ── 8. Tighten MCP batch items kind constraint ────────────────────────────────
alter table public.transaction_import_batch_items
  drop constraint if exists transaction_import_batch_items_kind_check;

alter table public.transaction_import_batch_items
  add constraint transaction_import_batch_items_kind_check
  check (kind in ('income', 'expense', 'transfer', 'debt_payment'));
