-- Statement history stays on the owner-scoped wallet so the existing PowerSync wallet stream
-- carries one atomic, versioned document. Ledger transfers remain the source of own contributions.
alter table public.wallets add column pension_state jsonb;
alter table public.wallets add constraint wallets_pension_state_object check (pension_state is null or jsonb_typeof(pension_state)='object');

create function public.guard_pension_wallet() returns trigger language plpgsql set search_path=public as $$
begin
  if old.type::text='pension' and (new.type<>old.type or new.currency<>old.currency) then raise exception 'Pension account type and currency cannot change'; end if;
  if old.type::text<>'pension' and new.type::text='pension' then raise exception 'Create a separate pension account'; end if;
  if current_user in ('anon','authenticated') and (new.pension_state is distinct from old.pension_state or ((new.type::text='pension') and new.balance<>old.balance)) then raise exception 'Use pension statement RPC'; end if;
  return new;
end $$;
create trigger wallets_guard_pension before update on public.wallets for each row execute function public.guard_pension_wallet();
revoke all on function public.guard_pension_wallet() from public,anon,authenticated;

create function public.revalue_pension_internal(p_wallet_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare w public.wallets; latest jsonb; balance_delta numeric;
begin
  select * into w from public.wallets where id=p_wallet_id for update;
  if w.type::text <> 'pension' then return; end if;
  select s into latest from jsonb_array_elements(coalesce(w.pension_state->'statements','[]')) s order by s->>'as_of' desc limit 1;
  if latest is null then return; end if;
  select coalesce(sum(coalesce(t.destination_amount,t.amount)),0) into balance_delta
  from public.finance_transactions t where t.user_id=w.user_id and t.destination_account_id=w.id
    and t.status='paid' and t.occurred_at > (latest->>'as_of')::date;
  select balance_delta + coalesce(sum((e->>'amount')::numeric),0) into balance_delta
  from jsonb_array_elements(coalesce(w.pension_state->'entries','[]')) e
  where e->>'source' in ('employer','state') and (e->>'occurred_at')::date > (latest->>'as_of')::date;
  update public.wallets set balance=(latest->>'total_value')::numeric+balance_delta where id=w.id;
end $$;
revoke all on function public.revalue_pension_internal(uuid) from public,anon,authenticated;

create function public.guard_pension_transaction() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.wallets where id=new.source_account_id and type::text='pension') then
    raise exception 'Pension funds are locked until retirement.';
  end if;
  return new;
end $$;
create trigger finance_transactions_guard_pension before insert or update on public.finance_transactions
for each row execute function public.guard_pension_transaction();
revoke all on function public.guard_pension_transaction() from public,anon,authenticated;

create function public.revalue_pension_on_transaction() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op <> 'INSERT' then perform public.revalue_pension_internal(old.destination_account_id); end if;
  if tg_op <> 'DELETE' then perform public.revalue_pension_internal(new.destination_account_id); end if;
  return null;
end $$;
create trigger zzz_revalue_pension after insert or update or delete on public.finance_transactions
for each row execute function public.revalue_pension_on_transaction();
revoke all on function public.revalue_pension_on_transaction() from public,anon,authenticated;

create function public.upsert_pension_statement_internal(p_user_id uuid,p_wallet_id uuid,p_name text,p_statement jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare w public.wallets; state jsonb; statements jsonb; entries jsonb; e jsonb; old_entry jsonb;
  as_of date; value numeric; tx public.finance_transactions; tx_id uuid;
begin
  if p_user_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_statement)<>'object' then raise exception 'Invalid pension statement'; end if;
  as_of := (p_statement->>'as_of')::date;
  value := (p_statement->>'total_value')::numeric;
  if as_of is null or as_of > current_date or value is null or value < 0 or value::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid pension statement'; end if;
  if jsonb_typeof(coalesce(p_statement->'entries','[]')) <> 'array' then raise exception 'Invalid pension entries'; end if;
  if p_statement->'invested' is not null and p_statement->'invested'<>'null'::jsonb and
    (jsonb_typeof(p_statement->'invested')<>'number' or (p_statement->>'invested')::numeric<0) then raise exception 'Invalid pension invested value'; end if;
  if p_statement->'provider_result' is not null and p_statement->'provider_result'<>'null'::jsonb and
    jsonb_typeof(p_statement->'provider_result')<>'number' then raise exception 'Invalid pension provider result'; end if;
  -- Serialize account creation and all imports for this owner, including idempotent retries without an ID.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':pension',0));
  if p_wallet_id is null then
    select * into w from public.wallets where user_id=p_user_id and name=p_name and type::text='pension' for update;
    if not found then insert into public.wallets(user_id,name,type,balance,currency) values(p_user_id,p_name,'pension',0,'CZK') returning * into w; end if;
  else
    select * into w from public.wallets where id=p_wallet_id and user_id=p_user_id and type::text='pension' for update;
  end if;
  if w.id is null then raise exception 'Pension account not found'; end if;
  state := coalesce(w.pension_state,'{"statements":[],"entries":[]}'::jsonb);
  entries := coalesce(state->'entries','[]');
  for e in select * from jsonb_array_elements(coalesce(p_statement->'entries','[]')) loop
    if coalesce(e->>'id','')='' or (e->>'occurred_at')::date is null or (e->>'occurred_at')::date > as_of
      or e->>'source' not in ('own','employer','state','internal_investment') or e->>'source' is null
      or (e->>'amount')::numeric is null or (e->>'amount')::numeric <= 0
      or (e->>'amount')::numeric::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid pension entry'; end if;
    select item into old_entry from jsonb_array_elements(entries) item where item->>'id'=e->>'id';
    if old_entry is not null and old_entry <> e then raise exception 'Pension entry conflicts with an existing entry'; end if;
    if e->>'source'='own' then
      tx_id := (e->>'transaction_id')::uuid;
      select * into tx from public.finance_transactions where id=tx_id and user_id=p_user_id for update;
      if tx.id is null or tx.status <> 'paid' or tx.amount <> (e->>'amount')::numeric
        or tx.occurred_at <> (e->>'occurred_at')::date or tx.kind not in ('expense','transfer')
        or tx.source_account_id is null or tx.source_allocation_id is not null
        or not exists(select 1 from public.wallets where id=tx.source_account_id and user_id=p_user_id and currency=w.currency)
        or (tx.kind='transfer' and tx.destination_account_id is distinct from w.id)
        or exists(select 1 from jsonb_array_elements(entries) item where item->>'transaction_id'=tx_id::text and item->>'id'<>e->>'id')
        then raise exception 'Own contribution needs an unambiguous matching paid transaction'; end if;
      if tx.kind='expense' then
        update public.finance_transactions set kind='transfer',destination_account_id=w.id,destination_amount=amount where id=tx.id;
      end if;
    end if;
    if old_entry is null then entries := entries || jsonb_build_array(e); end if;
  end loop;
  select coalesce(jsonb_agg(s),'[]') into statements from jsonb_array_elements(coalesce(state->'statements','[]')) s where s->>'as_of'<>as_of::text;
  statements := statements || jsonb_build_array(p_statement - 'entries');
  if p_statement ? 'product_type' and p_statement->>'product_type'<>'cz_dps' then raise exception 'Unknown pension product'; end if;
  update public.wallets set pension_state=jsonb_build_object('product_type',coalesce(state->>'product_type',p_statement->>'product_type'),'statements',statements,'entries',entries) where id=w.id;
  perform public.revalue_pension_internal(w.id);
  select * into w from public.wallets where id=w.id;
  return jsonb_build_object('wallet_id',w.id,'name',w.name,'currency',w.currency,'balance',w.balance,'pension_state',w.pension_state);
