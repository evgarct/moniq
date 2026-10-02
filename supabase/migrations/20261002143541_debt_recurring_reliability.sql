-- Restore principal-only debt effects and canonical source goals. No historical balances are replayed.
begin;
alter table public.finance_transaction_schedules add column source_allocation_id uuid references public.wallet_allocations(id) on delete set null;
alter table public.finance_transactions add column is_explicit_reschedule boolean not null default false;
-- Metadata-only conversion must not reverse/reapply paid rows with the new debt trigger.
alter table public.finance_transactions disable trigger finance_transactions_sync_wallet_balance;
update public.finance_transactions set source_allocation_id = coalesce(source_allocation_id, allocation_id), allocation_id = null where kind = 'expense' and allocation_id is not null;
update public.finance_transaction_schedules set source_allocation_id = allocation_id, allocation_id = null where kind = 'expense' and allocation_id is not null;
alter table public.finance_transactions enable trigger finance_transactions_sync_wallet_balance;
create or replace function public.sync_wallet_balance_on_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tx_amount numeric;
  destination_amount numeric;
  source_wallet public.wallets;
  reserved_total numeric;
  free_amount numeric;
  net_outflow numeric;
  fallback_amount numeric;
  default_allocation public.wallet_allocations;
  source_allocation public.wallet_allocations;
  destination_allocation public.wallet_allocations;
  linked_release public.finance_transactions;
  affected_wallets uuid[] := array[]::uuid[];
  affected_wallet_id uuid;
begin
  if TG_OP <> 'DELETE' then
    if NEW.kind in ('expense','debt_payment') and NEW.allocation_id is not null then
      raise exception 'Expenses use source_allocation_id; debt payments cannot use goals';
    end if;
    if NEW.source_allocation_id is not null and (NEW.kind not in ('expense','transfer') or not exists (
      select 1 from public.wallet_allocations a join public.wallets w on w.id=a.wallet_id
      where a.id=NEW.source_allocation_id and a.user_id=NEW.user_id and w.user_id=NEW.user_id
        and w.id=NEW.source_account_id and w.type='saving'
    )) then raise exception 'source_allocation_id must belong to the source savings wallet'; end if;
  end if;
  if TG_OP <> 'DELETE' and NEW.kind = 'debt_payment' then
    if coalesce(NEW.principal_amount,0) < 0 or coalesce(NEW.interest_amount,0) < 0 or coalesce(NEW.extra_principal_amount,0) < 0
       or abs(NEW.amount - coalesce(NEW.principal_amount,0) - coalesce(NEW.interest_amount,0) - coalesce(NEW.extra_principal_amount,0)) > 0.01 then
      raise exception 'Debt payment amount must equal principal + interest + extra principal';
    end if;
    if not exists (select 1 from public.wallets w where w.id = NEW.destination_account_id and w.user_id = NEW.user_id and w.type in ('debt','credit_card')) then
      raise exception 'Debt payment must target a debt or credit card wallet';
    end if;
  end if;
  -- Synthetic goal releases are ledger-only rows. Their parent operation owns
  -- wallet and allocation reconciliation.
  if (TG_OP <> 'DELETE' and NEW.system_generated) or (TG_OP = 'DELETE' and OLD.system_generated) then
    if coalesce(current_setting('moniq.disallow_allocation_enforcement', true), 'false') <> 'true' then
      raise exception 'System-generated savings releases cannot be changed directly.';
    end if;
    if TG_OP = 'DELETE' then return OLD; end if;
    return NEW;
  end if;

  perform set_config('moniq.disallow_allocation_enforcement', 'true', true);

  if TG_OP in ('UPDATE', 'DELETE') and OLD.status = 'paid' then
    select * into linked_release
    from public.finance_transactions
    where linked_transaction_id = OLD.id and system_generated
    for update;

    if found then
      update public.wallet_allocations
      set amount = amount + linked_release.amount, updated_at = now()
      where id = linked_release.source_allocation_id;

      delete from public.finance_transactions where id = linked_release.id;
    end if;

    tx_amount := OLD.amount;
    destination_amount := case when OLD.kind = 'debt_payment' then coalesce(OLD.principal_amount, 0) + coalesce(OLD.extra_principal_amount, 0) else coalesce(OLD.destination_amount, OLD.amount) end;

    if OLD.source_account_id is not null then
      perform public.adjust_wallet_balance(OLD.source_account_id, tx_amount);
      affected_wallets := array_append(affected_wallets, OLD.source_account_id);
    end if;
    if OLD.destination_account_id is not null then
      perform public.adjust_wallet_balance(OLD.destination_account_id, -destination_amount);
      affected_wallets := array_append(affected_wallets, OLD.destination_account_id);
    end if;

    if OLD.allocation_id is not null then
      update public.wallet_allocations
      set amount = amount + case when OLD.kind = 'expense' then tx_amount else -tx_amount end,
          updated_at = now()
      where id = OLD.allocation_id;
    end if;

    if OLD.source_allocation_id is not null then
      update public.wallet_allocations
      set amount = amount + tx_amount, updated_at = now()
      where id = OLD.source_allocation_id;
    end if;
  end if;

  if TG_OP in ('INSERT', 'UPDATE') and NEW.status = 'paid' then
    tx_amount := NEW.amount;
    destination_amount := case when NEW.kind = 'debt_payment' then coalesce(NEW.principal_amount, 0) + coalesce(NEW.extra_principal_amount, 0) else coalesce(NEW.destination_amount, NEW.amount) end;

    select * into source_wallet
    from public.wallets
    where id = NEW.source_account_id
    for update;

    if NEW.source_allocation_id is not null then
      if NEW.kind not in ('transfer', 'expense') then
        raise exception 'A source goal can only be selected for expenses and transfers.';
      end if;
      if not found or source_wallet.type <> 'saving' then
        raise exception 'Selected source goal does not belong to a savings account.';
      end if;

      select * into source_allocation
      from public.wallet_allocations
      where id = NEW.source_allocation_id
      for update;

      if not found or source_allocation.wallet_id <> source_wallet.id then
        raise exception 'Selected source goal does not belong to the source account.';
      end if;

      if NEW.allocation_id is not null and NEW.allocation_id = NEW.source_allocation_id then
        raise exception 'Choose two different goals.';
      end if;
    end if;

    if NEW.allocation_id is not null and NEW.kind = 'transfer' then
      if NEW.destination_account_id is null then
        raise exception 'A destination goal requires a destination account.';
      end if;

      select * into destination_allocation
      from public.wallet_allocations
      where id = NEW.allocation_id;

      if found and destination_allocation.wallet_id <> NEW.destination_account_id then
        raise exception 'Selected destination goal does not belong to the destination account.';
      end if;
    end if;

    if found and source_wallet.type = 'saving' and NEW.allocation_id is null and NEW.source_allocation_id is null then
      net_outflow := tx_amount - case
        when NEW.destination_account_id = NEW.source_account_id then destination_amount
        else 0
      end;

      if net_outflow > 0 then
        select coalesce(sum(amount), 0) into reserved_total
        from public.wallet_allocations
        where wallet_id = source_wallet.id;

        free_amount := source_wallet.balance - reserved_total;
        fallback_amount := greatest(net_outflow - greatest(free_amount, 0), 0);

        if fallback_amount > 0 then
          select * into default_allocation
          from public.wallet_allocations
          where wallet_id = source_wallet.id and is_default
          for update;

          if not found or default_allocation.amount < fallback_amount then
            raise exception 'Savings operation exceeds Free plus the default goal balance.';
          end if;

          update public.wallet_allocations
          set amount = amount - fallback_amount, updated_at = now()
          where id = default_allocation.id;

          insert into public.finance_transactions (
            user_id, title, note, occurred_at, status, kind, amount,
            destination_amount, source_account_id, destination_account_id,
            source_allocation_id, linked_transaction_id, system_generated
          ) values (
            NEW.user_id, default_allocation.name, null, NEW.occurred_at, 'paid', 'transfer', fallback_amount,
            fallback_amount, source_wallet.id, source_wallet.id,
            default_allocation.id, NEW.id, true
          );
        end if;
      end if;
    end if;

    if NEW.source_allocation_id is not null then
      if source_allocation.amount < tx_amount then
        raise exception 'Selected goal does not have enough funds for this transaction.';
      end if;

      update public.wallet_allocations
      set amount = amount - tx_amount, updated_at = now()
      where id = source_allocation.id;
    end if;

    if NEW.source_account_id is not null then
      perform public.adjust_wallet_balance(NEW.source_account_id, -tx_amount);
      affected_wallets := array_append(affected_wallets, NEW.source_account_id);
    end if;
    if NEW.destination_account_id is not null then
      perform public.adjust_wallet_balance(NEW.destination_account_id, destination_amount);
      affected_wallets := array_append(affected_wallets, NEW.destination_account_id);
    end if;

    if NEW.allocation_id is not null then
      update public.wallet_allocations
      set amount = amount + case when NEW.kind = 'expense' then -tx_amount else tx_amount end,
          updated_at = now()
      where id = NEW.allocation_id;

      if exists (select 1 from public.wallet_allocations where id = NEW.allocation_id and amount < 0) then
        raise exception 'Savings goal balance cannot go below zero.';
      end if;
    end if;
  end if;

  perform set_config('moniq.disallow_allocation_enforcement', 'false', true);
  if array_length(affected_wallets, 1) is not null then
    foreach affected_wallet_id in array affected_wallets loop
      perform public.enforce_wallet_allocations_limit(affected_wallet_id);
    end loop;
  end if;

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

