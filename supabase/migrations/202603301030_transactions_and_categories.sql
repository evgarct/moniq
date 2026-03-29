do $$
begin
  if not exists (select 1 from pg_type where typname = 'finance_category_type') then
    create type public.finance_category_type as enum ('income', 'expense');
  end if;

  if not exists (select 1 from pg_type where typname = 'finance_transaction_kind') then
    create type public.finance_transaction_kind as enum (
      'income',
      'expense',
      'transfer',
      'save_to_goal',
      'spend_from_goal',
      'debt_payment'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'finance_transaction_status') then
    create type public.finance_transaction_status as enum ('planned', 'paid');
  end if;
end $$;

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  icon text,
  type public.finance_category_type not null,
  parent_id uuid references public.finance_categories(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  note text,
  occurred_at date not null,
  status public.finance_transaction_status not null default 'paid',
  kind public.finance_transaction_kind not null,
  amount numeric(14, 2) not null check (amount > 0),
  destination_amount numeric(14, 2),
  fx_rate numeric(14, 6),
  principal_amount numeric(14, 2),
  interest_amount numeric(14, 2),
  extra_principal_amount numeric(14, 2),
  category_id uuid references public.finance_categories(id) on delete restrict,
  source_account_id uuid references public.wallets(id) on delete set null,
  destination_account_id uuid references public.wallets(id) on delete set null,
  allocation_id uuid references public.wallet_allocations(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists finance_categories_user_id_idx on public.finance_categories(user_id);
create index if not exists finance_categories_parent_id_idx on public.finance_categories(parent_id);
create index if not exists finance_transactions_user_id_idx on public.finance_transactions(user_id);
create index if not exists finance_transactions_occurred_at_idx on public.finance_transactions(user_id, occurred_at desc);
create index if not exists finance_transactions_category_id_idx on public.finance_transactions(category_id);

drop trigger if exists finance_categories_set_updated_at on public.finance_categories;
create trigger finance_categories_set_updated_at
before update on public.finance_categories
for each row
execute function public.set_updated_at();

drop trigger if exists finance_transactions_set_updated_at on public.finance_transactions;
create trigger finance_transactions_set_updated_at
before update on public.finance_transactions
for each row
execute function public.set_updated_at();

alter table public.finance_categories enable row level security;
alter table public.finance_transactions enable row level security;

drop policy if exists "finance_categories_select_own" on public.finance_categories;
create policy "finance_categories_select_own"
on public.finance_categories
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "finance_categories_insert_own" on public.finance_categories;
create policy "finance_categories_insert_own"
on public.finance_categories
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "finance_categories_update_own" on public.finance_categories;
create policy "finance_categories_update_own"
on public.finance_categories
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "finance_categories_delete_own" on public.finance_categories;
create policy "finance_categories_delete_own"
on public.finance_categories
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "finance_transactions_select_own" on public.finance_transactions;
create policy "finance_transactions_select_own"
on public.finance_transactions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "finance_transactions_insert_own" on public.finance_transactions;
create policy "finance_transactions_insert_own"
on public.finance_transactions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "finance_transactions_update_own" on public.finance_transactions;
create policy "finance_transactions_update_own"
on public.finance_transactions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "finance_transactions_delete_own" on public.finance_transactions;
create policy "finance_transactions_delete_own"
on public.finance_transactions
for delete
to authenticated
using (user_id = auth.uid());
