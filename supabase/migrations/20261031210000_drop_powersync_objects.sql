-- The web app no longer runs PowerSync or the offline command outbox (PR #161).
-- Remove the replication publication, its source role and the unused mutation log.
-- The sync_version columns and bump triggers stay: the finance snapshot still reads them.

drop publication if exists powersync;

drop table if exists public.finance_sync_mutations;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    -- Dropping a role's objects needs membership in it; the grant disappears with the role.
    grant powersync_role to current_user;
    drop owned by powersync_role;
    drop role powersync_role;
  end if;
end;
$$;
