begin;
do $$
begin
  if (select balance from public.wallets where id='70000000-0000-4000-8000-000000000002')<>-68300
    or (select balance from public.wallets where id='70000000-0000-4000-8000-000000000003')<>17000
    or (select amount from public.wallet_allocations where id='70000000-0000-4000-8000-000000000004')<>7000 then raise exception 'Upgrade replayed wallet or goal effects'; end if;
  if not exists(select 1 from public.finance_transactions where id='70000000-0000-4000-8000-000000000006' and source_allocation_id='70000000-0000-4000-8000-000000000004' and allocation_id is null)
    or not exists(select 1 from public.finance_transaction_schedules where id='70000000-0000-4000-8000-000000000008' and source_allocation_id='70000000-0000-4000-8000-000000000004' and allocation_id is null) then raise exception 'Upgrade did not move source-goal metadata'; end if;
  if (select posted_destination_amount from public.finance_transactions where id='70000000-0000-4000-8000-000000000007')<>31700 then raise exception 'Upgrade lost historical posted effect'; end if;
  update public.finance_transactions set note='Synthetic post-upgrade note' where id='70000000-0000-4000-8000-000000000007';
  if (select balance from public.wallets where id='70000000-0000-4000-8000-000000000002')<>-68300 then raise exception 'Post-upgrade note changed debt balance'; end if;
  delete from public.finance_transactions where id in ('70000000-0000-4000-8000-000000000006','70000000-0000-4000-8000-000000000007');
  if (select balance from public.wallets where id='70000000-0000-4000-8000-000000000002')<>-100000
    or (select balance from public.wallets where id='70000000-0000-4000-8000-000000000003')<>50000
    or (select amount from public.wallet_allocations where id='70000000-0000-4000-8000-000000000004')<>40000 then raise exception 'Post-upgrade deletion did not reverse recorded effects'; end if;
end;
$$;
rollback;
