-- Replicate only data used by the local-first read model. Keeping the
-- publication explicit avoids sending unrelated Supabase tables through WAL.
do $$
declare
  v_table regclass;
begin
  if not exists (select 1 from pg_publication where pubname = 'powersync') then
    create publication powersync;
  end if;

  foreach v_table in array array[
    'public.wallets'::regclass,
    'public.wallet_allocations'::regclass,
    'public.finance_categories'::regclass,
    'public.finance_transactions'::regclass,
    'public.finance_transaction_schedules'::regclass,
    'public.user_preferences'::regclass,
    'public.investment_positions'::regclass,
    'public.investment_instruments'::regclass,
    'public.investment_quotes'::regclass,
    'public.fx_rates'::regclass
  ] loop
    if not exists (
      select 1
      from pg_publication_rel relation
      join pg_publication publication on publication.oid = relation.prpubid
      where publication.pubname = 'powersync' and relation.prrelid = v_table
    ) then
      execute format('alter publication powersync add table %s', v_table);
    end if;
  end loop;
end;
$$;
