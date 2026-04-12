alter table public.transaction_imports
  add column if not exists kind text not null default 'expense'
    check (kind in ('expense', 'income', 'transfer')),
  add column if not exists counterpart_wallet_id uuid references public.wallets(id) on delete set null;

create index if not exists transaction_imports_counterpart_wallet_id_idx
  on public.transaction_imports(counterpart_wallet_id, occurred_at desc);

create table if not exists public.transaction_import_column_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signature text not null,
  mapping jsonb not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists transaction_import_column_presets_user_signature_unique
  on public.transaction_import_column_presets(user_id, signature);

drop trigger if exists transaction_import_column_presets_set_updated_at on public.transaction_import_column_presets;
create trigger transaction_import_column_presets_set_updated_at
before update on public.transaction_import_column_presets
for each row
execute function public.set_updated_at();

alter table public.transaction_import_column_presets enable row level security;

drop policy if exists "transaction_import_column_presets_select_own" on public.transaction_import_column_presets;
create policy "transaction_import_column_presets_select_own"
on public.transaction_import_column_presets
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "transaction_import_column_presets_insert_own" on public.transaction_import_column_presets;
create policy "transaction_import_column_presets_insert_own"
on public.transaction_import_column_presets
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "transaction_import_column_presets_update_own" on public.transaction_import_column_presets;
create policy "transaction_import_column_presets_update_own"
on public.transaction_import_column_presets
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "transaction_import_column_presets_delete_own" on public.transaction_import_column_presets;
create policy "transaction_import_column_presets_delete_own"
on public.transaction_import_column_presets
for delete
to authenticated
using (user_id = auth.uid());