-- Internal reconciliation is serialized per schedule and preserves all settled/overridden slots.
create or replace function public.reconcile_recurring_schedule_internal(p_schedule_id uuid)
returns void language plpgsql security definer set search_path = public as $reconcile$
declare
  s public.finance_transaction_schedules%rowtype;
  range_start date := date_trunc('month', current_date)::date;
  range_end date := (current_date + interval '18 months')::date;
begin
  select * into s from public.finance_transaction_schedules where id=p_schedule_id for update;
  if not found then return; end if;
  delete from public.finance_transactions t where t.schedule_id=s.id and t.user_id=s.user_id
    and t.status='planned' and not t.is_schedule_override and (
      s.state <> 'active' or t.schedule_occurrence_date > range_end or
      not public.mcp_schedule_has_occurrence(s.start_date,s.until_date,t.schedule_occurrence_date,s.interval_count,s.interval_unit)
    );
  if s.state <> 'active' then return; end if;
  insert into public.finance_transactions (
    user_id,title,note,occurred_at,status,kind,amount,destination_amount,fx_rate,
    principal_amount,interest_amount,extra_principal_amount,category_id,source_account_id,destination_account_id,
    allocation_id,source_allocation_id,schedule_id,schedule_occurrence_date,is_schedule_override
  ) select s.user_id,s.title,s.note,o.occurrence_date,'planned',s.kind,s.amount,s.destination_amount,s.fx_rate,
    s.principal_amount,s.interest_amount,s.extra_principal_amount,s.category_id,s.source_account_id,s.destination_account_id,
    s.allocation_id,s.source_allocation_id,s.id,o.occurrence_date,false
  from public.mcp_schedule_occurrences(s.start_date,s.interval_count,s.interval_unit,s.until_date,range_start,range_end) o
  on conflict (user_id,schedule_id,schedule_occurrence_date)
    where schedule_id is not null and schedule_occurrence_date is not null do nothing;
  update public.finance_transactions t set title=s.title,note=s.note,occurred_at=t.schedule_occurrence_date,
    kind=s.kind,amount=s.amount,destination_amount=s.destination_amount,fx_rate=s.fx_rate,
    principal_amount=s.principal_amount,interest_amount=s.interest_amount,extra_principal_amount=s.extra_principal_amount,
    category_id=s.category_id,source_account_id=s.source_account_id,destination_account_id=s.destination_account_id,
    allocation_id=s.allocation_id,source_allocation_id=s.source_allocation_id
  where t.schedule_id=s.id and t.user_id=s.user_id and t.status='planned' and not t.is_schedule_override
    and t.schedule_occurrence_date between range_start and range_end;
end;
$reconcile$;

create or replace function public.reconcile_recurring_schedules()
returns void language plpgsql security definer set search_path = public as $reconcile$
declare s record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  for s in select id from public.finance_transaction_schedules where user_id=auth.uid() order by id loop
    perform public.reconcile_recurring_schedule_internal(s.id);
  end loop;
