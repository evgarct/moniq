\set ON_ERROR_STOP on

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'wallets', 'wallet_allocations', 'finance_categories',
    'finance_transactions', 'finance_transaction_schedules', 'user_preferences'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and information_schema.columns.table_name = v_table and column_name = 'sync_version'
    ) then
      raise exception 'Missing %.sync_version', v_table;
    end if;
    if not (select relrowsecurity from pg_class where oid = format('public.%I', v_table)::regclass) then
      raise exception 'RLS is disabled for %', v_table;
    end if;
  end loop;
end;
$$;

do $$
begin
  if has_function_privilege('public', 'public.bump_sync_version()', 'execute')
    or has_function_privilege('anon', 'public.bump_sync_version()', 'execute')
    or has_function_privilege('authenticated', 'public.bump_sync_version()', 'execute') then
    raise exception 'bump_sync_version has an unsafe execute grant';
  end if;
  if has_function_privilege('anon', 'public.create_wallet_with_id(uuid,text,public.wallet_type,numeric,public.currency_code,public.debt_kind)', 'execute')
    or not has_function_privilege('authenticated', 'public.create_wallet_with_id(uuid,text,public.wallet_type,numeric,public.currency_code,public.debt_kind)', 'execute') then
    raise exception 'create_wallet_with_id grants are incorrect';
  end if;
  if has_table_privilege('anon', 'public.finance_sync_mutations', 'select')
    or has_table_privilege('authenticated', 'public.finance_sync_mutations', 'insert') then
    raise exception 'finance_sync_mutations grants are too broad';
  end if;
end;
$$;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $$
begin
  if exists (select 1 from public.wallets where user_id <> auth.uid())
    or exists (select 1 from public.finance_transactions where user_id <> auth.uid())
    or exists (select 1 from public.finance_categories where user_id <> auth.uid()) then
    raise exception 'RLS tenant isolation failed';
  end if;
end;
$$;
rollback;
