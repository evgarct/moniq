-- Synthetic-only rollback suite for monthly category budgets (table, validation, MCP RPCs, isolation).
-- Run after migration resets and seed (needs two @example.invalid personas), before promotion.
begin;
create or replace function pg_temp.b(c uuid, a numeric) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('category_id', c, 'budget_amount', a))
$$;
do $$
declare
  u uuid; other_u uuid;
  enjoy uuid:=gen_random_uuid(); child uuid:=gen_random_uuid(); income uuid:=gen_random_uuid();
  key_hash text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  other_hash text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  result jsonb; rows jsonb; failed boolean; msg text;
begin
  select id into u from auth.users where email like '%@example.invalid' order by created_at limit 1;
  select id into other_u from auth.users where email like '%@example.invalid' and id<>u order by created_at limit 1;
  if u is null or other_u is null then raise exception 'Synthetic personas required'; end if;

  insert into public.finance_categories(id,user_id,name,type,description) values(enjoy,u,'Budget test enjoy','expense','[budget: 9000] fun');
  insert into public.finance_categories(id,user_id,name,type,parent_id) values(child,u,'Budget test child','expense',enjoy);
  insert into public.finance_categories(id,user_id,name,type) values(income,u,'Budget test income','income');
  insert into public.mcp_api_keys(user_id,name,key_hash,key_prefix) values(u,'Budget test',key_hash,'test'),(other_u,'Budget other',other_hash,'test');

  -- Without month/scope the call keeps its old meaning: the base prefix changes, no layer row appears.
  result:=public.mcp_set_category_budgets(key_hash,pg_temp.b(enjoy,9000));
  if (select count(*) from public.finance_category_budgets where category_id=enjoy)<>0 then raise exception 'Base call must not create layers'; end if;

  -- Override November only: one month-scoped row, the prefix stays the base.
  result:=public.mcp_set_category_budgets(key_hash,pg_temp.b(enjoy,49900),'2026-11','month');
  if result->'budgets'->0->>'scope'<>'month' or result->'budgets'->0->>'month'<>'2026-11' then raise exception 'Result must echo month and scope'; end if;
  rows:=public.mcp_get_category_budgets(key_hash);
  if (select count(*) from jsonb_array_elements(rows) r where (r->>'category_id')::uuid=enjoy and r->>'scope'='month' and r->>'month'='2026-11-01' and (r->>'amount')::numeric=49900)<>1
    then raise exception 'November override row missing'; end if;
  if (select description from public.finance_categories where id=enjoy) not like '[budget: 9000]%' then raise exception 'Override must not touch the base prefix'; end if;

  -- Replaying the same call keeps exactly one row (idempotent upsert).
  perform public.mcp_set_category_budgets(key_hash,pg_temp.b(enjoy,49900),'2026-11','month');
  if (select count(*) from public.finance_category_budgets where category_id=enjoy and scope='month')<>1 then raise exception 'Replay must not duplicate the override'; end if;

  -- From December onward: a separate base row; the November override and earlier months are untouched.
  perform public.mcp_set_category_budgets(key_hash,pg_temp.b(enjoy,13000),'2026-12','from_month');
  if (select count(*) from public.finance_category_budgets where category_id=enjoy and scope='from' and month=date '2026-12-01' and amount=13000)<>1
    then raise exception 'December base row missing'; end if;
  if (select count(*) from public.finance_category_budgets where category_id=enjoy and scope='month' and month=date '2026-11-01' and amount=49900)<>1
    then raise exception 'November override changed by a from-month write'; end if;

  -- Clearing removes only the month override and keeps the base layers.
  result:=public.mcp_clear_budget_override(key_hash,enjoy,'2026-11');
  if (result->>'cleared')::boolean is not true then raise exception 'Clear must report cleared'; end if;
  if (select count(*) from public.finance_category_budgets where category_id=enjoy and scope='month')<>0
    or (select count(*) from public.finance_category_budgets where category_id=enjoy and scope='from')<>1
    then raise exception 'Clear must remove only the month override'; end if;
  failed:=false;
  begin perform public.mcp_clear_budget_override(key_hash,enjoy,'2026-11'); exception when others then failed:=true; msg:=sqlerrm; end;
  if not failed or msg not like 'No budget override%' then raise exception 'Clearing a missing override must fail clearly'; end if;

  -- Invalid input is rejected and leaves nothing behind (all or nothing).
  failed:=false;
  begin perform public.mcp_set_category_budgets(key_hash,pg_temp.b(enjoy,1)||pg_temp.b(child,1),'2026-11','month'); exception when others then failed:=true; end;
  if not failed or (select count(*) from public.finance_category_budgets where category_id=enjoy and scope='month')<>0 then raise exception 'Subcategory in a batch must roll the whole call back'; end if;
  failed:=false;
  begin perform public.mcp_set_category_budgets(key_hash,pg_temp.b(income,1),'2026-11','month'); exception when others then failed:=true; end;
  if not failed then raise exception 'Income category must not take a budget'; end if;
  failed:=false;
  begin perform public.mcp_set_category_budgets(key_hash,pg_temp.b(enjoy,null),'2026-11','month'); exception when others then failed:=true; end;
  if not failed then raise exception 'A month override needs an amount'; end if;
  failed:=false;
  begin perform public.mcp_set_category_budgets(key_hash,pg_temp.b(enjoy,1),'2026-11',null); exception when others then failed:=true; end;
  if not failed then raise exception 'month without scope must fail'; end if;
  failed:=false;
  begin perform public.mcp_set_category_budgets(key_hash,pg_temp.b(enjoy,1),'2026-13','month'); exception when others then failed:=true; end;
  if not failed then raise exception 'Invalid month must fail'; end if;
  failed:=false;
  begin perform public.mcp_set_category_budgets(key_hash,pg_temp.b(enjoy,-5),'2026-11','month'); exception when others then failed:=true; end;
  if not failed then raise exception 'Negative amount must fail'; end if;

  -- A "from" row may clear the plan (null); the table itself also rejects bad rows and non-first days.
  perform public.mcp_set_category_budgets(key_hash,pg_temp.b(enjoy,null),'2027-01','from_month');
  if (select count(*) from public.finance_category_budgets where category_id=enjoy and scope='from' and month=date '2027-01-01' and amount is null)<>1
    then raise exception 'A from-month null must be stored'; end if;
  failed:=false;
  begin insert into public.finance_category_budgets(user_id,category_id,month,scope,amount) values(u,enjoy,date '2026-11-15','month',1); exception when check_violation then failed:=true; end;
  if not failed then raise exception 'Month must be the first day'; end if;
  failed:=false;
  begin insert into public.finance_category_budgets(user_id,category_id,month,scope,amount) values(u,child,date '2026-11-01','month',1); exception when others then failed:=true; end;
  if not failed then raise exception 'Table trigger must reject subcategories'; end if;

  -- Tenant isolation: another user's key neither sees nor edits these rows.
  rows:=public.mcp_get_category_budgets(other_hash);
  if (select count(*) from jsonb_array_elements(rows) r where (r->>'category_id')::uuid=enjoy)<>0 then raise exception 'Budget rows leaked to another user'; end if;
  failed:=false;
  begin perform public.mcp_set_category_budgets(other_hash,pg_temp.b(enjoy,1),'2026-11','month'); exception when others then failed:=true; end;
  if not failed then raise exception 'Another user must not write budgets'; end if;
  failed:=false;
  begin perform public.mcp_clear_budget_override(other_hash,enjoy,'2026-12'); exception when others then failed:=true; end;
  if not failed then raise exception 'Another user must not clear overrides'; end if;

  -- Grants: only the key-hash wrappers are executable by MCP roles; the validation trigger function is not.
  if not has_function_privilege('anon','public.mcp_get_category_budgets(text)','execute')
    or not has_function_privilege('anon','public.mcp_set_category_budgets(text,jsonb,text,text)','execute')
    or not has_function_privilege('anon','public.mcp_clear_budget_override(text,uuid,text)','execute')
    then raise exception 'MCP wrappers must be executable'; end if;
  if has_function_privilege('anon','public.finance_category_budgets_validate()','execute')
    or has_function_privilege('authenticated','public.finance_category_budgets_validate()','execute')
    then raise exception 'Validation trigger function must not be executable by API roles'; end if;
  if has_table_privilege('anon','public.finance_category_budgets','select')
    then raise exception 'anon must not read budget rows'; end if;

  -- Deleting a category removes its layers.
  delete from public.finance_categories where id=enjoy;
  if (select count(*) from public.finance_category_budgets where category_id=enjoy)<>0 then raise exception 'Layers must cascade with the category'; end if;
end $$;
rollback;
