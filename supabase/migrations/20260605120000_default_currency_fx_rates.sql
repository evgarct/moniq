create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_currency public.currency_code not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own"
on public.user_preferences
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own"
on public.user_preferences
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own"
on public.user_preferences
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create table if not exists public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  base_currency public.currency_code not null,
  quote_currency public.currency_code not null,
  requested_date date not null,
  rate_date date not null,
  rate numeric(20, 10) not null check (rate > 0),
  source_metadata jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint fx_rates_distinct_pair check (base_currency <> quote_currency),
  constraint fx_rates_provider_pair_date_key unique (provider, base_currency, quote_currency, requested_date)
);

create index if not exists fx_rates_pair_requested_date_idx
on public.fx_rates(provider, base_currency, quote_currency, requested_date desc);

create index if not exists fx_rates_pair_rate_date_idx
on public.fx_rates(provider, base_currency, quote_currency, rate_date desc);

drop trigger if exists fx_rates_set_updated_at on public.fx_rates;
create trigger fx_rates_set_updated_at
before update on public.fx_rates
for each row
execute function public.set_updated_at();

alter table public.fx_rates enable row level security;

drop policy if exists "fx_rates_select_authenticated" on public.fx_rates;
create policy "fx_rates_select_authenticated"
on public.fx_rates
for select
to authenticated
using (true);