end $$;
revoke all on function public.upsert_pension_statement_internal(uuid,uuid,text,jsonb) from public,anon,authenticated;

create function public.upsert_pension_statement(p_wallet_id uuid,p_statement jsonb) returns jsonb
language sql security definer set search_path=public as $$
  select public.upsert_pension_statement_internal(auth.uid(),p_wallet_id,null,p_statement);
$$;
revoke all on function public.upsert_pension_statement(uuid,jsonb) from public,anon;
grant execute on function public.upsert_pension_statement(uuid,jsonb) to authenticated;

create function public.mcp_upsert_pension_statement(p_key_hash text,p_wallet_id uuid,p_name text,p_statement jsonb) returns jsonb
language sql security definer set search_path=public as $$
  select public.upsert_pension_statement_internal(public.mcp_recurring_key_user_id(p_key_hash),p_wallet_id,p_name,p_statement);
$$;
revoke all on function public.mcp_upsert_pension_statement(text,uuid,text,jsonb) from public;
grant execute on function public.mcp_upsert_pension_statement(text,uuid,text,jsonb) to anon,authenticated;

create function public.mcp_get_pension_accounts(p_key_hash text) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'type',type,'currency',currency,'balance',balance,'total_balance',balance,'reserved_balance',balance,'available_to_spend',0,'availability_status','locked_until_retirement','allocations','[]'::jsonb,'pension_state',pension_state,'product_type',pension_state->>'product_type','product_name',case when pension_state->>'product_type'='cz_dps' then 'Doplňkové penzijní spoření (DPS)' end,'country_code',case when pension_state->>'product_type'='cz_dps' then 'CZ' end)),'[]')
  from public.wallets where user_id=public.mcp_recurring_key_user_id(p_key_hash) and type::text='pension';
$$;
revoke all on function public.mcp_get_pension_accounts(text) from public;
grant execute on function public.mcp_get_pension_accounts(text) to anon,authenticated;

create function public.mcp_rename_pension_account(p_key_hash text,p_wallet_id uuid,p_name text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid:=public.mcp_recurring_key_user_id(p_key_hash); account_name text;
begin
  if p_name is null or length(trim(p_name))=0 then raise exception 'Pension account name required'; end if;
  update public.wallets set name=trim(p_name) where id=p_wallet_id and user_id=u and type::text='pension' returning name into account_name;
  if account_name is null then raise exception 'Pension account not found'; end if;
  return jsonb_build_object('wallet_id',p_wallet_id,'name',account_name);
end $$;
revoke all on function public.mcp_rename_pension_account(text,uuid,text) from public;
grant execute on function public.mcp_rename_pension_account(text,uuid,text) to anon,authenticated;

create function public.mcp_get_investment_summary_source(p_key_hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid:=public.mcp_recurring_key_user_id(p_key_hash);
begin
  return jsonb_build_object(
    'default_currency',(select default_currency from public.user_preferences where user_id=u),
    'accounts',coalesce((select jsonb_agg(to_jsonb(w)) from public.wallets w where w.user_id=u and w.type::text='pension'),'[]'),
    'positions',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('instrument',to_jsonb(i),'latest_quote',q.quote))
      from public.investment_positions p join public.investment_instruments i on i.id=p.instrument_id
      left join lateral (select to_jsonb(iq) quote from public.investment_quotes iq where iq.instrument_id=i.id order by iq.market_date desc,iq.fetched_at desc limit 1) q on true
      where p.user_id=u),'[]'),
    'transactions',coalesce((select jsonb_agg(to_jsonb(t)) from public.finance_transactions t where t.user_id=u and t.investment_instrument_id is not null and t.status='paid'),'[]'),
    'exchange_rates',coalesce((select jsonb_agg(to_jsonb(f)) from (select distinct on (provider,base_currency,quote_currency) * from public.fx_rates where requested_date<=current_date order by provider,base_currency,quote_currency,requested_date desc) f),'[]')
  );
end $$;
revoke all on function public.mcp_get_investment_summary_source(text) from public;
grant execute on function public.mcp_get_investment_summary_source(text) to anon,authenticated;

