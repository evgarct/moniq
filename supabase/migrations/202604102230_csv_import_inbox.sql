drop table if exists public.enable_banking_transactions cascade;
drop table if exists public.enable_banking_accounts cascade;
drop table if exists public.enable_banking_connections cascade;
drop table if exists public.enable_banking_rules cascade;

drop type if exists public.enable_banking_connection_status;
drop type if exists public.enable_banking_transaction_status;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_import_status') then
    create type public.transaction_import_status as enum ('draft', 'confirmed', 'edited');
  end if;
end $$;

create table if not exists public.transaction_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  source text not null default 'csv',
  file_name text not null,
  imported_rows integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.transaction_import_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_pattern text not null check (char_length(trim(merchant_pattern)) > 0),
  category_id uuid not null references public.finance_categories(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.transaction_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references public.transaction_import_batches(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  finance_transaction_id uuid references public.finance_transactions(id) on delete set null,
  external_id text,
  row_index integer not null,
  fingerprint text not null,
  amount numeric(14, 2) not null,
  currency text not null,
  occurred_at date not null,
  merchant_raw text not null,
  merchant_clean text not null,
  category_id uuid references public.finance_categories(id) on delete set null,
  status public.transaction_import_status not null default 'draft',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists transaction_import_batches_user_id_idx
  on public.transaction_import_batches(user_id, created_at desc);

create index if not exists transaction_import_batches_wallet_id_idx
  on public.transaction_import_batches(wallet_id, created_at desc);

create index if not exists transaction_import_rules_user_id_idx
  on public.transaction_import_rules(user_id, created_at desc);

create index if not exists transaction_imports_user_id_idx
  on public.transaction_imports(user_id, occurred_at desc, created_at desc);

create index if not exists transaction_imports_wallet_id_idx
  on public.transaction_imports(wallet_id, occurred_at desc);

create index if not exists transaction_imports_batch_id_idx
  on public.transaction_imports(batch_id, row_index);

create unique index if not exists transaction_imports_external_id_unique
  on public.transaction_imports(user_id, wallet_id, external_id)
  where external_id is not null;

create unique index if not exists transaction_imports_fingerprint_unique
  on public.transaction_imports(user_id, wallet_id, fingerprint);

drop trigger if exists transaction_import_rules_set_updated_at on public.transaction_import_rules;
create trigger transaction_import_rules_set_updated_at
before update on public.transaction_import_rules
for each row
execute function public.set_updated_at();

drop trigger if exists transaction_imports_set_updated_at on public.transaction_imports;
create trigger transaction_imports_set_updated_at
before update on public.transaction_imports
for each row
execute function public.set_updated_at();

alter table public.transaction_import_batches enable row level security;
alter table public.transaction_import_rules enable row level security;
alter table public.transaction_imports enable row level security;

drop policy if exists "transaction_import_batches_select_own" on public.transaction_import_batches;
create policy "transaction_import_batches_select_own"
on public.transaction_import_batches
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "transaction_import_batches_insert_own" on public.transaction_import_batches;
create policy "transaction_import_batches_insert_own"
on public.transaction_import_batches
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "transaction_import_batches_update_own" on public.transaction_import_batches;
create policy "transaction_import_batches_update_own"
on public.transaction_import_batches
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "transaction_import_batches_delete_own" on public.transaction_import_batches;
create policy "transaction_import_batches_delete_own"
on public.transaction_import_batches
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "transaction_import_rules_select_own" on public.transaction_import_rules;
create policy "transaction_import_rules_select_own"
on public.transaction_import_rules
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "transaction_import_rules_insert_own" on public.transaction_import_rules;
create policy "transaction_import_rules_insert_own"
on public.transaction_import_rules
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "transaction_import_rules_update_own" on public.transaction_import_rules;
create policy "transaction_import_rules_update_own"
on public.transaction_import_rules
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "transaction_import_rules_delete_own" on public.transaction_import_rules;
create policy "transaction_import_rules_delete_own"
on public.transaction_import_rules
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "transaction_imports_select_own" on public.transaction_imports;
create policy "transaction_imports_select_own"
on public.transaction_imports
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "transaction_imports_insert_own" on public.transaction_imports;
create policy "transaction_imports_insert_own"
on public.transaction_imports
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "transaction_imports_update_own" on public.transaction_imports;
create policy "transaction_imports_update_own"
on public.transaction_imports
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "transaction_imports_delete_own" on public.transaction_imports;
create policy "transaction_imports_delete_own"
on public.transaction_imports
for delete
to authenticated
using (user_id = auth.uid());
