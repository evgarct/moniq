-- The native iPhone client mirrors these user-scoped tables into SwiftData.
-- RLS remains authoritative; Realtime only invalidates the local snapshot and
-- the client always re-fetches the full namespace through the Data API.
do $$
declare
  table_name text;
  table_oid regclass;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['wallets', 'wallet_allocations', 'finance_transactions'] loop
      table_oid := format('public.%I', table_name)::regclass;
      if not exists (
        select 1
        from pg_publication_rel relation
        join pg_publication publication on publication.oid = relation.prpubid
        where publication.pubname = 'supabase_realtime'
          and relation.prrelid = table_oid
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end
$$;
