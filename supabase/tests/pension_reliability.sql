-- Synthetic-only rollback suite. Run after migration resets and seed, before promotion.
begin;
do $$
declare u uuid; other_u uuid; p uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); tx uuid:=gen_random_uuid(); cat uuid:=gen_random_uuid();
  result jsonb; payload jsonb; failed boolean; key_hash text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
begin
  select id into u from auth.users where email like '%@example.invalid' order by created_at limit 1;
  select id into other_u from auth.users where email like '%@example.invalid' and id<>u limit 1;
  if u is null or other_u is null then raise exception 'Synthetic personas required'; end if;
  perform set_config('request.jwt.claim.sub',u::text,true);
  insert into public.wallets(id,user_id,name,type,currency,balance) values(p,u,'Synthetic pension','pension','CZK',0),(c,u,'Synthetic source','cash','CZK',10000);
  insert into public.finance_categories(id,user_id,name,type) values(cat,u,'Synthetic pension contributions','expense');
  insert into public.mcp_api_keys(user_id,name,key_hash,key_prefix) values(u,'Pension test',key_hash,'test');
  insert into public.finance_transactions(id,user_id,title,occurred_at,status,kind,amount,source_account_id,category_id)
    values(tx,u,'Own contribution',current_date-9,'paid','expense',1700,c,cat);
  payload:=jsonb_build_object('as_of',current_date,'total_value',229294.06,'invested',190781.80,'provider_result',29572.72,'entries',jsonb_build_array(
    jsonb_build_object('id','own','occurred_at',current_date-9,'amount',1700,'source','own','transaction_id',tx),
    jsonb_build_object('id','employer','occurred_at',current_date-9,'amount',4161,'source','employer')));
  result:=public.upsert_pension_statement(p,payload);
  if (select balance from public.wallets where id=c)<>8300 then raise exception 'Own contribution charged twice'; end if;
  if (result->>'balance')::numeric<>229294.06 then raise exception 'Included contributions counted twice'; end if;
  if (select kind from public.finance_transactions where id=tx)<>'transfer' then raise exception 'Own contribution not linked'; end if;
  result:=public.upsert_pension_statement(p,payload);
  if jsonb_array_length(result->'pension_state'->'entries')<>2 then raise exception 'Duplicate import'; end if;
  -- Later paid transfers update the account; planned ones do not. A new statement replaces growth.
  insert into public.finance_transactions(user_id,title,occurred_at,status,kind,amount,destination_amount,source_account_id,destination_account_id,category_id)
    values(u,'Later contribution',current_date+1,'planned','transfer',1700,1700,c,p,cat);
  if (select balance from public.wallets where id=p)<>229294.06 then raise exception 'Planned contribution changed balance'; end if;
  result:=public.upsert_pension_statement(p,jsonb_build_object('as_of',current_date,'total_value',220000,'entries','[]'::jsonb));
  if (result->>'balance')::numeric<>220000 then raise exception 'Falling valuation rejected'; end if;
  failed:=false;
  begin
    insert into public.finance_transactions(user_id,title,occurred_at,status,kind,amount,source_account_id,category_id) values(u,'Forbidden withdrawal',current_date,'paid','expense',100,p,cat);
  exception when others then failed:=true; end;
  if not failed then raise exception 'Pension withdrawal allowed'; end if;
  failed:=false;
  begin perform public.upsert_pension_statement_internal(other_u,p,null,payload); exception when others then failed:=true; end;
  if not failed then raise exception 'Cross tenant statement allowed'; end if;
  failed:=false;
  begin perform public.upsert_pension_statement(p,jsonb_set(payload,'{entries,0,amount}','1800')); exception when others then failed:=true; end;
  if not failed then raise exception 'Conflicting entry accepted'; end if;
  result:=public.mcp_get_finance_context(key_hash);
  if not result ? 'wallets' or not result ? 'goals' or not result ? 'categories' then raise exception 'Context contract changed'; end if;
  result:=public.mcp_get_budget_status_source(key_hash,date_trunc('month',current_date)::date,(date_trunc('month',current_date)+interval '1 month - 1 day')::date);
  if not result ? 'transactions' then raise exception 'Budget source missing'; end if;
  result:=public.mcp_get_investment_summary_source(key_hash);
  if not result ? 'positions' or not result ? 'accounts' or jsonb_array_length(result->'accounts')<>1 then raise exception 'Investment context contract changed'; end if;
  if has_function_privilege('anon','public.upsert_pension_statement_internal(uuid,uuid,text,jsonb)','execute')
    or has_function_privilege('authenticated','public.revalue_pension_internal(uuid)','execute')
    or has_function_privilege('anon','public.upsert_pension_statement(uuid,jsonb)','execute') then raise exception 'Pension helper exposed'; end if;
end $$;
rollback;