end;
$reconcile$;

create or replace function public.materialize_schedule_after_write()
returns trigger language plpgsql security definer set search_path = public as $reconcile$
begin
  perform public.reconcile_recurring_schedule_internal(NEW.id);
  return NEW;
end;
$reconcile$;

-- Defer until a series-edit RPC has shifted its existing slots, avoiding temporary duplicate slots.
create constraint trigger finance_schedules_materialize
after insert or update on public.finance_transaction_schedules
deferrable initially deferred for each row execute function public.materialize_schedule_after_write();

create or replace function public.validate_recurring_occurrence_identity()
returns trigger language plpgsql security definer set search_path = public as $identity$
declare s public.finance_transaction_schedules%rowtype; period_unit text;
begin
  if TG_OP='UPDATE' and OLD.schedule_id is not null and
    (NEW.schedule_id is distinct from OLD.schedule_id or NEW.schedule_occurrence_date is distinct from OLD.schedule_occurrence_date)
    and exists (select 1 from public.finance_transaction_schedules where id=OLD.schedule_id)
    and coalesce(current_setting('moniq.series_date_shift',true),'false') <> 'true' then
    raise exception 'Recurring occurrence slot cannot change outside a series reschedule';
  end if;
  if NEW.schedule_id is null then return NEW; end if;
  select * into s from public.finance_transaction_schedules where id=NEW.schedule_id and user_id=NEW.user_id;
  if not found then raise exception 'Recurring schedule not found'; end if;
  period_unit := case when s.interval_unit='month' and s.interval_count >= 12 then 'year'
    when s.interval_unit='month' then 'month' when s.interval_unit='week' then 'week' else 'day' end;
  if NEW.schedule_occurrence_date is null then raise exception 'Recurring occurrence requires its original slot date'; end if;
  if date_trunc(period_unit,NEW.occurred_at) <> date_trunc(period_unit,NEW.schedule_occurrence_date)
    and not NEW.is_explicit_reschedule then
    raise exception 'Occurrence date is outside its schedule period; explicitly reschedule this occurrence first';
  end if;
  return NEW;
end;
$identity$;
create trigger finance_transactions_validate_occurrence
before insert or update on public.finance_transactions for each row execute function public.validate_recurring_occurrence_identity();

revoke all on function public.reconcile_recurring_schedule_internal(uuid) from public,anon,authenticated;
revoke all on function public.materialize_schedule_after_write() from public,anon,authenticated;
revoke all on function public.validate_recurring_occurrence_identity() from public,anon,authenticated;
revoke all on function public.reconcile_recurring_schedules() from public,anon;
grant execute on function public.reconcile_recurring_schedules() to authenticated;
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
      if tx_category_id is not null and tx_allocation_id is null then
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
    if tx_category_id is not null and tx_allocation_id is null then raise exception 'Transaction "%" only transfers into a savings goal (destination_allocation_id) can use a category', tx_title; end if;
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
    if tx_category_id is not null and tx_allocation_id is null then
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
create or replace function public.mcp_get_recurring_transaction_schedules(
  p_key_hash text,
  p_states text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
begin
  if p_states is not null and exists (
    select 1 from unnest(p_states) state where state not in ('active', 'paused')
  ) then
    raise exception 'states must contain only active or paused';
  end if;

  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  return jsonb_build_object(
    'schedules',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'title', s.title,
            'note', s.note,
            'start_date', s.start_date,
            'frequency', s.frequency,
            'interval_count', s.interval_count,
            'interval_unit', s.interval_unit,
            'until_date', s.until_date,
            'state', s.state,
            'kind', s.kind,
            'amount', s.amount,
            'destination_amount', s.destination_amount,
            'destination_allocation_id', s.allocation_id,
            'source_allocation_id', s.source_allocation_id,
            'source_allocation_name', (select a.name from public.wallet_allocations a where a.id=s.source_allocation_id),
            'destination_allocation_name', (select a.name from public.wallet_allocations a where a.id = s.allocation_id),
            'fx_rate', s.fx_rate,
            'principal_amount', s.principal_amount,
            'interest_amount', s.interest_amount,
            'extra_principal_amount', s.extra_principal_amount,
            'category_id', s.category_id,
            'category_name', c.name,
            'source_account_id', s.source_account_id,
            'source_account_name', source_wallet.name,
            'destination_account_id', s.destination_account_id,
            'destination_account_name', destination_wallet.name,
            'currency', coalesce(source_wallet.currency, destination_wallet.currency),
            'created_at', s.created_at,
            'updated_at', s.updated_at
          )
          order by s.created_at desc
        )
        from public.finance_transaction_schedules s
        left join public.wallets source_wallet
          on source_wallet.id = s.source_account_id and source_wallet.user_id = key_user_id
        left join public.wallets destination_wallet
          on destination_wallet.id = s.destination_account_id and destination_wallet.user_id = key_user_id
        left join public.finance_categories c
          on c.id = s.category_id and c.user_id = key_user_id
        where s.user_id = key_user_id
          and (p_states is null or s.state::text = any(p_states))
      ),
      '[]'::jsonb
    )
  );
end;
$$;
create or replace function public.mcp_create_recurring_transaction_schedule(
  p_key_hash text,
  p_schedule jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  normalized jsonb;
  schedule_id uuid;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);
  normalized := public.mcp_normalize_recurring_schedule(key_user_id, p_schedule);

  insert into public.finance_transaction_schedules (
    user_id, title, note, start_date, frequency, interval_count, interval_unit, until_date, state, kind, amount,
    destination_amount, fx_rate, principal_amount, interest_amount, extra_principal_amount,
    category_id, source_account_id, destination_account_id, allocation_id, source_allocation_id
  )
  values (
    key_user_id,
    normalized->>'title',
    normalized->>'note',
    (normalized->>'start_date')::date,
    (normalized->>'frequency')::public.finance_transaction_schedule_frequency,
    (normalized->>'interval_count')::integer,
    normalized->>'interval_unit',
    nullif(normalized->>'until_date', '')::date,
    'active',
    (normalized->>'kind')::public.finance_transaction_kind,
    (normalized->>'amount')::numeric,
    nullif(normalized->>'destination_amount', '')::numeric,
    nullif(normalized->>'fx_rate', '')::numeric,
    nullif(normalized->>'principal_amount', '')::numeric,
    nullif(normalized->>'interest_amount', '')::numeric,
    nullif(normalized->>'extra_principal_amount', '')::numeric,
    nullif(normalized->>'category_id', '')::uuid,
    nullif(normalized->>'source_account_id', '')::uuid,
    nullif(normalized->>'destination_account_id', '')::uuid,
    nullif(normalized->>'allocation_id', '')::uuid,
    nullif(normalized->>'source_allocation_id', '')::uuid
  )
  returning id into schedule_id;

  return jsonb_build_object('schedule_id', schedule_id);
