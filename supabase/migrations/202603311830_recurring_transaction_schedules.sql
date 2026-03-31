do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'finance_transaction_status'
      and e.enumlabel = 'skipped'
  ) then
    begin
      alter type public.finance_transaction_status add value 'skipped';
    exception
      when duplicate_object then null;
    end;
  end if;

  if not exists (select 1 from pg_type where typname = 'finance_transaction_schedule_frequency') then
    create type public.finance_transaction_schedule_frequency as enum ('daily', 'weekly', 'monthly');
  end if;

  if not exists (select 1 from pg_type where typname = 'finance_transaction_schedule_state') then
    create type public.finance_transaction_schedule_state as enum ('active', 'paused');
  end if;
end $$;

create table if not exists public.finance_transaction_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  note text,
  start_date date not null,
  frequency public.finance_transaction_schedule_frequency not null,
  until_date date,
  state public.finance_transaction_schedule_state not null default 'active',
  kind public.finance_transaction_kind not null,
  amount numeric(14, 2) not null check (amount > 0),
  destination_amount numeric(14, 2),
  fx_rate numeric(14, 6),
  principal_amount numeric(14, 2),
  interest_amount numeric(14, 2),
  extra_principal_amount numeric(14, 2),
  category_id uuid references public.finance_categories(id) on delete set null,
  source_account_id uuid references public.wallets(id) on delete set null,
  destination_account_id uuid references public.wallets(id) on delete set null,
  allocation_id uuid references public.wallet_allocations(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.finance_transactions
  add column if not exists schedule_id uuid references public.finance_transaction_schedules(id) on delete set null,
  add column if not exists schedule_occurrence_date date,
  add column if not exists is_schedule_override boolean not null default false;

create index if not exists finance_transaction_schedules_user_id_idx on public.finance_transaction_schedules(user_id);
create index if not exists finance_transaction_schedules_state_idx on public.finance_transaction_schedules(user_id, state);
create index if not exists finance_transactions_schedule_id_idx on public.finance_transactions(schedule_id);
create unique index if not exists finance_transactions_schedule_occurrence_uidx
  on public.finance_transactions(user_id, schedule_id, schedule_occurrence_date)
  where schedule_id is not null and schedule_occurrence_date is not null;

drop trigger if exists finance_transaction_schedules_set_updated_at on public.finance_transaction_schedules;
create trigger finance_transaction_schedules_set_updated_at
before update on public.finance_transaction_schedules
for each row
execute function public.set_updated_at();

alter table public.finance_transaction_schedules enable row level security;

drop policy if exists "finance_transaction_schedules_select_own" on public.finance_transaction_schedules;
create policy "finance_transaction_schedules_select_own"
on public.finance_transaction_schedules
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "finance_transaction_schedules_insert_own" on public.finance_transaction_schedules;
create policy "finance_transaction_schedules_insert_own"
on public.finance_transaction_schedules
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "finance_transaction_schedules_update_own" on public.finance_transaction_schedules;
create policy "finance_transaction_schedules_update_own"
on public.finance_transaction_schedules
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "finance_transaction_schedules_delete_own" on public.finance_transaction_schedules;
create policy "finance_transaction_schedules_delete_own"
on public.finance_transaction_schedules
for delete
to authenticated
using (user_id = auth.uid());
