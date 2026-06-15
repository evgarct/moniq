do $$
begin
  if not exists (select 1 from pg_type where typname = 'investment_instrument_type') then
    create type public.investment_instrument_type as enum ('stock', 'etf');
  end if;
end $$;

create table public.investment_instruments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  type public.investment_instrument_type not null,
  ticker text not null check (char_length(trim(ticker)) > 0),
  exchange text not null check (char_length(trim(exchange)) > 0),
  quote_currency public.currency_code not null,
  isin text,
  provider text not null default 'fmp',
  provider_symbol text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint investment_instruments_provider_symbol_key unique (provider, provider_symbol)
);

create unique index investment_instruments_isin_exchange_key
  on public.investment_instruments (isin, exchange)
  where isin is not null;

create table public.investment_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.investment_instruments(id) on delete restrict,
  opening_units numeric(24, 8) not null default 0 check (opening_units >= 0),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint investment_positions_user_instrument_key unique (user_id, instrument_id)
);

create table public.investment_quotes (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.investment_instruments(id) on delete cascade,
  provider text not null,
  market_date date not null,
  price numeric(24, 8) not null check (price > 0),
  currency public.currency_code not null,
  fetched_at timestamptz not null default timezone('utc'::text, now()),
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint investment_quotes_instrument_provider_date_key unique (instrument_id, provider, market_date)
);

alter table public.finance_transactions
  add column investment_instrument_id uuid references public.investment_instruments(id) on delete restrict,
  add column investment_units numeric(24, 8);

alter table public.finance_transactions
  add constraint finance_transactions_investment_pair_check
  check (
    (investment_instrument_id is null and investment_units is null)
    or (
      investment_instrument_id is not null
      and investment_units > 0
      and kind = 'expense'
    )
  );

create index investment_positions_user_id_idx on public.investment_positions(user_id);
create index investment_quotes_instrument_date_idx on public.investment_quotes(instrument_id, market_date desc);
create index finance_transactions_investment_instrument_idx
  on public.finance_transactions(user_id, investment_instrument_id)
  where investment_instrument_id is not null;

create trigger investment_instruments_set_updated_at
before update on public.investment_instruments
for each row execute function public.set_updated_at();

create trigger investment_positions_set_updated_at
before update on public.investment_positions
for each row execute function public.set_updated_at();

create trigger investment_quotes_set_updated_at
before update on public.investment_quotes
for each row execute function public.set_updated_at();

alter table public.investment_instruments enable row level security;
alter table public.investment_positions enable row level security;
alter table public.investment_quotes enable row level security;

create policy "investment_instruments_select_authenticated"
on public.investment_instruments for select to authenticated using (true);

create policy "investment_positions_select_own"
on public.investment_positions for select to authenticated using ((select auth.uid()) = user_id);
create policy "investment_positions_insert_own"
on public.investment_positions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "investment_positions_update_own"
on public.investment_positions for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "investment_positions_delete_own"
on public.investment_positions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "investment_quotes_select_authenticated"
on public.investment_quotes for select to authenticated using (true);

grant select on public.investment_instruments to authenticated;
grant select, insert, update, delete on public.investment_positions to authenticated;
grant select on public.investment_quotes to authenticated;
revoke all on public.investment_instruments from anon;
revoke all on public.investment_positions from anon;
revoke all on public.investment_quotes from anon;

insert into public.investment_instruments (
  name, type, ticker, exchange, quote_currency, isin, provider, provider_symbol
)
values
  ('Vanguard S&P 500 UCITS ETF USD Accumulating', 'etf', 'VUAA', 'XETRA', 'EUR', 'IE00BFMXXD54', 'fmp', 'VUAA.DE'),
  ('State Street SPDR S&P 500 UCITS ETF Acc', 'etf', 'SPYL', 'XETRA', 'EUR', 'IE000XZSV718', 'fmp', 'SPYL.DE')
on conflict (provider, provider_symbol) do update set
  name = excluded.name,
  type = excluded.type,
  ticker = excluded.ticker,
  exchange = excluded.exchange,
  quote_currency = excluded.quote_currency,
  isin = excluded.isin;