create function public.mcp_link_budget_return(p_key_hash text,p_return_id uuid,p_funding_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid:=public.mcp_recurring_key_user_id(p_key_hash); f public.finance_transactions; r public.finance_transactions;
begin
  select * into f from public.finance_transactions where id=p_funding_id and user_id=u for update;
  select * into r from public.finance_transactions where id=p_return_id and user_id=u for update;
  if f.id is null or r.id is null or f.kind<>'transfer' or r.kind<>'transfer' or f.status<>'paid' or r.status<>'paid'
    or f.allocation_id is null or f.category_id is null or r.allocation_id is not null
    or r.source_allocation_id is distinct from f.allocation_id or r.destination_account_id is distinct from f.source_account_id
    or r.occurred_at<f.occurred_at or r.system_generated or f.system_generated
    or (r.linked_transaction_id is not null and r.linked_transaction_id<>f.id)
    then raise exception 'Invalid budget return link'; end if;
  update public.finance_transactions set linked_transaction_id=f.id where id=r.id;
  return jsonb_build_object('transaction_id',r.id,'title',r.title,'funding_id',f.id);
end $$;
revoke all on function public.mcp_link_budget_return(text,uuid,uuid) from public;
grant execute on function public.mcp_link_budget_return(text,uuid,uuid) to anon,authenticated;

create or replace function public.mcp_create_transactions(
  p_user_id uuid,
  p_transactions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  idx integer := 0;
  tx_id uuid;
  tx_title text;
  tx_note text;
  tx_occurred_at date;
  tx_status public.finance_transaction_status;
  tx_kind public.finance_transaction_kind;
  tx_amount numeric;
  tx_destination_amount numeric;
  tx_fx_rate numeric;
  tx_principal_amount numeric;
  tx_interest_amount numeric;
  tx_extra_principal_amount numeric;
  tx_category_id uuid;
  tx_source_account_id uuid;
  tx_destination_account_id uuid;
  tx_allocation_id uuid;
  tx_source_allocation_id uuid;
  source_exists boolean;
  destination_exists boolean;
  destination_type public.wallet_type;
  category_type public.finance_category_type;
  category_has_children boolean;
  created jsonb := '[]'::jsonb;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if jsonb_typeof(p_transactions) <> 'array' or jsonb_array_length(p_transactions) = 0 then
    raise exception 'transactions must be a non-empty array';
  end if;

  for item in select value from jsonb_array_elements(p_transactions)
  loop
    idx := idx + 1;

    tx_title := nullif(btrim(item->>'title'), '');
    tx_note := nullif(btrim(coalesce(item->>'note', '')), '');
    tx_occurred_at := (item->>'occurred_at')::date;
    tx_status := (item->>'status')::public.finance_transaction_status;
    tx_kind := (item->>'kind')::public.finance_transaction_kind;
    tx_amount := (item->>'amount')::numeric;
    tx_destination_amount := nullif(item->>'destination_amount', '')::numeric;
    tx_fx_rate := nullif(item->>'fx_rate', '')::numeric;
    tx_principal_amount := coalesce(nullif(item->>'principal_amount', '')::numeric, 0);
    tx_interest_amount := coalesce(nullif(item->>'interest_amount', '')::numeric, 0);
    tx_extra_principal_amount := coalesce(nullif(item->>'extra_principal_amount', '')::numeric, 0);
    tx_category_id := nullif(item->>'category_id', '')::uuid;
    tx_source_account_id := nullif(item->>'source_account_id', '')::uuid;
    tx_destination_account_id := nullif(item->>'destination_account_id', '')::uuid;
    tx_allocation_id := nullif(item->>'destination_allocation_id', '')::uuid;
    tx_source_allocation_id := nullif(item->>'source_allocation_id', '')::uuid;

    if tx_title is null then
      raise exception 'Transaction % must have a title', idx;
    end if;

    if tx_amount is null or tx_amount <= 0 then
      raise exception 'Transaction "%" must have a positive amount', tx_title;
    end if;

    if tx_status not in ('paid', 'planned') then
      raise exception 'Transaction "%" status must be paid or planned', tx_title;
    end if;

    if tx_kind not in ('income', 'expense', 'transfer', 'debt_payment') then
      raise exception 'Transaction "%" kind is not supported', tx_title;
    end if;

    if tx_destination_amount is not null and tx_destination_amount <= 0 then
      raise exception 'Transaction "%" destination_amount must be positive when provided', tx_title;
    end if;

    if tx_fx_rate is not null and tx_fx_rate <= 0 then
      raise exception 'Transaction "%" fx_rate must be positive when provided', tx_title;
    end if;

    if tx_source_account_id is not null then
      select exists (
        select 1 from public.wallets
        where id = tx_source_account_id
          and user_id = p_user_id
      ) into source_exists;

      if not source_exists then
        raise exception 'Transaction "%" source account not found', tx_title;
      end if;
    end if;

    if tx_destination_account_id is not null then
      select w.type
      into destination_type
      from public.wallets w
      where w.id = tx_destination_account_id
        and w.user_id = p_user_id;

      destination_exists := destination_type is not null;
      if not destination_exists then
        raise exception 'Transaction "%" destination account not found', tx_title;
      end if;
    else
      destination_type := null;
    end if;

    if tx_source_account_id is not null
      and tx_destination_account_id is not null
      and tx_source_account_id = tx_destination_account_id then
      raise exception 'Transaction "%" source and destination accounts must be different', tx_title;
    end if;

    if tx_category_id is not null then
      select c.type
      into category_type
      from public.finance_categories c
      where c.id = tx_category_id
        and c.user_id = p_user_id;

      if category_type is null then
        raise exception 'Transaction "%" category not found', tx_title;
      end if;

      select exists (
        select 1
        from public.finance_categories child
        where child.user_id = p_user_id
          and child.parent_id = tx_category_id
      ) into category_has_children;

      if category_has_children then
        raise exception 'Transaction "%" category must be a selectable leaf category', tx_title;
      end if;
    else
      category_type := null;
    end if;

    if tx_source_allocation_id is not null and tx_kind not in ('transfer', 'expense') then
      raise exception 'Transaction "%" source_allocation_id is only supported on expenses and transfers', tx_title;
    end if;
    if tx_allocation_id is not null and tx_kind in ('debt_payment', 'expense') then
      raise exception 'Transaction "%" destination goals are not supported on expenses or debt payments', tx_title;
    end if;
    if tx_allocation_id is not null and not exists (
      select 1 from public.wallet_allocations a
      where a.id = tx_allocation_id and a.user_id = p_user_id and a.wallet_id = tx_destination_account_id
    ) then
      raise exception 'Transaction "%" destination_allocation_id must be a goal of the wallet that holds the money (source wallet for expenses, destination wallet for transfers and income)', tx_title;
    end if;
    if tx_source_allocation_id is not null and not exists (
      select 1 from public.wallet_allocations a
      where a.id = tx_source_allocation_id and a.user_id = p_user_id and a.wallet_id = tx_source_account_id
    ) then
      raise exception 'Transaction "%" source_allocation_id must be a goal of the source wallet', tx_title;
    end if;
    if tx_allocation_id is not null and tx_allocation_id = tx_source_allocation_id then
      raise exception 'Transaction "%" source and destination goals must be different', tx_title;
    end if;

    if tx_kind = 'income' then
      if tx_destination_account_id is null then
        raise exception 'Transaction "%" income must include destination_account_id', tx_title;
      end if;
      if tx_source_account_id is not null then
        raise exception 'Transaction "%" income must not include source_account_id', tx_title;
      end if;
      if tx_category_id is null or category_type <> 'income' then
        raise exception 'Transaction "%" income must use an income category', tx_title;
      end if;
      tx_destination_amount := null;
      tx_fx_rate := null;
      tx_principal_amount := null;
      tx_interest_amount := null;
      tx_extra_principal_amount := null;
    elsif tx_kind = 'expense' then
      if tx_source_account_id is null then
        raise exception 'Transaction "%" expense must include source_account_id', tx_title;
      end if;
      if tx_destination_account_id is not null then
        raise exception 'Transaction "%" expense must not include destination_account_id', tx_title;
      end if;
      if tx_category_id is null or category_type <> 'expense' then
        raise exception 'Transaction "%" expense must use an expense category', tx_title;
      end if;
      tx_destination_amount := null;
      tx_fx_rate := null;
      tx_principal_amount := null;
      tx_interest_amount := null;
      tx_extra_principal_amount := null;
    elsif tx_kind = 'transfer' then
      if tx_source_account_id is null or tx_destination_account_id is null then
        raise exception 'Transaction "%" transfer must include source_account_id and destination_account_id', tx_title;
      end if;
      if tx_category_id is not null and tx_allocation_id is null and not exists (select 1 from public.wallets where id=tx_destination_account_id and user_id=p_user_id and type::text='pension') then
        raise exception 'Transaction "%" only transfers into a savings goal (destination_allocation_id) can use a category', tx_title;
      end if;
      if tx_category_id is not null and category_type <> 'expense' then
        raise exception 'Transaction "%" transfer category must be an expense category', tx_title;
      end if;
      tx_destination_amount := coalesce(tx_destination_amount, tx_amount);
      tx_principal_amount := null;
      tx_interest_amount := null;
      tx_extra_principal_amount := null;
    elsif tx_kind = 'debt_payment' then
      if tx_source_account_id is null or tx_destination_account_id is null then
        raise exception 'Transaction "%" debt_payment must include source_account_id and destination_account_id', tx_title;
      end if;
      if destination_type not in ('debt', 'credit_card') then
        raise exception 'Transaction "%" debt_payment destination must be a debt or credit card wallet', tx_title;
      end if;
      if tx_principal_amount < 0 or tx_interest_amount < 0 or tx_extra_principal_amount < 0 then
        raise exception 'Transaction "%" debt payment breakdown values must be non-negative', tx_title;
      end if;
      if tx_principal_amount + tx_interest_amount + tx_extra_principal_amount <= 0 then
        raise exception 'Transaction "%" debt_payment must include at least one breakdown amount', tx_title;
      end if;
      if abs((tx_principal_amount + tx_interest_amount + tx_extra_principal_amount) - tx_amount) > 0.01 then
        raise exception 'Transaction "%" amount must equal principal_amount + interest_amount + extra_principal_amount', tx_title;
      end if;
      if tx_category_id is not null and category_type <> 'expense' then
        raise exception 'Transaction "%" debt_payment category must be an expense category', tx_title;
      end if;
      tx_destination_amount := null;
      tx_fx_rate := null;
    end if;

    insert into public.finance_transactions (
      user_id,
      title,
      note,
      occurred_at,
      status,
      kind,
      amount,
      destination_amount,
      fx_rate,
      principal_amount,
      interest_amount,
      extra_principal_amount,
      category_id,
      source_account_id,
      destination_account_id,
      allocation_id,
      source_allocation_id
    )
    values (
      p_user_id,
      tx_title,
      tx_note,
      tx_occurred_at,
      tx_status,
      tx_kind,
      tx_amount,
      tx_destination_amount,
      tx_fx_rate,
      tx_principal_amount,
      tx_interest_amount,
      tx_extra_principal_amount,
      tx_category_id,
      tx_source_account_id,
      tx_destination_account_id,
      tx_allocation_id,
      tx_source_allocation_id
    )
    returning id into tx_id;

    created := created || jsonb_build_array(
      jsonb_build_object(
        'id', tx_id,
        'title', tx_title,
        'kind', tx_kind,
        'amount', tx_amount,
        'occurred_at', tx_occurred_at,
        'category_id', tx_category_id,
        'destination_allocation_id', tx_allocation_id,
        'source_allocation_id', tx_source_allocation_id
      )
    );
  end loop;

  return jsonb_build_object('created', created);
end;
$$;
create or replace function public.mcp_update_transaction(
  p_key_hash text,
  p_transaction_id uuid,
  p_transaction jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  tx_title text;
  tx_note text;
  tx_occurred_at date;
  tx_status public.finance_transaction_status;
  tx_kind public.finance_transaction_kind;
  tx_amount numeric;
  tx_destination_amount numeric;
  tx_fx_rate numeric;
  tx_principal_amount numeric;
  tx_interest_amount numeric;
  tx_extra_principal_amount numeric;
  tx_category_id uuid;
  tx_source_account_id uuid;
  tx_destination_account_id uuid;
  tx_allocation_id uuid;
  tx_source_allocation_id uuid;
  source_exists boolean;
  destination_type public.wallet_type;
  category_type public.finance_category_type;
  category_has_children boolean;
  updated_payload jsonb;
begin
  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  if not exists (select 1 from public.finance_transactions where id = p_transaction_id and user_id = key_user_id) then
    raise exception 'Transaction not found';
  end if;

  tx_title := nullif(btrim(p_transaction->>'title'), '');
  tx_note := nullif(btrim(coalesce(p_transaction->>'note', '')), '');
  tx_occurred_at := (p_transaction->>'occurred_at')::date;
  tx_status := (p_transaction->>'status')::public.finance_transaction_status;
  tx_kind := (p_transaction->>'kind')::public.finance_transaction_kind;
  tx_amount := (p_transaction->>'amount')::numeric;
  tx_destination_amount := nullif(p_transaction->>'destination_amount', '')::numeric;
  tx_fx_rate := nullif(p_transaction->>'fx_rate', '')::numeric;
  tx_principal_amount := coalesce(nullif(p_transaction->>'principal_amount', '')::numeric, 0);
  tx_interest_amount := coalesce(nullif(p_transaction->>'interest_amount', '')::numeric, 0);
  tx_extra_principal_amount := coalesce(nullif(p_transaction->>'extra_principal_amount', '')::numeric, 0);
  tx_category_id := nullif(p_transaction->>'category_id', '')::uuid;
  tx_source_account_id := nullif(p_transaction->>'source_account_id', '')::uuid;
  tx_destination_account_id := nullif(p_transaction->>'destination_account_id', '')::uuid;

  -- Goal ids are kept when the payload omits them and cleared when sent as null.
  select t.allocation_id, t.source_allocation_id
  into tx_allocation_id, tx_source_allocation_id
  from public.finance_transactions t
  where t.id = p_transaction_id and t.user_id = key_user_id;
  if p_transaction ? 'destination_allocation_id' then
    tx_allocation_id := nullif(p_transaction->>'destination_allocation_id', '')::uuid;
  end if;
  if p_transaction ? 'source_allocation_id' then
    tx_source_allocation_id := nullif(p_transaction->>'source_allocation_id', '')::uuid;
  end if;
  -- The goal tag (allocation_id) is also valid on expenses, debt payments and income and is kept when omitted.
  if tx_kind not in ('transfer', 'expense') then
    if nullif(p_transaction->>'source_allocation_id', '') is not null then
      raise exception 'Transaction "%" source_allocation_id is only supported on expenses and transfers', tx_title;
    end if;
    tx_source_allocation_id := null;
  end if;

  if tx_title is null then raise exception 'Transaction must have a title'; end if;
  if tx_amount is null or tx_amount <= 0 then raise exception 'Transaction "%" must have a positive amount', tx_title; end if;
  if tx_status not in ('paid', 'planned') then raise exception 'Transaction "%" status must be paid or planned', tx_title; end if;
  if tx_kind not in ('income', 'expense', 'transfer', 'debt_payment') then raise exception 'Transaction "%" kind is not supported', tx_title; end if;
  if tx_destination_amount is not null and tx_destination_amount <= 0 then raise exception 'Transaction "%" destination_amount must be positive when provided', tx_title; end if;
  if tx_fx_rate is not null and tx_fx_rate <= 0 then raise exception 'Transaction "%" fx_rate must be positive when provided', tx_title; end if;

  if tx_source_account_id is not null then
    select exists(select 1 from public.wallets where id = tx_source_account_id and user_id = key_user_id) into source_exists;
    if not source_exists then raise exception 'Transaction "%" source account not found', tx_title; end if;
  end if;

  if tx_destination_account_id is not null then
    select type into destination_type from public.wallets where id = tx_destination_account_id and user_id = key_user_id;
    if destination_type is null then raise exception 'Transaction "%" destination account not found', tx_title; end if;
  else
    destination_type := null;
  end if;

  if tx_source_account_id is not null and tx_destination_account_id is not null and tx_source_account_id = tx_destination_account_id then
    raise exception 'Transaction "%" source and destination accounts must be different', tx_title;
  end if;

  if tx_category_id is not null then
    select type into category_type from public.finance_categories where id = tx_category_id and user_id = key_user_id;
    if category_type is null then raise exception 'Transaction "%" category not found', tx_title; end if;
    select exists(select 1 from public.finance_categories child where child.user_id = key_user_id and child.parent_id = tx_category_id) into category_has_children;
    if category_has_children then raise exception 'Transaction "%" category must be a selectable leaf category', tx_title; end if;
  else
    category_type := null;
  end if;

  if tx_allocation_id is not null and tx_kind in ('debt_payment', 'expense') then
    raise exception 'Transaction "%" destination goals are not supported on expenses or debt payments', tx_title;
  end if;
  if tx_allocation_id is not null and not exists (
    select 1 from public.wallet_allocations a
    where a.id = tx_allocation_id and a.user_id = key_user_id and a.wallet_id = tx_destination_account_id
  ) then
    raise exception 'Transaction "%" destination_allocation_id must be a goal of the wallet that holds the money (source wallet for expenses, destination wallet for transfers and income)', tx_title;
  end if;
  if tx_source_allocation_id is not null and not exists (
    select 1 from public.wallet_allocations a
    where a.id = tx_source_allocation_id and a.user_id = key_user_id and a.wallet_id = tx_source_account_id
  ) then
    raise exception 'Transaction "%" source_allocation_id must be a goal of the source wallet', tx_title;
  end if;
  if tx_allocation_id is not null and tx_allocation_id = tx_source_allocation_id then
    raise exception 'Transaction "%" source and destination goals must be different', tx_title;
  end if;

  if tx_kind = 'income' then
    if tx_destination_account_id is null then raise exception 'Transaction "%" income must include destination_account_id', tx_title; end if;
    if tx_source_account_id is not null then raise exception 'Transaction "%" income must not include source_account_id', tx_title; end if;
    if tx_category_id is null or category_type <> 'income' then raise exception 'Transaction "%" income must use an income category', tx_title; end if;
    tx_destination_amount := null; tx_fx_rate := null; tx_principal_amount := null; tx_interest_amount := null; tx_extra_principal_amount := null;
  elsif tx_kind = 'expense' then
    if tx_source_account_id is null then raise exception 'Transaction "%" expense must include source_account_id', tx_title; end if;
    if tx_destination_account_id is not null then raise exception 'Transaction "%" expense must not include destination_account_id', tx_title; end if;
    if tx_category_id is null or category_type <> 'expense' then raise exception 'Transaction "%" expense must use an expense category', tx_title; end if;
    tx_destination_amount := null; tx_fx_rate := null; tx_principal_amount := null; tx_interest_amount := null; tx_extra_principal_amount := null;
  elsif tx_kind = 'transfer' then
    if tx_source_account_id is null or tx_destination_account_id is null then raise exception 'Transaction "%" transfer must include source_account_id and destination_account_id', tx_title; end if;
    if tx_category_id is not null and tx_allocation_id is null and not exists (select 1 from public.wallets where id=tx_destination_account_id and user_id=p_user_id and type::text='pension') then raise exception 'Transaction "%" only transfers into a savings goal (destination_allocation_id) can use a category', tx_title; end if;
    if tx_category_id is not null and category_type <> 'expense' then raise exception 'Transaction "%" transfer category must be an expense category', tx_title; end if;
    tx_destination_amount := coalesce(tx_destination_amount, tx_amount); tx_principal_amount := null; tx_interest_amount := null; tx_extra_principal_amount := null;
  elsif tx_kind = 'debt_payment' then
    if tx_source_account_id is null or tx_destination_account_id is null then raise exception 'Transaction "%" debt_payment must include source_account_id and destination_account_id', tx_title; end if;
    if destination_type not in ('debt', 'credit_card') then raise exception 'Transaction "%" debt_payment destination must be a debt or credit card wallet', tx_title; end if;
    if tx_principal_amount < 0 or tx_interest_amount < 0 or tx_extra_principal_amount < 0 then raise exception 'Transaction "%" debt payment breakdown values must be non-negative', tx_title; end if;
    if tx_principal_amount + tx_interest_amount + tx_extra_principal_amount <= 0 then raise exception 'Transaction "%" debt_payment must include at least one breakdown amount', tx_title; end if;
    if abs((tx_principal_amount + tx_interest_amount + tx_extra_principal_amount) - tx_amount) > 0.01 then raise exception 'Transaction "%" amount must equal principal_amount + interest_amount + extra_principal_amount', tx_title; end if;
    if tx_category_id is not null and category_type <> 'expense' then raise exception 'Transaction "%" debt_payment category must be an expense category', tx_title; end if;
    tx_destination_amount := null; tx_fx_rate := null;
  end if;

  update public.finance_transactions
  set
    title = tx_title,
    note = tx_note,
    occurred_at = tx_occurred_at,
    is_explicit_reschedule = case when p_transaction ? 'is_explicit_reschedule' then (p_transaction->>'is_explicit_reschedule')::boolean else is_explicit_reschedule end,
    status = tx_status,
    kind = tx_kind,
    amount = tx_amount,
    destination_amount = tx_destination_amount,
    fx_rate = tx_fx_rate,
    principal_amount = tx_principal_amount,
    interest_amount = tx_interest_amount,
    extra_principal_amount = tx_extra_principal_amount,
    category_id = tx_category_id,
    source_account_id = tx_source_account_id,
    destination_account_id = tx_destination_account_id,
    allocation_id = tx_allocation_id,
    source_allocation_id = tx_source_allocation_id,
    is_schedule_override = case when schedule_id is not null then true else is_schedule_override end
  where id = p_transaction_id
    and user_id = key_user_id
  returning jsonb_build_object(
    'id', id,
    'title', title,
    'kind', kind,
    'status', status,
    'amount', amount,
    'occurred_at', occurred_at,
    'category_id', category_id,
    'source_account_id', source_account_id,
    'destination_account_id', destination_account_id,
    'destination_allocation_id', allocation_id,
    'source_allocation_id', source_allocation_id
  ) into updated_payload;

  return jsonb_build_object('updated', updated_payload);
end;
$$;
create or replace function public.mcp_normalize_recurring_schedule(
  p_user_id uuid,
  p_schedule jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tx_title text;
  tx_note text;
  tx_start_date date;
  tx_frequency public.finance_transaction_schedule_frequency;
  tx_interval_count integer;
  tx_interval_unit text;
  tx_until_date date;
  tx_kind public.finance_transaction_kind;
  tx_amount numeric;
  tx_destination_amount numeric;
  tx_fx_rate numeric;
  tx_principal_amount numeric;
  tx_interest_amount numeric;
  tx_extra_principal_amount numeric;
  tx_category_id uuid;
  tx_source_account_id uuid;
  tx_destination_account_id uuid;
  tx_allocation_id uuid;
  tx_source_allocation_id uuid;
  source_exists boolean;
  destination_exists boolean;
  destination_type public.wallet_type;
  category_type public.finance_category_type;
  category_has_children boolean;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if jsonb_typeof(p_schedule) <> 'object' then
    raise exception 'schedule must be an object';
  end if;
  if p_schedule - array['title','note','start_date','frequency','interval_count','interval_unit','until_date','kind','amount','destination_amount','fx_rate','principal_amount','interest_amount','extra_principal_amount','category_id','source_account_id','destination_account_id','destination_allocation_id','source_allocation_id'] <> '{}'::jsonb then
    raise exception 'Unsupported recurring schedule fields';
  end if;

  tx_title := nullif(btrim(p_schedule->>'title'), '');
  tx_note := nullif(btrim(coalesce(p_schedule->>'note', '')), '');
  tx_start_date := (p_schedule->>'start_date')::date;
  tx_frequency := (p_schedule->>'frequency')::public.finance_transaction_schedule_frequency;
  tx_interval_count := nullif(p_schedule->>'interval_count', '')::integer;
  tx_interval_unit := nullif(btrim(p_schedule->>'interval_unit'), '');
  tx_until_date := nullif(p_schedule->>'until_date', '')::date;
  tx_kind := (p_schedule->>'kind')::public.finance_transaction_kind;
  tx_amount := (p_schedule->>'amount')::numeric;
  tx_destination_amount := nullif(p_schedule->>'destination_amount', '')::numeric;
  tx_fx_rate := nullif(p_schedule->>'fx_rate', '')::numeric;
  tx_principal_amount := coalesce(nullif(p_schedule->>'principal_amount', '')::numeric, 0);
  tx_interest_amount := coalesce(nullif(p_schedule->>'interest_amount', '')::numeric, 0);
  tx_extra_principal_amount := coalesce(nullif(p_schedule->>'extra_principal_amount', '')::numeric, 0);
  tx_category_id := nullif(p_schedule->>'category_id', '')::uuid;
  tx_source_account_id := nullif(p_schedule->>'source_account_id', '')::uuid;
  tx_destination_account_id := nullif(p_schedule->>'destination_account_id', '')::uuid;
  tx_allocation_id := nullif(p_schedule->>'destination_allocation_id', '')::uuid;
  tx_source_allocation_id := nullif(p_schedule->>'source_allocation_id', '')::uuid;

  if tx_title is null then
    raise exception 'Recurring transaction must have a title';
  end if;

  if tx_start_date is null then
    raise exception 'Recurring transaction "%" must have a start_date', tx_title;
  end if;

  if tx_until_date is not null and tx_until_date < tx_start_date then
    raise exception 'Recurring transaction "%" until_date must be on or after start_date', tx_title;
  end if;

  if tx_amount is null or tx_amount <= 0 then
    raise exception 'Recurring transaction "%" must have a positive amount', tx_title;
  end if;

  if tx_frequency::text not in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom') then
    raise exception 'Recurring transaction "%" frequency is not supported', tx_title;
  end if;

  if tx_frequency::text = 'custom' then
    if tx_interval_count is null or tx_interval_count < 1 then
      raise exception 'Recurring transaction "%" custom frequency needs interval_count of at least 1', tx_title;
    end if;
    if tx_interval_unit is null or tx_interval_unit not in ('day', 'week', 'month') then
      raise exception 'Recurring transaction "%" custom frequency needs interval_unit of day, week, or month', tx_title;
    end if;
  else
    -- Presets define their own interval. A client that echoes the stored pair back
    -- (get -> edit -> update) is fine; a conflicting pair is an error, not silently ignored.
    declare
      preset_count integer := case tx_frequency::text when 'quarterly' then 3 when 'yearly' then 12 else 1 end;
      preset_unit text := case tx_frequency::text when 'daily' then 'day' when 'weekly' then 'week' else 'month' end;
    begin
      if (tx_interval_count is not null and tx_interval_count <> preset_count)
        or (tx_interval_unit is not null and tx_interval_unit <> preset_unit) then
        raise exception 'Recurring transaction "%" interval_count and interval_unit are only for frequency custom; use frequency custom for a different interval', tx_title;
      end if;
      tx_interval_count := preset_count;
      tx_interval_unit := preset_unit;
    end;
  end if;

  if tx_kind not in ('income', 'expense', 'transfer', 'debt_payment') then
    raise exception 'Recurring transaction "%" kind is not supported', tx_title;
  end if;

  if tx_destination_amount is not null and tx_destination_amount <= 0 then
    raise exception 'Recurring transaction "%" destination_amount must be positive when provided', tx_title;
  end if;

  if tx_fx_rate is not null and tx_fx_rate <= 0 then
    raise exception 'Recurring transaction "%" fx_rate must be positive when provided', tx_title;
  end if;

  if tx_source_account_id is not null then
    select exists (
      select 1 from public.wallets
      where id = tx_source_account_id
        and user_id = p_user_id
    ) into source_exists;

    if not source_exists then
      raise exception 'Recurring transaction "%" source account not found', tx_title;
    end if;
  end if;

  if tx_destination_account_id is not null then
    select w.type
    into destination_type
    from public.wallets w
    where w.id = tx_destination_account_id
      and w.user_id = p_user_id;

    destination_exists := destination_type is not null;
    if not destination_exists then
      raise exception 'Recurring transaction "%" destination account not found', tx_title;
    end if;
  else
    destination_type := null;
  end if;

  if tx_source_account_id is not null
    and tx_destination_account_id is not null
    and tx_source_account_id = tx_destination_account_id then
    raise exception 'Recurring transaction "%" source and destination accounts must be different', tx_title;
  end if;

  if tx_category_id is not null then
    select c.type
    into category_type
    from public.finance_categories c
    where c.id = tx_category_id
      and c.user_id = p_user_id;

    if category_type is null then
      raise exception 'Recurring transaction "%" category not found', tx_title;
    end if;

    select exists (
      select 1
      from public.finance_categories child
      where child.user_id = p_user_id
        and child.parent_id = tx_category_id
    ) into category_has_children;

    if category_has_children then
      raise exception 'Recurring transaction "%" category must be a selectable leaf category', tx_title;
    end if;
  else
    category_type := null;
  end if;

  if tx_source_allocation_id is not null then
    if tx_kind not in ('expense','transfer') then raise exception 'source_allocation_id is only supported on expenses and transfers'; end if;
    if not exists (select 1 from public.wallet_allocations a join public.wallets w on w.id=a.wallet_id where a.id=tx_source_allocation_id and a.user_id=p_user_id and w.user_id=p_user_id and w.id=tx_source_account_id and w.type='saving') then
      raise exception 'source_allocation_id must be a goal of the source savings wallet';
    end if;
    if tx_source_allocation_id = tx_allocation_id then raise exception 'Choose two different goals'; end if;
  end if;
  if tx_allocation_id is not null and tx_kind in ('debt_payment', 'expense') then
    raise exception 'Recurring transaction "%" destination goals are not supported on expenses or debt payments', tx_title;
  end if;
  if tx_allocation_id is not null and not exists (
    select 1 from public.wallet_allocations a
    where a.id = tx_allocation_id and a.user_id = p_user_id and a.wallet_id = tx_destination_account_id
  ) then
    raise exception 'Recurring transaction "%" destination_allocation_id must be a goal of the wallet that holds the money (source wallet for expenses, destination wallet for transfers and income)', tx_title;
  end if;

  if tx_kind = 'income' then
    if tx_destination_account_id is null then
      raise exception 'Recurring transaction "%" income must include destination_account_id', tx_title;
    end if;
    if tx_source_account_id is not null then
      raise exception 'Recurring transaction "%" income must not include source_account_id', tx_title;
    end if;
    if tx_category_id is null or category_type <> 'income' then
      raise exception 'Recurring transaction "%" income must use an income category', tx_title;
    end if;
    tx_destination_amount := null;
    tx_fx_rate := null;
    tx_principal_amount := null;
    tx_interest_amount := null;
    tx_extra_principal_amount := null;
  elsif tx_kind = 'expense' then
    if tx_source_account_id is null then
      raise exception 'Recurring transaction "%" expense must include source_account_id', tx_title;
    end if;
    if tx_destination_account_id is not null then
      raise exception 'Recurring transaction "%" expense must not include destination_account_id', tx_title;
    end if;
    if tx_category_id is null or category_type <> 'expense' then
      raise exception 'Recurring transaction "%" expense must use an expense category', tx_title;
    end if;
    tx_destination_amount := null;
    tx_fx_rate := null;
    tx_principal_amount := null;
    tx_interest_amount := null;
    tx_extra_principal_amount := null;
  elsif tx_kind = 'transfer' then
    if tx_source_account_id is null or tx_destination_account_id is null then
      raise exception 'Recurring transaction "%" transfer must include source_account_id and destination_account_id', tx_title;
    end if;
    if tx_category_id is not null and tx_allocation_id is null and not exists (select 1 from public.wallets where id=tx_destination_account_id and user_id=p_user_id and type::text='pension') then
      raise exception 'Recurring transaction "%" only transfers into a savings goal (destination_allocation_id) can use a category', tx_title;
    end if;
    if tx_category_id is not null and category_type <> 'expense' then
      raise exception 'Recurring transaction "%" transfer category must be an expense category', tx_title;
    end if;
    tx_destination_amount := coalesce(tx_destination_amount, tx_amount);
    tx_principal_amount := null;
    tx_interest_amount := null;
    tx_extra_principal_amount := null;
  elsif tx_kind = 'debt_payment' then
    if tx_source_account_id is null or tx_destination_account_id is null then
      raise exception 'Recurring transaction "%" debt_payment must include source_account_id and destination_account_id', tx_title;
    end if;
    if destination_type not in ('debt', 'credit_card') then
      raise exception 'Recurring transaction "%" debt_payment destination must be a debt or credit card wallet', tx_title;
    end if;
    if tx_principal_amount < 0 or tx_interest_amount < 0 or tx_extra_principal_amount < 0 then
      raise exception 'Recurring transaction "%" debt payment breakdown values must be non-negative', tx_title;
    end if;
    if tx_principal_amount + tx_interest_amount + tx_extra_principal_amount <= 0 then
      raise exception 'Recurring transaction "%" debt_payment must include at least one breakdown amount', tx_title;
    end if;
    if abs((tx_principal_amount + tx_interest_amount + tx_extra_principal_amount) - tx_amount) > 0.01 then
      raise exception 'Recurring transaction "%" amount must equal principal_amount + interest_amount + extra_principal_amount', tx_title;
    end if;
    if tx_category_id is not null and category_type <> 'expense' then
      raise exception 'Recurring transaction "%" debt_payment category must be an expense category', tx_title;
    end if;
    tx_destination_amount := null;
    tx_fx_rate := null;
  end if;

  return jsonb_build_object(
    'title', tx_title,
    'note', tx_note,
    'start_date', tx_start_date,
    'frequency', tx_frequency,
    'interval_count', tx_interval_count,
    'interval_unit', tx_interval_unit,
    'until_date', tx_until_date,
    'kind', tx_kind,
    'amount', tx_amount,
    'destination_amount', tx_destination_amount,
    'fx_rate', tx_fx_rate,
    'principal_amount', tx_principal_amount,
    'interest_amount', tx_interest_amount,
    'extra_principal_amount', tx_extra_principal_amount,
    'category_id', tx_category_id,
    'source_account_id', tx_source_account_id,
    'destination_account_id', tx_destination_account_id,
    'allocation_id', tx_allocation_id,
    'source_allocation_id', tx_source_allocation_id
  );
end;
$$;
create or replace function public.mcp_get_budget_status_source(
  p_key_hash text,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  user_currencies text[];
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date or p_end_date - p_start_date > 31 then
    raise exception 'Budget status needs a single month';
  end if;

  select array_agg(distinct currency::text) into user_currencies
  from (
    select w.currency from public.wallets w where w.user_id = key_user_id
    union all
    select p.default_currency from public.user_preferences p where p.user_id = key_user_id and p.default_currency is not null
    union all
    select 'EUR'::public.currency_code
  ) currencies;

  return jsonb_build_object(
    'default_currency', (select p.default_currency from public.user_preferences p where p.user_id = key_user_id),
    'wallets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'user_id', w.user_id, 'name', w.name, 'type', w.type,
        'cash_kind', w.cash_kind, 'debt_kind', w.debt_kind, 'balance', w.balance,
        'credit_limit', w.credit_limit, 'currency', w.currency, 'created_at', w.created_at
      ) order by w.created_at desc)
      from public.wallets w where w.user_id = key_user_id
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'user_id', c.user_id, 'name', c.name, 'description', c.description,
        'icon', c.icon, 'type', c.type, 'parent_id', c.parent_id,
        'purpose', c.purpose,
        'is_system', c.is_system, 'created_at', c.created_at
      ) order by c.created_at)
      from public.finance_categories c
      where c.user_id = key_user_id and not coalesce(c.is_system, false)
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'user_id', t.user_id, 'title', t.title, 'note', t.note,
        'occurred_at', t.occurred_at, 'created_at', t.created_at, 'status', t.status,
        'kind', t.kind, 'amount', t.amount, 'destination_amount', t.destination_amount,
        'fx_rate', t.fx_rate, 'principal_amount', t.principal_amount,
        'interest_amount', t.interest_amount, 'extra_principal_amount', t.extra_principal_amount,
        'category_id', t.category_id, 'source_account_id', t.source_account_id,
        'destination_account_id', t.destination_account_id, 'schedule_id', t.schedule_id,
        'schedule_occurrence_date', t.schedule_occurrence_date,
        'is_schedule_override', t.is_schedule_override, 'allocation_id', t.allocation_id,
        'source_allocation_id', t.source_allocation_id,
        'linked_transaction_id', t.linked_transaction_id,
        'system_generated', t.system_generated
      ) order by t.occurred_at, t.created_at)
      from public.finance_transactions t
      left join public.finance_categories c on c.id = t.category_id
      where t.user_id = key_user_id and t.status in ('paid', 'planned')
        and t.occurred_at <= p_end_date
        and (c.is_system is null or c.is_system = false)
    ), '[]'::jsonb),
    -- Rates of the month plus, per pair, the latest one before it: the app converts with the latest rate
    -- dated on or before each transaction (and the latest known rate for future-dated planned ones).
    'exchange_rates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider', r.provider, 'base_currency', r.base_currency, 'quote_currency', r.quote_currency,
        'requested_date', r.requested_date, 'rate_date', r.rate_date, 'rate', r.rate, 'fetched_at', r.fetched_at
      ))
      from (
        select f.* from public.fx_rates f
        where f.requested_date <= p_end_date
          and f.base_currency::text = any(user_currencies) and f.quote_currency::text = any(user_currencies)
        union all
        (
          select distinct on (f.provider, f.base_currency, f.quote_currency) f.*
          from public.fx_rates f
          where f.requested_date < p_start_date
            and f.base_currency::text = any(user_currencies) and f.quote_currency::text = any(user_currencies)
          order by f.provider, f.base_currency, f.quote_currency, f.requested_date desc
        )
      ) r
    ), '[]'::jsonb)
  );
