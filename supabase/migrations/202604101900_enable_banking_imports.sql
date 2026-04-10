do $$
begin
  if not exists (select 1 from pg_type where typname = 'enable_banking_connection_status') then
    create type public.enable_banking_connection_status as enum ('pending', 'connected', 'error');
  end if;

  if not exists (select 1 from pg_type where typname = 'enable_banking_transaction_status') then
    create type public.enable_banking_transaction_status as enum ('draft', 'confirmed', 'edited');
  end if;
end $$;

create table if not exists public.enable_banking_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'enable_banking',
  aspsp_name text not null,
  session_id text,
  session_secret text,
  state text not null,
  redirect_url text not null,
  status public.enable_banking_connection_status not null default 'pending',
  last_error text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, state)
);

create table if not exists public.enable_banking_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.enable_banking_connections(id) on delete cascade,
  wallet_id uuid references public.wallets(id) on delete set null,
  provider_account_id text not null,
  name text not null,
  currency text not null,
  iban text,
  institution_name text,
  last_sync_date timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, provider_account_id)
);

create table if not exists public.enable_banking_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_pattern text not null check (char_length(trim(merchant_pattern)) > 0),
  category_id uuid not null references public.finance_categories(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.enable_banking_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.enable_banking_connections(id) on delete cascade,
  banking_account_id uuid not null references public.enable_banking_accounts(id) on delete cascade,
  finance_transaction_id uuid references public.finance_transactions(id) on delete set null,
  external_id text,
  fingerprint text not null,
  amount numeric(14, 2) not null,
  currency text not null,
  transaction_date date not null,
  merchant_raw text not null,
  merchant_clean text not null,
  category_id uuid references public.finance_categories(id) on delete set null,
  status public.enable_banking_transaction_status not null default 'draft',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists enable_banking_connections_user_id_idx
  on public.enable_banking_connections(user_id, created_at desc);

create index if not exists enable_banking_accounts_user_id_idx
  on public.enable_banking_accounts(user_id, created_at desc);

create index if not exists enable_banking_accounts_connection_id_idx
  on public.enable_banking_accounts(connection_id);

create index if not exists enable_banking_rules_user_id_idx
  on public.enable_banking_rules(user_id, created_at desc);

create index if not exists enable_banking_transactions_user_id_idx
  on public.enable_banking_transactions(user_id, transaction_date desc, created_at desc);

create index if not exists enable_banking_transactions_account_id_idx
  on public.enable_banking_transactions(banking_account_id, transaction_date desc);

create unique index if not exists enable_banking_transactions_external_id_unique
  on public.enable_banking_transactions(user_id, external_id)
  where external_id is not null;

create unique index if not exists enable_banking_transactions_fingerprint_unique
  on public.enable_banking_transactions(user_id, banking_account_id, fingerprint);

drop trigger if exists enable_banking_connections_set_updated_at on public.enable_banking_connections;
create trigger enable_banking_connections_set_updated_at
before update on public.enable_banking_connections
for each row
execute function public.set_updated_at();

drop trigger if exists enable_banking_accounts_set_updated_at on public.enable_banking_accounts;
create trigger enable_banking_accounts_set_updated_at
before update on public.enable_banking_accounts
for each row
execute function public.set_updated_at();

drop trigger if exists enable_banking_rules_set_updated_at on public.enable_banking_rules;
create trigger enable_banking_rules_set_updated_at
before update on public.enable_banking_rules
for each row
execute function public.set_updated_at();

drop trigger if exists enable_banking_transactions_set_updated_at on public.enable_banking_transactions;
create trigger enable_banking_transactions_set_updated_at
before update on public.enable_banking_transactions
for each row
execute function public.set_updated_at();

alter table public.enable_banking_connections enable row level security;
alter table public.enable_banking_accounts enable row level security;
alter table public.enable_banking_rules enable row level security;
alter table public.enable_banking_transactions enable row level security;

drop policy if exists "enable_banking_connections_select_own" on public.enable_banking_connections;
create policy "enable_banking_connections_select_own"
on public.enable_banking_connections
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "enable_banking_connections_insert_own" on public.enable_banking_connections;
create policy "enable_banking_connections_insert_own"
on public.enable_banking_connections
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "enable_banking_connections_update_own" on public.enable_banking_connections;
create policy "enable_banking_connections_update_own"
on public.enable_banking_connections
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "enable_banking_connections_delete_own" on public.enable_banking_connections;
create policy "enable_banking_connections_delete_own"
on public.enable_banking_connections
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "enable_banking_accounts_select_own" on public.enable_banking_accounts;
create policy "enable_banking_accounts_select_own"
on public.enable_banking_accounts
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "enable_banking_accounts_insert_own" on public.enable_banking_accounts;
create policy "enable_banking_accounts_insert_own"
on public.enable_banking_accounts
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "enable_banking_accounts_update_own" on public.enable_banking_accounts;
create policy "enable_banking_accounts_update_own"
on public.enable_banking_accounts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "enable_banking_accounts_delete_own" on public.enable_banking_accounts;
create policy "enable_banking_accounts_delete_own"
on public.enable_banking_accounts
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "enable_banking_rules_select_own" on public.enable_banking_rules;
create policy "enable_banking_rules_select_own"
on public.enable_banking_rules
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "enable_banking_rules_insert_own" on public.enable_banking_rules;
create policy "enable_banking_rules_insert_own"
on public.enable_banking_rules
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "enable_banking_rules_update_own" on public.enable_banking_rules;
create policy "enable_banking_rules_update_own"
on public.enable_banking_rules
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "enable_banking_rules_delete_own" on public.enable_banking_rules;
create policy "enable_banking_rules_delete_own"
on public.enable_banking_rules
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "enable_banking_transactions_select_own" on public.enable_banking_transactions;
create policy "enable_banking_transactions_select_own"
on public.enable_banking_transactions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "enable_banking_transactions_insert_own" on public.enable_banking_transactions;
create policy "enable_banking_transactions_insert_own"
on public.enable_banking_transactions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "enable_banking_transactions_update_own" on public.enable_banking_transactions;
create policy "enable_banking_transactions_update_own"
on public.enable_banking_transactions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "enable_banking_transactions_delete_own" on public.enable_banking_transactions;
create policy "enable_banking_transactions_delete_own"
on public.enable_banking_transactions
for delete
to authenticated
using (user_id = auth.uid());
