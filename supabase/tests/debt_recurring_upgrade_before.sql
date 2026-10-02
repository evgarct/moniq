-- Synthetic upgrade fixture for the immediately preceding ledger and expense-goal schema.
do $$
declare u uuid;
begin
  select id into u from auth.users where email like '%@example.invalid' order by created_at limit 1;
  if u is null then raise exception 'Synthetic user required'; end if;
  insert into public.wallets(id,user_id,name,type,currency,balance) values
    ('70000000-0000-4000-8000-000000000001',u,'Upgrade cash','cash','RUB',100000),
    ('70000000-0000-4000-8000-000000000002',u,'Upgrade debt','debt','RUB',-100000),
    ('70000000-0000-4000-8000-000000000003',u,'Upgrade savings','saving','RUB',50000);
  insert into public.wallet_allocations(id,user_id,wallet_id,name,kind,amount)
    values('70000000-0000-4000-8000-000000000004',u,'70000000-0000-4000-8000-000000000003','Upgrade goal','goal_open',40000);
  insert into public.finance_categories(id,user_id,name,type) values('70000000-0000-4000-8000-000000000005',u,'Upgrade expense','expense');
  insert into public.finance_transactions(id,user_id,title,occurred_at,status,kind,amount,principal_amount,interest_amount,extra_principal_amount,category_id,source_account_id,destination_account_id,allocation_id) values
    ('70000000-0000-4000-8000-000000000006',u,'Upgrade rent',current_date,'paid','expense',33000,null,null,null,'70000000-0000-4000-8000-000000000005','70000000-0000-4000-8000-000000000003',null,'70000000-0000-4000-8000-000000000004'),
    ('70000000-0000-4000-8000-000000000007',u,'Upgrade mortgage',current_date,'paid','debt_payment',31700,19975.50,11724.50,0,'70000000-0000-4000-8000-000000000005','70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002',null);
  insert into public.finance_transaction_schedules(id,user_id,title,start_date,frequency,kind,amount,category_id,source_account_id,allocation_id)
    values('70000000-0000-4000-8000-000000000008',u,'Upgrade rent schedule',current_date,'monthly','expense',33000,'70000000-0000-4000-8000-000000000005','70000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000004');
end;
$$;
