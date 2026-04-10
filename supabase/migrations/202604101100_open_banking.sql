create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requisition_id text not null,
  provider_account_id text not null,
  name text not null,
  iban text null,
  currency text null,
  last_sync_date date null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, provider_account_id)
);

create table if not exists bank_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_pattern text not null,
  category text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, merchant_pattern)
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'bank_transaction_status') then
    create type bank_transaction_status as enum ('draft', 'confirmed', 'edited');
  end if;
end
$$;

create table if not exists bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references bank_accounts(id) on delete cascade,
  provider_transaction_id text null,
  amount numeric(14,2) not null,
  currency text not null,
  date date not null,
  merchant_raw text not null,
  merchant_clean text not null,
  category text null,
  status bank_transaction_status not null default 'draft',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists bank_transactions_provider_tx_idx
  on bank_transactions (user_id, provider_transaction_id)
  where provider_transaction_id is not null;

create unique index if not exists bank_transactions_dedupe_idx
  on bank_transactions (user_id, account_id, amount, date, merchant_raw);

alter table bank_accounts enable row level security;
alter table bank_rules enable row level security;
alter table bank_transactions enable row level security;

create policy "bank_accounts_owner_select" on bank_accounts for select using (auth.uid() = user_id);
create policy "bank_accounts_owner_insert" on bank_accounts for insert with check (auth.uid() = user_id);
create policy "bank_accounts_owner_update" on bank_accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "bank_rules_owner_select" on bank_rules for select using (auth.uid() = user_id);
create policy "bank_rules_owner_insert" on bank_rules for insert with check (auth.uid() = user_id);
create policy "bank_rules_owner_update" on bank_rules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "bank_transactions_owner_select" on bank_transactions for select using (auth.uid() = user_id);
create policy "bank_transactions_owner_insert" on bank_transactions for insert with check (auth.uid() = user_id);
create policy "bank_transactions_owner_update" on bank_transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function set_bank_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_bank_accounts_updated_at on bank_accounts;
create trigger set_bank_accounts_updated_at before update on bank_accounts for each row execute function set_bank_updated_at();

drop trigger if exists set_bank_rules_updated_at on bank_rules;
create trigger set_bank_rules_updated_at before update on bank_rules for each row execute function set_bank_updated_at();

drop trigger if exists set_bank_transactions_updated_at on bank_transactions;
create trigger set_bank_transactions_updated_at before update on bank_transactions for each row execute function set_bank_updated_at();
