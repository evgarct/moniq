-- Synthetic-only rollback suite for the spending forecast source, storage and MCP read.
-- Run after migration resets and seed (needs two @example.invalid personas), before promotion.
begin;
do $$
declare
  u uuid; other_u uuid;
  w uuid:=gen_random_uuid(); other_w uuid:=gen_random_uuid();
  cafe uuid:=gen_random_uuid(); cafe_child uuid:=gen_random_uuid(); transfer_cat uuid:=gen_random_uuid();
  schedule uuid:=gen_random_uuid(); paused uuid:=gen_random_uuid(); debt_w uuid:=gen_random_uuid();
  key_hash text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  other_hash text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  source jsonb; result jsonb; failed boolean;
  today date:=current_date; month_first date:=date_trunc('month', current_date)::date;
begin
  select id into u from auth.users where email like '%@example.invalid' order by created_at limit 1;
  select id into other_u from auth.users where email like '%@example.invalid' and id<>u order by created_at limit 1;
  if u is null or other_u is null then raise exception 'Synthetic personas required'; end if;

  insert into public.wallets(id,user_id,name,type,currency,balance) values(w,u,'Forecast CZK','cash','CZK',100000),(other_w,other_u,'Other CZK','cash','CZK',100000);
  insert into public.user_preferences(user_id,default_currency) values(u,'CZK') on conflict (user_id) do update set default_currency='CZK';
  insert into public.finance_categories(id,user_id,name,type,description) values(cafe,u,'Forecast cafe','expense','[budget: 3000] coffee');
  insert into public.finance_categories(id,user_id,name,type,parent_id) values(cafe_child,u,'Forecast beans','expense',cafe),(transfer_cat,u,'Forecast other','expense',null);
  insert into public.mcp_api_keys(user_id,name,key_hash,key_prefix) values(u,'Forecast test',key_hash,'test'),(other_u,'Forecast other',other_hash,'test');

  -- History: one paid expense counts; a paid transfer, a planned row and another user's expense must not.
  insert into public.finance_transactions(user_id,title,occurred_at,status,kind,amount,source_account_id,category_id)
    values(u,'Beans',today-2,'paid','expense',123.45,w,cafe_child),
          (other_u,'Foreign beans',today-2,'paid','expense',999.99,other_w,null);
  insert into public.finance_transactions(user_id,title,occurred_at,status,kind,amount,destination_amount,source_account_id,destination_account_id)
    values(u,'Move money',today-1,'paid','transfer',543.21,543.21,w,w);

  -- Debt payments count only their interest, like the Budget screen: 77.01 of 177.01 is spending, a
  -- principal-only payment is not; an upcoming payment contributes its interest too.
  insert into public.wallets(id,user_id,name,type,currency,balance) values(debt_w,u,'Forecast debt','debt','CZK',-5000);
  insert into public.finance_transactions(user_id,title,occurred_at,status,kind,amount,principal_amount,interest_amount,extra_principal_amount,source_account_id,destination_account_id,category_id)
    values(u,'Debt with interest',today-1,'paid','debt_payment',177.01,100,77.01,0,w,debt_w,cafe),
          (u,'Debt principal only',today-1,'paid','debt_payment',500,500,0,0,w,debt_w,cafe),
          (u,'Planned debt',today+3,'planned','debt_payment',121.21,100,21.21,0,w,debt_w,cafe);

  -- Known upcoming: one stand-alone planned row, a daily schedule with one occurrence already materialized,
  -- and a paused schedule that must be ignored.
  insert into public.finance_transactions(user_id,title,occurred_at,status,kind,amount,source_account_id,category_id)
    values(u,'Planned beans',today+2,'planned','expense',51.11,w,cafe);
  insert into public.finance_transaction_schedules(id,user_id,title,start_date,frequency,interval_count,interval_unit,state,kind,amount,category_id,source_account_id)
    values(schedule,u,'Daily milk',today+1,'daily',1,'day','active','expense',10.11,cafe,w),
          (paused,u,'Paused thing',today+1,'daily',1,'day','paused','expense',77.77,cafe,w);
  insert into public.finance_transactions(user_id,title,occurred_at,status,kind,amount,source_account_id,category_id,schedule_id,schedule_occurrence_date)
    values(u,'Daily milk',today+1,'planned','expense',10.11,w,cafe,schedule,today+1);

  -- Assertions are scoped to this test's own categories and marker amounts, so they also hold on a database
  -- that has other data for the same user.
  source:=public.spending_forecast_source(u,today,today+5,today-179);
  if source->>'default_currency'<>'CZK' then raise exception 'Default currency missing'; end if;
  if (select count(*) from jsonb_array_elements(source->'history') h where (h->>'category_id')::uuid=cafe_child)<>1
    or (select (h->>'amount')::numeric from jsonb_array_elements(source->'history') h where (h->>'category_id')::uuid=cafe_child)<>123.45
    then raise exception 'History must hold exactly the paid expense of the subcategory'; end if;
  if (select count(*) from jsonb_array_elements(source->'history') h where (h->>'amount')::numeric in (543.21, 999.99))<>0
    then raise exception 'Transfer or another user''s expense leaked into history'; end if;
  if (select count(*) from jsonb_array_elements(source->'wallets') x where (x->>'id')::uuid=other_w)<>0
    or (select count(*) from jsonb_array_elements(source->'wallets') x where (x->>'id')::uuid=w)<>1
    then raise exception 'Wallet scoping wrong'; end if;
  -- 1 stand-alone + 1 materialized occurrence + 4 generated (5 days minus the materialized one).
  if (select count(*) from jsonb_array_elements(source->'planned') p where (p->>'category_id')::uuid=cafe)<>7 then
    raise exception 'Planned count wrong'; end if;
  if (select count(*) from jsonb_array_elements(source->'history') h where (h->>'amount')::numeric=77.01)<>1
    or (select count(*) from jsonb_array_elements(source->'history') h where (h->>'amount')::numeric in (177.01, 500))<>0
    then raise exception 'Debt payment must count its interest only'; end if;
  if (select count(*) from jsonb_array_elements(source->'planned') p where (p->>'amount')::numeric=21.21)<>1
    or (select count(*) from jsonb_array_elements(source->'planned') p where (p->>'amount')::numeric=121.21)<>0
    then raise exception 'Planned debt payment must count its interest only'; end if;
  if (select count(*) from jsonb_array_elements(source->'planned') p where (p->>'amount')::numeric=10.11)<>5
    or (select count(*) from jsonb_array_elements(source->'planned') p where (p->>'amount')::numeric=51.11)<>1
    then raise exception 'Planned amounts wrong'; end if;
  if (select count(*) from jsonb_array_elements(source->'planned') p where (p->>'amount')::numeric=77.77)<>0 then
    raise exception 'Paused schedule produced occurrences'; end if;

  -- Access: the source takes a user id, so only the service role may call it.
  if has_function_privilege('anon','public.spending_forecast_source(uuid,date,date,date)','execute')
    or has_function_privilege('authenticated','public.spending_forecast_source(uuid,date,date,date)','execute')
    or not has_function_privilege('service_role','public.spending_forecast_source(uuid,date,date,date)','execute')
    then raise exception 'spending_forecast_source grants are wrong'; end if;
  if has_table_privilege('anon','public.spending_forecasts','select')
    or has_table_privilege('authenticated','public.spending_forecasts','insert')
    or has_table_privilege('authenticated','public.spending_forecasts','update')
    or has_table_privilege('authenticated','public.spending_forecasts','delete')
    then raise exception 'spending_forecasts is writable or readable by the wrong role'; end if;
  if not has_table_privilege('service_role','public.spending_forecasts','select')
    or not has_table_privilege('service_role','public.spending_forecasts','insert')
    or not has_table_privilege('service_role','public.spending_forecasts','update')
    then raise exception 'service_role cannot write spending_forecasts'; end if;

  -- Re-running on the same day overwrites the row (the cron upserts on this key).
  for i in 1..2 loop
    insert into public.spending_forecasts(user_id,forecast_date,month,category_id,currency,budget,spent_to_date,planned_remaining,
      forecast_p10,forecast_p50,forecast_p90,baseline_runrate,status,expected_overrun_date,method,model)
    values(u,today,month_first,cafe,'CZK',3000,100,100,2500+i,3500+i,4500,3100,'over',today+3,'chronos','amazon/chronos-bolt-small')
    on conflict (user_id,forecast_date,category_id) do update set forecast_p50=excluded.forecast_p50;
  end loop;
  if (select count(*) from public.spending_forecasts where user_id=u)<>1 then raise exception 'Same-day rerun duplicated the row'; end if;
  if (select forecast_p50 from public.spending_forecasts where user_id=u)<>3502 then raise exception 'Rerun did not overwrite'; end if;

  failed:=false;
  begin
    insert into public.spending_forecasts(user_id,forecast_date,month,category_id,currency,budget,spent_to_date,planned_remaining,
      forecast_p10,forecast_p50,forecast_p90,baseline_runrate,status,method)
    values(u,today-1,month_first,cafe,'CZK',3000,0,0,0,0,0,0,'unknown','chronos');
  exception when check_violation then failed:=true; end;
  if not failed then raise exception 'Invalid status accepted'; end if;

  -- MCP read: latest day only, scoped to the key's user, never calls the model.
  insert into public.spending_forecasts(user_id,forecast_date,month,category_id,currency,budget,spent_to_date,planned_remaining,
    forecast_p10,forecast_p50,forecast_p90,baseline_runrate,status,method)
  values(u,today-1,month_first,cafe,'CZK',3000,90,100,100,200,300,3000,'ok','baseline');
  result:=public.mcp_get_spending_forecast(key_hash,null);
  if (result->>'forecast_date')::date<>today or jsonb_array_length(result->'forecasts')<>1 then
    raise exception 'Latest forecast day not returned'; end if;
  if result->'forecasts'->0->>'category_name'<>'Forecast cafe' or result->'forecasts'->0->>'status'<>'over' then
    raise exception 'Forecast payload wrong'; end if;
  result:=public.mcp_get_spending_forecast(key_hash,(month_first - interval '1 month')::date);
  if result->>'forecast_date' is not null or jsonb_array_length(result->'forecasts')<>0 then
    raise exception 'Empty month should return no forecasts'; end if;
  result:=public.mcp_get_spending_forecast(other_hash,null);
  if jsonb_array_length(result->'forecasts')<>0 then raise exception 'Another user''s forecast leaked'; end if;
end $$;
rollback;
