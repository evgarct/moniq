-- Rollback-only regression suite. Requires the synthetic local/staging seed.
begin;
do $$
<<debt_recurring_reliability>>
declare
  u uuid; cash_id uuid := gen_random_uuid(); debt_id uuid := gen_random_uuid(); card_id uuid := gen_random_uuid();
  saving_id uuid := gen_random_uuid(); goal_id uuid := gen_random_uuid(); category_id uuid := gen_random_uuid();
  tx_id uuid := gen_random_uuid(); schedule_id uuid := gen_random_uuid(); result jsonb; payload jsonb;
  key_hash text := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
  month_date date := date_trunc('month',current_date)::date + 9;
  future_start date := (date_trunc('year',current_date) + case when extract(month from current_date)<7 then interval '6 months' else interval '1 year' end + interval '30 days')::date;
  custom_id uuid;
  include_context boolean;
begin
  select id into u from auth.users where email like '%@example.invalid' order by created_at limit 1;
  if u is null then raise exception 'Synthetic example.invalid user required; refusing a personal database'; end if;
  perform set_config('request.jwt.claim.sub',u::text,true);
  insert into public.wallets(id,user_id,name,type,currency,balance,credit_limit) values
    (cash_id,u,'Reliability cash','cash','RUB',100000,null),
    (debt_id,u,'Reliability mortgage','debt','RUB',-100000,null),
    (card_id,u,'Reliability credit card','credit_card','RUB',-10000,40000),
    (saving_id,u,'Reliability savings','saving','RUB',50000,null);
  insert into public.wallet_allocations(id,user_id,wallet_id,name,kind,amount) values(goal_id,u,saving_id,'Reliability reserve','goal_open',40000);
  insert into public.finance_categories(id,user_id,name,type) values(category_id,u,'Reliability expense','expense');
  insert into public.mcp_api_keys(user_id,name,key_hash,key_prefix) values(u,'Reliability key',key_hash,'test');
  insert into public.finance_transactions(id,user_id,title,occurred_at,status,kind,amount,principal_amount,interest_amount,extra_principal_amount,source_account_id,destination_account_id,category_id)
    values(tx_id,u,'Mortgage',current_date,'paid','debt_payment',31700,19975.50,11724.50,0,cash_id,debt_id,category_id);
  if (select balance from public.wallets where id=debt_id) <> -80024.50 then raise exception 'Interest reduced debt'; end if;
  if (select balance from public.wallets where id=cash_id) <> 68300 then raise exception 'Source did not pay total'; end if;
  update public.finance_transactions set amount=32000,principal_amount=20000,interest_amount=12000 where id=tx_id;
  if (select balance from public.wallets where id=debt_id) <> -80000 then raise exception 'Debt update reversal failed'; end if;
  delete from public.finance_transactions where id=tx_id;
  if (select balance from public.wallets where id=debt_id) <> -100000 or (select balance from public.wallets where id=cash_id) <> 100000 then raise exception 'Delete did not reverse principal and total'; end if;
  insert into public.finance_transactions(id,user_id,title,occurred_at,status,kind,amount,principal_amount,interest_amount,source_account_id,destination_account_id)
    values(tx_id,u,'Interest only',current_date,'paid','debt_payment',100,0,100,cash_id,debt_id);
  if (select balance from public.wallets where id=debt_id) <> -100000 then raise exception 'Interest-only fallback regression'; end if;
  delete from public.finance_transactions where id=tx_id;

  insert into public.finance_transactions(id,user_id,title,occurred_at,status,kind,amount,principal_amount,interest_amount,extra_principal_amount,source_account_id,destination_account_id)
    values(tx_id,u,'Extra principal',current_date,'paid','debt_payment',5000,0,0,5000,cash_id,debt_id);
  if (select balance from public.wallets where id=debt_id) <> -95000 then raise exception 'Extra principal did not reduce debt'; end if;
  update public.finance_transactions set status='planned' where id=tx_id;
  if (select balance from public.wallets where id=debt_id) <> -100000 then raise exception 'Status reversal lost extra principal'; end if;
  delete from public.finance_transactions where id=tx_id;

  if has_function_privilege('anon','public.reconcile_recurring_schedule_internal(uuid)','execute')
    or has_function_privilege('authenticated','public.mcp_normalize_recurring_schedule(uuid,jsonb)','execute') then
    raise exception 'Internal SECURITY DEFINER helper exposed';
  end if;
  if not has_function_privilege('authenticated','public.reconcile_recurring_schedules()','execute') then
    raise exception 'Authenticated reconciler grant missing';
  end if;

  payload := jsonb_build_object('title','Card','occurred_at',current_date,'status','planned','kind','debt_payment','amount',1200,'principal_amount',1200,'source_account_id',cash_id,'destination_account_id',card_id);
  result := public.mcp_create_transactions(key_hash,jsonb_build_array(payload));
  tx_id := (result#>>'{created,0,id}')::uuid;
  perform public.mcp_update_transaction(key_hash,tx_id,payload || '{"status":"paid"}'::jsonb);
  if (select balance from public.wallets where id=card_id) <> -8800 then raise exception 'MCP credit-card debt payment failed'; end if;
  delete from public.finance_transactions where id=tx_id;

  payload := jsonb_build_object('title','Rent','occurred_at',current_date,'status','paid','kind','expense','amount',33000,'category_id',category_id,'source_account_id',saving_id,'source_allocation_id',goal_id);
  result := public.mcp_create_transactions(key_hash,jsonb_build_array(payload));
  tx_id := (result#>>'{created,0,id}')::uuid;
  if (select amount from public.wallet_allocations where id=goal_id) <> 7000 then raise exception 'Source goal not debited'; end if;
  delete from public.finance_transactions where id=tx_id;
  if (select amount from public.wallet_allocations where id=goal_id) <> 40000 or (select balance from public.wallets where id=saving_id) <> 50000 then raise exception 'Goal reversal changed unrelated balances'; end if;

  -- Creation is materialized at commit by the deferred trigger; force it now to assert the same contract.
  payload := jsonb_build_object('title','Mortgage series','start_date',month_date,'frequency','monthly','kind','debt_payment','amount',31700,'principal_amount',19975.50,'interest_amount',11724.50,'source_account_id',cash_id,'destination_account_id',debt_id,'category_id',category_id);
  result := public.mcp_create_recurring_transaction_schedule(key_hash,payload);
  schedule_id := (result->>'schedule_id')::uuid;
  set constraints finance_schedules_materialize immediate;
  if (select count(*) from public.finance_transactions t where t.schedule_id=debt_recurring_reliability.schedule_id) < 18 then raise exception 'New schedule not materialized to 18 months'; end if;
  if exists(select 1 from public.finance_transactions t where t.schedule_id=debt_recurring_reliability.schedule_id and (t.principal_amount<>19975.50 or t.interest_amount<>11724.50)) then raise exception 'Materialization lost breakdown'; end if;
  select id into tx_id from public.finance_transactions t where t.schedule_id=debt_recurring_reliability.schedule_id and t.schedule_occurrence_date=month_date;
  update public.finance_transactions set amount=32000,principal_amount=20275.50,is_schedule_override=true where id=tx_id;
  perform public.reconcile_recurring_schedules();
  perform public.reconcile_recurring_schedules();
  if (select amount from public.finance_transactions where id=tx_id) <> 32000 then raise exception 'Override was overwritten'; end if;
  begin
    update public.finance_transactions set occurred_at=month_date - interval '1 month',status='skipped' where id=tx_id;
    raise exception 'Cross-period skip was accepted';
  exception when others then
    if sqlerrm='Cross-period skip was accepted' then raise; end if;
    if position('outside its schedule period' in sqlerrm)=0 then raise; end if;
  end;
  update public.finance_transactions set occurred_at=month_date - interval '1 month',is_explicit_reschedule=true where id=tx_id;
  update public.finance_transactions set status='paid' where id=tx_id;
  if (select schedule_occurrence_date from public.finance_transactions where id=tx_id) <> month_date then raise exception 'Explicit reschedule changed slot'; end if;
  -- A paid September occurrence and skipped September occurrence cannot hide the October slot.
  if not exists(select 1 from public.finance_transactions t where t.schedule_id=debt_recurring_reliability.schedule_id and t.schedule_occurrence_date=(month_date+interval '1 month')::date and t.status='planned') then raise exception 'Following occurrence disappeared'; end if;
  foreach include_context in array array[false,true] loop
    result := public.mcp_get_transactions_for_period(key_hash,(month_date+interval '1 month')::date,(month_date+interval '2 months')::date,null,null,null,null,include_context);
    if not exists(select 1 from jsonb_array_elements(result->'transactions') item
      where item->>'schedule_id'=schedule_id::text and (item->>'principal_amount')::numeric=19975.50 and (item->>'interest_amount')::numeric=11724.50) then
      raise exception 'Period RPC lost mortgage split (include_context=%)',include_context;
    end if;
  end loop;

  update public.finance_transaction_schedules set state='paused' where id=schedule_id;
  if exists(select 1 from public.finance_transactions t where t.schedule_id=debt_recurring_reliability.schedule_id and t.status='planned' and not t.is_schedule_override) then raise exception 'Pause left ordinary planned rows'; end if;
  if not exists(select 1 from public.finance_transactions where id=tx_id and status='paid') then raise exception 'Pause removed settled override'; end if;
  update public.finance_transaction_schedules set state='active' where id=schedule_id;
  if (select count(*) from public.finance_transactions t where t.schedule_id=debt_recurring_reliability.schedule_id) < 18 then raise exception 'Resume did not refill horizon'; end if;

  payload := jsonb_build_object('title','Future source goal','start_date',future_start,'frequency','custom','interval_count',3,'interval_unit','month','until_date',(future_start+interval '9 months')::date,'kind','expense','amount',300,'source_account_id',saving_id,'source_allocation_id',goal_id,'category_id',category_id);
  result := public.mcp_create_recurring_transaction_schedule(key_hash,payload);
  custom_id := (result->>'schedule_id')::uuid;
  if not exists(select 1 from public.finance_transactions t where t.schedule_id=custom_id and t.schedule_occurrence_date=(future_start+interval '3 months')::date and t.source_allocation_id=goal_id and t.allocation_id is null) then raise exception 'Future custom cadence lost month-end clamp or source goal'; end if;
  if (select count(*) from public.finance_transactions t where t.schedule_id=custom_id) <> 4 then raise exception 'Custom cadence ignored until_date'; end if;
  foreach include_context in array array[false,true] loop
    result := public.mcp_get_transactions_for_period(key_hash,future_start,future_start+1,null,null,array[saving_id::text],null,include_context);
    if not exists(select 1 from jsonb_array_elements(result->'transactions') item where item->>'schedule_id'=custom_id::text and item->>'source_allocation_id'=goal_id::text and item->>'destination_allocation_id' is null) then raise exception 'Period RPC lost source goal'; end if;
  end loop;
  begin
    perform public.mcp_normalize_recurring_schedule(u,payload || '{"bad_field":true,"destination_allocation_id":null}'::jsonb);
    raise exception 'Unknown patch field ignored';
  exception when others then
    if sqlerrm='Unknown patch field ignored' or position('Unsupported recurring schedule fields' in sqlerrm)=0 then raise; end if;
  end;
end;
$$;
rollback;