end;
$$;
create or replace function public.mcp_update_recurring_transaction_schedule(
  p_key_hash text,
  p_schedule_id uuid,
  p_schedule jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  normalized jsonb;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);
  normalized := public.mcp_normalize_recurring_schedule(key_user_id, p_schedule);

  update public.finance_transaction_schedules
  set
    title = normalized->>'title',
    note = normalized->>'note',
    start_date = (normalized->>'start_date')::date,
    frequency = (normalized->>'frequency')::public.finance_transaction_schedule_frequency,
    interval_count = (normalized->>'interval_count')::integer,
    interval_unit = normalized->>'interval_unit',
    until_date = nullif(normalized->>'until_date', '')::date,
    kind = (normalized->>'kind')::public.finance_transaction_kind,
    amount = (normalized->>'amount')::numeric,
    destination_amount = nullif(normalized->>'destination_amount', '')::numeric,
    fx_rate = nullif(normalized->>'fx_rate', '')::numeric,
    principal_amount = nullif(normalized->>'principal_amount', '')::numeric,
    interest_amount = nullif(normalized->>'interest_amount', '')::numeric,
    extra_principal_amount = nullif(normalized->>'extra_principal_amount', '')::numeric,
    category_id = nullif(normalized->>'category_id', '')::uuid,
    source_account_id = nullif(normalized->>'source_account_id', '')::uuid,
    destination_account_id = nullif(normalized->>'destination_account_id', '')::uuid,
    allocation_id = nullif(normalized->>'allocation_id', '')::uuid,
    source_allocation_id = nullif(normalized->>'source_allocation_id', '')::uuid
  where id = p_schedule_id
    and user_id = key_user_id;

  if not found then
    raise exception 'Recurring transaction series not found';
  end if;

  update public.finance_transactions
  set
    title = normalized->>'title',
    note = normalized->>'note',
    kind = (normalized->>'kind')::public.finance_transaction_kind,
    amount = (normalized->>'amount')::numeric,
    destination_amount = nullif(normalized->>'destination_amount', '')::numeric,
    fx_rate = nullif(normalized->>'fx_rate', '')::numeric,
    principal_amount = nullif(normalized->>'principal_amount', '')::numeric,
    interest_amount = nullif(normalized->>'interest_amount', '')::numeric,
    extra_principal_amount = nullif(normalized->>'extra_principal_amount', '')::numeric,
    category_id = nullif(normalized->>'category_id', '')::uuid,
    source_account_id = nullif(normalized->>'source_account_id', '')::uuid,
    destination_account_id = nullif(normalized->>'destination_account_id', '')::uuid,
    allocation_id = nullif(normalized->>'allocation_id', '')::uuid,
    source_allocation_id = nullif(normalized->>'source_allocation_id', '')::uuid
  where user_id = key_user_id
    and schedule_id = p_schedule_id
    and status = 'planned'
    and is_schedule_override = false;

  delete from public.finance_transactions t
  where t.user_id = key_user_id
    and t.schedule_id = p_schedule_id
    and t.status = 'planned'
    and t.is_schedule_override = false
    and not public.mcp_schedule_has_occurrence(
      (normalized->>'start_date')::date,
      nullif(normalized->>'until_date', '')::date,
      t.schedule_occurrence_date,
      (normalized->>'interval_count')::integer,
      normalized->>'interval_unit'
    );

  return jsonb_build_object('schedule_id', p_schedule_id);