end;
$$;
create or replace function public.mcp_get_finance_context(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with recursive category_tree as (
    select c.id, c.user_id, c.name, c.description, c.icon, c.type, c.parent_id, c.is_system,
      c.created_at, c.name::text as path
    from public.finance_categories c
    where c.user_id = p_user_id
      and (c.is_system is null or c.is_system = false)
      and (c.parent_id is null or not exists (
        select 1 from public.finance_categories parent
        where parent.id = c.parent_id and parent.user_id = p_user_id
      ))
    union all
    select child.id, child.user_id, child.name, child.description, child.icon, child.type,
      child.parent_id, child.is_system, child.created_at,
      (parent.path || ' / ' || child.name)::text as path
    from public.finance_categories child
    join category_tree parent on parent.id = child.parent_id
    where child.user_id = p_user_id
      and (child.is_system is null or child.is_system = false)
  ),
  category_context as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'type', c.type, 'name', c.name, 'path', c.path,
      'parent_id', c.parent_id, 'description', c.description, 'icon', c.icon, 'is_system', c.is_system,
      'is_selectable', not exists (
        select 1 from public.finance_categories child
        where child.user_id = p_user_id and child.parent_id = c.id
      )
    ) order by c.type, c.path), '[]'::jsonb) as categories
    from category_tree c
  ),
  wallet_context as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', w.id, 'name', w.name, 'type', w.type, 'cash_kind', w.cash_kind,
      'debt_kind', w.debt_kind, 'currency', w.currency, 'balance', w.balance,
      'credit_limit', w.credit_limit, 'pension_state', w.pension_state
    ) order by w.created_at desc), '[]'::jsonb) as wallets
    from public.wallets w where w.user_id = p_user_id
  ),
  goal_context as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'wallet_id', a.wallet_id, 'name', a.name, 'kind', a.kind,
      'amount', a.amount, 'target_amount', a.target_amount,
      'is_default', a.is_default
    ) order by a.created_at desc), '[]'::jsonb) as goals
    from public.wallet_allocations a where a.user_id = p_user_id
  )
  select jsonb_build_object(
    'wallets', wallet_context.wallets,
    'categories', category_context.categories,
    'default_currency', (select p.default_currency from public.user_preferences p where p.user_id = p_user_id),
    'goals', goal_context.goals,
    'rules', jsonb_build_object(
      'income', 'Requires destination_account_id and an income category_id.',
      'expense', 'Requires source_account_id and an expense category_id. An expense from a savings goal uses source_allocation_id, never destination_allocation_id.',
      'transfer', 'Requires source_account_id and destination_account_id. destination_allocation_id puts the money into a savings goal of the destination wallet and source_allocation_id takes it from a goal of the source wallet. category_id (an expense category such as Next & Safe) is allowed only together with destination_allocation_id.',
      'debt_payment', 'Requires source_account_id, destination_account_id for a debt or credit_card wallet, and amount equal to principal_amount + interest_amount + extra_principal_amount. Only principal plus extra principal reduces debt. category_id is optional but must be an expense category when provided.'
    )
  ) from wallet_context, category_context, goal_context;
$$;