end;
$$;
create or replace function public.mcp_get_transactions_for_period(
  p_key_hash text,
  p_start_date date,
  p_end_date date,
  p_statuses text[] default null,
  p_kinds text[] default null,
  p_account_ids text[] default null,
  p_category_ids text[] default null,
  p_include_context boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  max_transactions integer := 5000;
  returned_transaction_count integer;
  response jsonb;
begin
  if p_start_date is null or p_end_date is null then
    raise exception 'start_date and end_date are required';
  end if;

  if p_start_date > p_end_date then
    raise exception 'start_date must be on or before end_date';
  end if;

  if p_statuses is not null and exists (select 1 from unnest(p_statuses) status where status not in ('paid', 'planned', 'skipped')) then
    raise exception 'statuses must contain only paid, planned, or skipped';
  end if;

  if p_kinds is not null and exists (select 1 from unnest(p_kinds) kind where kind not in ('income', 'expense', 'transfer', 'debt_payment')) then
    raise exception 'kinds must contain only income, expense, transfer, or debt_payment';
  end if;

  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  with
  materialized_occurrences as (
    select t.schedule_id, t.schedule_occurrence_date
    from public.finance_transactions t
    where t.user_id = key_user_id
      and t.schedule_id is not null
      and t.schedule_occurrence_date is not null
      and t.schedule_occurrence_date >= p_start_date
      and t.schedule_occurrence_date <= p_end_date
  ),
  actual_transactions as (
    select
      t.id::text as sort_id,
      t.occurred_at,
      t.created_at,
      t.status::text as status,
      t.kind::text as kind,
      coalesce(source_wallet.currency, destination_wallet.currency)::text as currency,
      t.amount,
      jsonb_build_object(
        'id', t.id,
        'source', 'ledger',
        'is_generated', false,
        'user_id', t.user_id,
        'title', t.title,
        'note', t.note,
        'occurred_at', t.occurred_at,
        'created_at', t.created_at,
        'status', t.status,
        'kind', t.kind,
        'amount', t.amount,
        'destination_amount', t.destination_amount,
        'destination_allocation_id', t.allocation_id,
        'destination_allocation_name', (select a.name from public.wallet_allocations a where a.id = t.allocation_id),
        'source_allocation_id', t.source_allocation_id,
        'source_allocation_name', (select a.name from public.wallet_allocations a where a.id = t.source_allocation_id),
        'fx_rate', t.fx_rate,
        'principal_amount', t.principal_amount,
        'interest_amount', t.interest_amount,
        'extra_principal_amount', t.extra_principal_amount,
        'category_id', t.category_id,
        'category_name', category.name,
        'source_account_id', t.source_account_id,
        'source_account_name', source_wallet.name,
        'destination_account_id', t.destination_account_id,
        'destination_account_name', destination_wallet.name,
        'currency', coalesce(source_wallet.currency, destination_wallet.currency),
        'schedule_id', t.schedule_id,
        'schedule_occurrence_date', t.schedule_occurrence_date,
        'is_schedule_override', t.is_schedule_override
      ) as payload
    from public.finance_transactions t
    left join public.wallets source_wallet on source_wallet.id = t.source_account_id and source_wallet.user_id = key_user_id
    left join public.wallets destination_wallet on destination_wallet.id = t.destination_account_id and destination_wallet.user_id = key_user_id
    left join public.finance_categories category on category.id = t.category_id and category.user_id = key_user_id
    where t.user_id = key_user_id
      and t.occurred_at >= p_start_date
      and t.occurred_at <= p_end_date
      and (p_statuses is null or t.status::text = any(p_statuses))
      and (p_kinds is null or t.kind::text = any(p_kinds))
      and (p_account_ids is null or t.source_account_id::text = any(p_account_ids) or t.destination_account_id::text = any(p_account_ids))
      and (p_category_ids is null or t.category_id::text = any(p_category_ids))
      and (category.is_system is null or category.is_system = false)
  ),
  active_schedules as (
    select
      s.*,
      coalesce(source_wallet.currency, destination_wallet.currency)::text as currency,
      category.name as category_name,
      source_wallet.name as source_account_name,
      destination_wallet.name as destination_account_name
    from public.finance_transaction_schedules s
    left join public.wallets source_wallet on source_wallet.id = s.source_account_id and source_wallet.user_id = key_user_id
    left join public.wallets destination_wallet on destination_wallet.id = s.destination_account_id and destination_wallet.user_id = key_user_id
    left join public.finance_categories category on category.id = s.category_id and category.user_id = key_user_id
    where s.user_id = key_user_id
      and s.state = 'active'
      and s.start_date <= p_end_date
      and (s.until_date is null or s.until_date >= p_start_date)
      and (p_statuses is null or 'planned' = any(p_statuses))
      and (p_kinds is null or s.kind::text = any(p_kinds))
      and (p_account_ids is null or s.source_account_id::text = any(p_account_ids) or s.destination_account_id::text = any(p_account_ids))
      and (p_category_ids is null or s.category_id::text = any(p_category_ids))
      and (category.is_system is null or category.is_system = false)
  ),
  generated_occurrences as (
    select
      ('schedule:' || s.id::text || ':' || occurrence.occurrence_date::text) as sort_id,
      occurrence.occurrence_date as occurred_at,
      s.created_at,
      'planned'::text as status,
      s.kind::text as kind,
      s.currency,
      s.amount,
      jsonb_build_object(
        'id', 'schedule:' || s.id::text || ':' || occurrence.occurrence_date::text,
        'source', 'schedule',
        'is_generated', true,
        'user_id', s.user_id,
        'title', s.title,
        'note', s.note,
        'occurred_at', occurrence.occurrence_date,
        'created_at', s.created_at,
        'status', 'planned',
        'kind', s.kind,
        'amount', s.amount,
        'destination_amount', s.destination_amount,
        'destination_allocation_id', s.allocation_id,
            'source_allocation_id', s.source_allocation_id,
            'source_allocation_name', (select a.name from public.wallet_allocations a where a.id=s.source_allocation_id),
        'destination_allocation_name', (select a.name from public.wallet_allocations a where a.id = s.allocation_id),
        'fx_rate', s.fx_rate,
        'principal_amount', s.principal_amount,
        'interest_amount', s.interest_amount,
        'extra_principal_amount', s.extra_principal_amount,
        'category_id', s.category_id,
        'category_name', s.category_name,
        'source_account_id', s.source_account_id,
        'source_account_name', s.source_account_name,
        'destination_account_id', s.destination_account_id,
        'destination_account_name', s.destination_account_name,
        'currency', s.currency,
        'schedule_id', s.id,
        'schedule_occurrence_date', occurrence.occurrence_date,
        'is_schedule_override', false
      ) as payload
    from active_schedules s
    cross join lateral public.mcp_schedule_occurrences(
      s.start_date,
      s.interval_count,
      s.interval_unit,
      s.until_date,
      p_start_date,
      p_end_date
    ) occurrence
    where not exists (
      select 1
      from materialized_occurrences existing
      where existing.schedule_id = s.id
        and existing.schedule_occurrence_date = occurrence.occurrence_date
    )
  ),
  combined_transactions as (
    select * from actual_transactions
    union all
    select * from generated_occurrences
  )
  select count(*) into returned_transaction_count from combined_transactions;

  if returned_transaction_count > max_transactions then
    raise exception 'Requested period returns % transactions, above limit %. Split the period into smaller ranges.', returned_transaction_count, max_transactions;
  end if;

  with
  materialized_occurrences as (
    select t.schedule_id, t.schedule_occurrence_date
    from public.finance_transactions t
    where t.user_id = key_user_id
      and t.schedule_id is not null
      and t.schedule_occurrence_date is not null
      and t.schedule_occurrence_date >= p_start_date
      and t.schedule_occurrence_date <= p_end_date
  ),
  actual_transactions as (
    select
      t.id::text as sort_id,
      t.occurred_at,
      t.created_at,
      t.status::text as status,
      t.kind::text as kind,
      coalesce(source_wallet.currency, destination_wallet.currency)::text as currency,
      t.amount,
      jsonb_build_object(
        'id', t.id,
        'source', 'ledger',
        'is_generated', false,
        'user_id', t.user_id,
        'title', t.title,
        'note', t.note,
        'occurred_at', t.occurred_at,
        'created_at', t.created_at,
        'status', t.status,
        'kind', t.kind,
        'amount', t.amount,
        'destination_amount', t.destination_amount,
        'destination_allocation_id', t.allocation_id,
        'destination_allocation_name', (select a.name from public.wallet_allocations a where a.id = t.allocation_id),
        'source_allocation_id', t.source_allocation_id,
        'source_allocation_name', (select a.name from public.wallet_allocations a where a.id = t.source_allocation_id),
        'fx_rate', t.fx_rate,
        'principal_amount', t.principal_amount,
        'interest_amount', t.interest_amount,
        'extra_principal_amount', t.extra_principal_amount,
        'category_id', t.category_id,
        'category_name', category.name,
        'source_account_id', t.source_account_id,
        'source_account_name', source_wallet.name,
        'destination_account_id', t.destination_account_id,
        'destination_account_name', destination_wallet.name,
        'currency', coalesce(source_wallet.currency, destination_wallet.currency),
        'schedule_id', t.schedule_id,
        'schedule_occurrence_date', t.schedule_occurrence_date,
        'is_schedule_override', t.is_schedule_override
      ) as payload
    from public.finance_transactions t
    left join public.wallets source_wallet on source_wallet.id = t.source_account_id and source_wallet.user_id = key_user_id
    left join public.wallets destination_wallet on destination_wallet.id = t.destination_account_id and destination_wallet.user_id = key_user_id
    left join public.finance_categories category on category.id = t.category_id and category.user_id = key_user_id
    where t.user_id = key_user_id
      and t.occurred_at >= p_start_date
      and t.occurred_at <= p_end_date
      and (p_statuses is null or t.status::text = any(p_statuses))
      and (p_kinds is null or t.kind::text = any(p_kinds))
      and (p_account_ids is null or t.source_account_id::text = any(p_account_ids) or t.destination_account_id::text = any(p_account_ids))
      and (p_category_ids is null or t.category_id::text = any(p_category_ids))
      and (category.is_system is null or category.is_system = false)
  ),
  active_schedules as (
    select
      s.*,
      coalesce(source_wallet.currency, destination_wallet.currency)::text as currency,
      category.name as category_name,
      source_wallet.name as source_account_name,
      destination_wallet.name as destination_account_name
    from public.finance_transaction_schedules s
    left join public.wallets source_wallet on source_wallet.id = s.source_account_id and source_wallet.user_id = key_user_id
    left join public.wallets destination_wallet on destination_wallet.id = s.destination_account_id and destination_wallet.user_id = key_user_id
    left join public.finance_categories category on category.id = s.category_id and category.user_id = key_user_id
    where s.user_id = key_user_id
      and s.state = 'active'
      and s.start_date <= p_end_date
      and (s.until_date is null or s.until_date >= p_start_date)
      and (p_statuses is null or 'planned' = any(p_statuses))
      and (p_kinds is null or s.kind::text = any(p_kinds))
      and (p_account_ids is null or s.source_account_id::text = any(p_account_ids) or s.destination_account_id::text = any(p_account_ids))
      and (p_category_ids is null or s.category_id::text = any(p_category_ids))
      and (category.is_system is null or category.is_system = false)
  ),
  generated_occurrences as (
    select
      ('schedule:' || s.id::text || ':' || occurrence.occurrence_date::text) as sort_id,
      occurrence.occurrence_date as occurred_at,
      s.created_at,
      'planned'::text as status,
      s.kind::text as kind,
      s.currency,
      s.amount,
      jsonb_build_object(
        'id', 'schedule:' || s.id::text || ':' || occurrence.occurrence_date::text,
        'source', 'schedule',
        'is_generated', true,
        'user_id', s.user_id,
        'title', s.title,
        'note', s.note,
        'occurred_at', occurrence.occurrence_date,
        'created_at', s.created_at,
        'status', 'planned',
        'kind', s.kind,
        'amount', s.amount,
        'destination_amount', s.destination_amount,
        'destination_allocation_id', s.allocation_id,
            'source_allocation_id', s.source_allocation_id,
            'source_allocation_name', (select a.name from public.wallet_allocations a where a.id=s.source_allocation_id),
        'destination_allocation_name', (select a.name from public.wallet_allocations a where a.id = s.allocation_id),
        'fx_rate', s.fx_rate,
        'principal_amount', s.principal_amount,
        'interest_amount', s.interest_amount,
        'extra_principal_amount', s.extra_principal_amount,
        'category_id', s.category_id,
        'category_name', s.category_name,
        'source_account_id', s.source_account_id,
        'source_account_name', s.source_account_name,
        'destination_account_id', s.destination_account_id,
        'destination_account_name', s.destination_account_name,
        'currency', s.currency,
        'schedule_id', s.id,
        'schedule_occurrence_date', occurrence.occurrence_date,
        'is_schedule_override', false
      ) as payload
    from active_schedules s
    cross join lateral public.mcp_schedule_occurrences(s.start_date, s.interval_count, s.interval_unit, s.until_date, p_start_date, p_end_date) occurrence
    where not exists (
      select 1 from materialized_occurrences existing
      where existing.schedule_id = s.id
        and existing.schedule_occurrence_date = occurrence.occurrence_date
    )
  ),
  combined_transactions as (
    select * from actual_transactions
    union all
    select * from generated_occurrences
  ),
  transaction_payload as (
    select coalesce(jsonb_agg(payload order by occurred_at desc, created_at desc, sort_id desc), '[]'::jsonb) as transactions
    from combined_transactions
  ),
  summary_payload as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'currency', currency,
          'transaction_count', transaction_count,
          'total_amount', total_amount,
          'income_amount', income_amount,
          'expense_amount', expense_amount,
          'transfer_amount', transfer_amount,
          'debt_payment_amount', debt_payment_amount,
          'paid_amount', paid_amount,
          'planned_amount', planned_amount,
          'skipped_amount', skipped_amount
        )
        order by currency
      ),
      '[]'::jsonb
    ) as summary_by_currency
    from (
      select
        coalesce(currency, 'unknown') as currency,
        count(*) as transaction_count,
        coalesce(sum(amount), 0) as total_amount,
        coalesce(sum(amount) filter (where kind = 'income'), 0) as income_amount,
        coalesce(sum(amount) filter (where kind = 'expense'), 0) as expense_amount,
        coalesce(sum(amount) filter (where kind = 'transfer'), 0) as transfer_amount,
        coalesce(sum(amount) filter (where kind = 'debt_payment'), 0) as debt_payment_amount,
        coalesce(sum(amount) filter (where status = 'paid'), 0) as paid_amount,
        coalesce(sum(amount) filter (where status = 'planned'), 0) as planned_amount,
        coalesce(sum(amount) filter (where status = 'skipped'), 0) as skipped_amount
      from combined_transactions
      group by coalesce(currency, 'unknown')
    ) grouped
  )
  select jsonb_build_object(
    'period', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date),
    'transactions', transaction_payload.transactions,
    'summary_by_currency', summary_payload.summary_by_currency,
    'limits', jsonb_build_object('max_transactions', max_transactions, 'returned_transactions', returned_transaction_count)
  )
  || case
    when p_include_context then jsonb_build_object(
      'accounts',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', w.id,
              'name', w.name,
              'type', w.type,
              'cash_kind', w.cash_kind,
              'debt_kind', w.debt_kind,
              'currency', w.currency,
              'balance', w.balance,
              'credit_limit', w.credit_limit
            )
            order by w.created_at desc
          )
          from public.wallets w
          where w.user_id = key_user_id
        ),
        '[]'::jsonb
      ),
      'categories',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', c.id,
              'name', c.name,
              'description', c.description,
              'icon', c.icon,
              'type', c.type,
              'parent_id', c.parent_id,
              'is_system', c.is_system
            )
            order by c.type, c.name
          )
          from public.finance_categories c
          where c.user_id = key_user_id
            and (c.is_system is null or c.is_system = false)
        ),
        '[]'::jsonb
      ),
      'schedules',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', s.id,
              'title', s.title,
              'note', s.note,
              'start_date', s.start_date,
              'frequency', s.frequency,
              'interval_count', s.interval_count,
              'interval_unit', s.interval_unit,
              'until_date', s.until_date,
              'state', s.state,
              'kind', s.kind,
              'amount', s.amount,
              'destination_amount', s.destination_amount,
              'destination_allocation_id', s.allocation_id,
            'source_allocation_id', s.source_allocation_id,
            'source_allocation_name', (select a.name from public.wallet_allocations a where a.id=s.source_allocation_id),
              'destination_allocation_name', (select a.name from public.wallet_allocations a where a.id = s.allocation_id),
              'fx_rate', s.fx_rate,
              'principal_amount', s.principal_amount,
              'interest_amount', s.interest_amount,
              'extra_principal_amount', s.extra_principal_amount,
              'category_id', s.category_id,
              'source_account_id', s.source_account_id,
              'destination_account_id', s.destination_account_id
            )
            order by s.created_at desc
          )
          from public.finance_transaction_schedules s
          where s.user_id = key_user_id
            and (
              s.category_id is null
              or exists (
                select 1
                from public.finance_categories schedule_category
                where schedule_category.id = s.category_id
                  and schedule_category.user_id = key_user_id
                  and (schedule_category.is_system is null or schedule_category.is_system = false)
              )
            )
        ),
        '[]'::jsonb
      )
    )
    else '{}'::jsonb
  end
  into response
  from transaction_payload, summary_payload;

  return response;
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
      'credit_limit', w.credit_limit
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
create or replace function public.mcp_materialize_recurring_occurrence(
  p_user_id uuid,
  p_schedule_id uuid,
  p_occurrence_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  schedule_row public.finance_transaction_schedules%rowtype;
  tx_id uuid;
begin
  -- Use the same schedule lock as reconciliation before inspecting or creating a slot.
  select * into schedule_row from public.finance_transaction_schedules
  where id=p_schedule_id and user_id=p_user_id for update;
  if not found then raise exception 'Recurring transaction series not found'; end if;
  select id
  into tx_id
  from public.finance_transactions
  where user_id = p_user_id
    and schedule_id = p_schedule_id
    and schedule_occurrence_date = p_occurrence_date
  limit 1;

  if tx_id is not null then
    return tx_id;
  end if;

  select *
  into schedule_row
  from public.finance_transaction_schedules
  where id = p_schedule_id
    and user_id = p_user_id;

  if schedule_row.id is null then
    raise exception 'Recurring transaction series not found';
  end if;

  if not public.mcp_schedule_has_occurrence(
    schedule_row.start_date,
    schedule_row.until_date,
    p_occurrence_date,
    schedule_row.interval_count,
    schedule_row.interval_unit
  ) then
    raise exception 'Occurrence date does not belong to this recurring transaction series';
  end if;

  insert into public.finance_transactions (
    user_id, title, note, occurred_at, status, kind, amount, destination_amount, fx_rate,
    principal_amount, interest_amount, extra_principal_amount, category_id, source_account_id,
    destination_account_id, allocation_id, source_allocation_id, schedule_id, schedule_occurrence_date, is_schedule_override
  )
  values (
    p_user_id, schedule_row.title, schedule_row.note, p_occurrence_date, 'planned', schedule_row.kind,
    schedule_row.amount, schedule_row.destination_amount, schedule_row.fx_rate, schedule_row.principal_amount,
    schedule_row.interest_amount, schedule_row.extra_principal_amount, schedule_row.category_id,
    schedule_row.source_account_id, schedule_row.destination_account_id, schedule_row.allocation_id, schedule_row.source_allocation_id,
    schedule_row.id, p_occurrence_date, false
  )
  returning id into tx_id;

  return tx_id;
end;
$$;
create or replace function public.mcp_update_recurring_transaction_occurrence(
  p_key_hash text,
  p_transaction_id uuid,
  p_schedule_id uuid,
  p_occurrence_date date,
  p_transaction jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  tx_id uuid;
  result jsonb;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  if p_transaction_id is not null then
    select id
    into tx_id
    from public.finance_transactions
    where id = p_transaction_id
      and user_id = key_user_id
      and schedule_id is not null;

    if tx_id is null then
      raise exception 'Recurring occurrence not found';
    end if;
  else
    tx_id := public.mcp_materialize_recurring_occurrence(key_user_id, p_schedule_id, p_occurrence_date);
  end if;

  result := public.mcp_update_transaction(p_key_hash, tx_id, p_transaction);
  update public.finance_transactions set is_schedule_override = true where id = tx_id and user_id = key_user_id;

  return jsonb_build_object('transaction_id', tx_id);
end;
$$;
create or replace function public.apply_recurring_occurrence_changes(
  p_schedule_id uuid,
  p_from_occurrence_date date,
  p_changes jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_schedule public.finance_transaction_schedules%rowtype;
  v_occurrence public.finance_transactions%rowtype;
  v_new_occurrence_date date;
  v_offset_days integer := 0;
  v_row record;
  v_unknown_changes jsonb;
begin
  perform set_config('moniq.series_date_shift', 'true', true);
  if p_changes is null or p_changes = '{}'::jsonb then
    raise exception 'At least one recurring occurrence change is required';
  end if;

  v_unknown_changes := p_changes - array[
    'title', 'note', 'occurred_at', 'kind', 'amount', 'destination_amount', 'fx_rate',
    'principal_amount', 'interest_amount', 'extra_principal_amount', 'category_id',
    'source_account_id', 'destination_account_id', 'allocation_id', 'source_allocation_id'
  ];
  if v_unknown_changes <> '{}'::jsonb then
    raise exception 'Unsupported recurring occurrence changes: %', v_unknown_changes;
  end if;

  select *
  into v_schedule
  from public.finance_transaction_schedules
  where id = p_schedule_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Transaction schedule not found';
  end if;

  select *
  into v_occurrence
  from public.finance_transactions
  where user_id = auth.uid()
    and schedule_id = p_schedule_id
    and schedule_occurrence_date = p_from_occurrence_date
    and status = 'planned'
  for update;

  if not found then
    raise exception 'Planned recurring occurrence not found';
  end if;

  if p_changes ? 'occurred_at' then
    v_new_occurrence_date := (p_changes ->> 'occurred_at')::date;
    v_offset_days := v_new_occurrence_date - v_occurrence.occurred_at;
  end if;

  update public.finance_transactions
  set is_schedule_override = true
  where user_id = auth.uid()
    and schedule_id = p_schedule_id
    and status = 'planned'
    and schedule_occurrence_date < p_from_occurrence_date;

  update public.finance_transaction_schedules
  set
    title = case when p_changes ? 'title' then trim(p_changes ->> 'title') else title end,
    note = case when p_changes ? 'note' then p_changes ->> 'note' else note end,
    start_date = start_date + v_offset_days,
    kind = case when p_changes ? 'kind' then (p_changes ->> 'kind')::public.finance_transaction_kind else kind end,
    amount = case when p_changes ? 'amount' then (p_changes ->> 'amount')::numeric else amount end,
    destination_amount = case when p_changes ? 'destination_amount' then (p_changes ->> 'destination_amount')::numeric else destination_amount end,
    fx_rate = case when p_changes ? 'fx_rate' then (p_changes ->> 'fx_rate')::numeric else fx_rate end,
    principal_amount = case when p_changes ? 'principal_amount' then (p_changes ->> 'principal_amount')::numeric else principal_amount end,
    interest_amount = case when p_changes ? 'interest_amount' then (p_changes ->> 'interest_amount')::numeric else interest_amount end,
    extra_principal_amount = case when p_changes ? 'extra_principal_amount' then (p_changes ->> 'extra_principal_amount')::numeric else extra_principal_amount end,
    category_id = case when p_changes ? 'category_id' then (p_changes ->> 'category_id')::uuid else category_id end,
    source_account_id = case when p_changes ? 'source_account_id' then (p_changes ->> 'source_account_id')::uuid else source_account_id end,
    destination_account_id = case when p_changes ? 'destination_account_id' then (p_changes ->> 'destination_account_id')::uuid else destination_account_id end,
    source_allocation_id = case when p_changes ? 'source_allocation_id' then (p_changes->>'source_allocation_id')::uuid else source_allocation_id end,
    allocation_id = case when p_changes ? 'allocation_id' then (p_changes ->> 'allocation_id')::uuid else allocation_id end
  where id = p_schedule_id
    and user_id = auth.uid();

  for v_row in
    select id
    from public.finance_transactions
    where user_id = auth.uid()
      and schedule_id = p_schedule_id
      and status = 'planned'
      and schedule_occurrence_date >= p_from_occurrence_date
    order by
      case when v_offset_days > 0 then schedule_occurrence_date end desc,
      case when v_offset_days <= 0 then schedule_occurrence_date end asc
    for update
  loop
    update public.finance_transactions
    set
      title = case when p_changes ? 'title' then trim(p_changes ->> 'title') else title end,
      note = case when p_changes ? 'note' then p_changes ->> 'note' else note end,
      occurred_at = occurred_at + v_offset_days,
      schedule_occurrence_date = schedule_occurrence_date + v_offset_days,
      is_explicit_reschedule = false,
      kind = case when p_changes ? 'kind' then (p_changes ->> 'kind')::public.finance_transaction_kind else kind end,
      amount = case when p_changes ? 'amount' then (p_changes ->> 'amount')::numeric else amount end,
      destination_amount = case when p_changes ? 'destination_amount' then (p_changes ->> 'destination_amount')::numeric else destination_amount end,
      fx_rate = case when p_changes ? 'fx_rate' then (p_changes ->> 'fx_rate')::numeric else fx_rate end,
      principal_amount = case when p_changes ? 'principal_amount' then (p_changes ->> 'principal_amount')::numeric else principal_amount end,
      interest_amount = case when p_changes ? 'interest_amount' then (p_changes ->> 'interest_amount')::numeric else interest_amount end,
      extra_principal_amount = case when p_changes ? 'extra_principal_amount' then (p_changes ->> 'extra_principal_amount')::numeric else extra_principal_amount end,
      category_id = case when p_changes ? 'category_id' then (p_changes ->> 'category_id')::uuid else category_id end,
      source_account_id = case when p_changes ? 'source_account_id' then (p_changes ->> 'source_account_id')::uuid else source_account_id end,
      destination_account_id = case when p_changes ? 'destination_account_id' then (p_changes ->> 'destination_account_id')::uuid else destination_account_id end,
      source_allocation_id = case when p_changes ? 'source_allocation_id' then (p_changes->>'source_allocation_id')::uuid else source_allocation_id end,
    allocation_id = case when p_changes ? 'allocation_id' then (p_changes ->> 'allocation_id')::uuid else allocation_id end,
      is_schedule_override = false
    where id = v_row.id
      and user_id = auth.uid();
  end loop;
  perform set_config('moniq.series_date_shift', 'false', true);
end;
$$;

commit;
