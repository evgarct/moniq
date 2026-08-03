-- Default savings goals, auditable fallback releases, and complete MCP transfer analytics.

alter table public.wallet_allocations
  add column if not exists is_default boolean not null default false;

with ranked as (
  select id, row_number() over (partition by wallet_id order by created_at, id) as position
  from public.wallet_allocations
)
update public.wallet_allocations allocation
set is_default = true
from ranked
where ranked.id = allocation.id and ranked.position = 1;

create unique index if not exists wallet_allocations_one_default_per_wallet_idx
  on public.wallet_allocations(wallet_id)
  where is_default;

alter table public.finance_transactions
  add column if not exists source_allocation_id uuid references public.wallet_allocations(id) on delete restrict,
  add column if not exists linked_transaction_id uuid,
  add column if not exists system_generated boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'finance_transactions_linked_transaction_fk'
  ) then
    alter table public.finance_transactions
      add constraint finance_transactions_linked_transaction_fk
      foreign key (linked_transaction_id) references public.finance_transactions(id)
      deferrable initially deferred;
  end if;
end $$;

create unique index if not exists finance_transactions_one_savings_release_idx
  on public.finance_transactions(linked_transaction_id)
  where system_generated and linked_transaction_id is not null;

alter table public.finance_transactions
  add constraint finance_transactions_system_release_shape_check
  check (
    not system_generated
    or (
      kind = 'transfer'
      and status = 'paid'
      and source_allocation_id is not null
      and linked_transaction_id is not null
      and source_account_id = destination_account_id
    )
  ) not valid;

alter table public.finance_transactions
  validate constraint finance_transactions_system_release_shape_check;

create or replace function public.enforce_wallet_allocations_limit(_wallet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_balance numeric;
  reserved_total numeric;
begin
  select balance into wallet_balance
  from public.wallets
  where id = _wallet_id and type = 'saving';

  if not found then return; end if;

  select coalesce(sum(amount), 0) into reserved_total
  from public.wallet_allocations
  where wallet_id = _wallet_id;

  if reserved_total > wallet_balance then
    raise exception 'Savings balance cannot be lower than its reserved goals.';
  end if;
end;
$$;

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
  linked_release public.finance_transactions;
  affected_wallets uuid[] := array[]::uuid[];
  affected_wallet_id uuid;
begin
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
    destination_amount := coalesce(OLD.destination_amount, OLD.amount);

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
  end if;

  if TG_OP in ('INSERT', 'UPDATE') and NEW.status = 'paid' then
    tx_amount := NEW.amount;
    destination_amount := coalesce(NEW.destination_amount, NEW.amount);

    select * into source_wallet
    from public.wallets
    where id = NEW.source_account_id
    for update;

    if found and source_wallet.type = 'saving' and NEW.allocation_id is null then
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

drop function if exists public.create_wallet_allocation(uuid, text, public.allocation_kind, numeric, numeric);
create function public.create_wallet_allocation(
  _wallet_id uuid,
  _name text,
  _kind public.allocation_kind,
  _amount numeric,
  _target_amount numeric default null,
  _is_default boolean default false
)
returns public.wallet_allocations
language plpgsql
security invoker
set search_path = public
as $$
declare
  wallet public.wallets;
  reserved_total numeric;
  allocation public.wallet_allocations;
  make_default boolean;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if _amount < 0 then raise exception 'Allocation amount cannot go below 0.'; end if;
  if _kind = 'goal_targeted' and (_target_amount is null or _target_amount <= 0) then
    raise exception 'Target amount is required for a targeted goal.';
  end if;
  if _kind = 'goal_open' then _target_amount := null; end if;

  select * into wallet from public.wallets
  where id = _wallet_id and user_id = auth.uid() and type = 'saving'
  for update;
  if not found then raise exception 'Saving wallet not found'; end if;

  select coalesce(sum(amount), 0) into reserved_total
  from public.wallet_allocations where wallet_id = _wallet_id and user_id = auth.uid();
  if reserved_total + _amount > wallet.balance then
    raise exception 'This allocation would exceed the available savings balance.';
  end if;

  make_default := _is_default or not exists (
    select 1 from public.wallet_allocations where wallet_id = _wallet_id
  );
  if make_default then
    update public.wallet_allocations set is_default = false where wallet_id = _wallet_id;
  end if;

  insert into public.wallet_allocations(user_id, wallet_id, name, kind, amount, target_amount, is_default)
  values (auth.uid(), _wallet_id, trim(_name), _kind, _amount, _target_amount, make_default)
  returning * into allocation;
  return allocation;
end;
$$;

drop function if exists public.update_wallet_allocation(uuid, text, public.allocation_kind, numeric, numeric);
create function public.update_wallet_allocation(
  _allocation_id uuid,
  _name text,
  _kind public.allocation_kind,
  _amount numeric,
  _target_amount numeric default null,
  _is_default boolean default false
)
returns public.wallet_allocations
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing public.wallet_allocations;
  wallet public.wallets;
  reserved_total numeric;
  updated public.wallet_allocations;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if _amount < 0 then raise exception 'Allocation amount cannot go below 0.'; end if;
  if _kind = 'goal_targeted' and (_target_amount is null or _target_amount <= 0) then
    raise exception 'Target amount is required for a targeted goal.';
  end if;
  if _kind = 'goal_open' then _target_amount := null; end if;

  select * into existing from public.wallet_allocations
  where id = _allocation_id and user_id = auth.uid() for update;
  if not found then raise exception 'Allocation not found'; end if;

  select * into wallet from public.wallets where id = existing.wallet_id for update;
  select coalesce(sum(amount), 0) into reserved_total
  from public.wallet_allocations
  where wallet_id = existing.wallet_id and id <> _allocation_id;
  if reserved_total + _amount > wallet.balance then
    raise exception 'This allocation would exceed the available savings balance.';
  end if;
  if existing.is_default and not _is_default then
    raise exception 'Choose another default goal before clearing this one.';
  end if;
  if _is_default then
    update public.wallet_allocations set is_default = false where wallet_id = existing.wallet_id;
  end if;

  update public.wallet_allocations
  set name = trim(_name), kind = _kind, amount = _amount,
      target_amount = _target_amount, is_default = _is_default
  where id = _allocation_id
  returning * into updated;
  return updated;
end;
$$;

drop function if exists public.create_wallet_allocation_with_id(uuid, uuid, text, public.allocation_kind, numeric, numeric);
create function public.create_wallet_allocation_with_id(
  _id uuid,
  _wallet_id uuid,
  _name text,
  _kind public.allocation_kind,
  _amount numeric,
  _target_amount numeric default null,
  _is_default boolean default false
)
returns public.wallet_allocations
language plpgsql
security invoker
set search_path = public
as $$
declare created public.wallet_allocations;
begin
  select * into created from public.create_wallet_allocation(
    _wallet_id, _name, _kind, _amount, _target_amount, _is_default
  );
  if created.id <> _id then
    update public.wallet_allocations set id = _id where id = created.id returning * into created;
  end if;
  return created;
end;
$$;

create or replace function public.delete_wallet_allocation(
  _allocation_id uuid,
  _replacement_allocation_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare existing public.wallet_allocations;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select * into existing from public.wallet_allocations
  where id = _allocation_id and user_id = auth.uid() for update;
  if not found then raise exception 'Allocation not found'; end if;

  if existing.is_default and exists (
    select 1 from public.wallet_allocations where wallet_id = existing.wallet_id and id <> existing.id
  ) then
    if _replacement_allocation_id is null or not exists (
      select 1 from public.wallet_allocations
      where id = _replacement_allocation_id and wallet_id = existing.wallet_id and id <> existing.id
    ) then
      raise exception 'Choose a replacement default goal before deleting this goal.';
    end if;
    update public.wallet_allocations set is_default = false where id = existing.id;
    update public.wallet_allocations set is_default = true where id = _replacement_allocation_id;
  end if;

  delete from public.wallet_allocations where id = _allocation_id;
end;
$$;

revoke all on function public.create_wallet_allocation(uuid, text, public.allocation_kind, numeric, numeric, boolean) from public, anon;
grant execute on function public.create_wallet_allocation(uuid, text, public.allocation_kind, numeric, numeric, boolean) to authenticated;
revoke all on function public.update_wallet_allocation(uuid, text, public.allocation_kind, numeric, numeric, boolean) from public, anon;
grant execute on function public.update_wallet_allocation(uuid, text, public.allocation_kind, numeric, numeric, boolean) to authenticated;
revoke all on function public.create_wallet_allocation_with_id(uuid, uuid, text, public.allocation_kind, numeric, numeric, boolean) from public, anon;
grant execute on function public.create_wallet_allocation_with_id(uuid, uuid, text, public.allocation_kind, numeric, numeric, boolean) to authenticated;
revoke all on function public.delete_wallet_allocation(uuid, uuid) from public, anon;
grant execute on function public.delete_wallet_allocation(uuid, uuid) to authenticated;

create or replace function public.mcp_get_category_spending_report_source(
  p_key_hash text,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare key_user_id uuid;
begin
  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then raise exception 'Invalid MCP API key'; end if;

  return jsonb_build_object(
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
        'is_system', c.is_system, 'created_at', c.created_at
      ) order by c.created_at)
      from public.finance_categories c
      where c.user_id = key_user_id and not coalesce(c.is_system, false)
    ), '[]'::jsonb),
    'allocations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'wallet_id', a.wallet_id, 'name', a.name,
        'kind', a.kind, 'amount', a.amount, 'target_amount', a.target_amount,
        'is_default', a.is_default
      ) order by a.created_at)
      from public.wallet_allocations a where a.user_id = key_user_id
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
      ) order by t.occurred_at desc, t.created_at desc)
      from public.finance_transactions t
      left join public.finance_categories c on c.id = t.category_id
      where t.user_id = key_user_id and t.status = 'paid'
        and t.occurred_at between p_start_date and p_end_date
        and (c.is_system is null or c.is_system = false)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.mcp_get_category_spending_report_source(text, date, date) from public;
grant execute on function public.mcp_get_category_spending_report_source(text, date, date) to anon, authenticated;

-- Keep the general MCP finance context aligned with the enriched goal contract.
create or replace function public.mcp_get_finance_context(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with recursive category_tree as (
    select c.id, c.user_id, c.name, c.icon, c.type, c.parent_id, c.is_system,
      c.created_at, c.name::text as path
    from public.finance_categories c
    where c.user_id = p_user_id
      and (c.is_system is null or c.is_system = false)
      and (c.parent_id is null or not exists (
        select 1 from public.finance_categories parent
        where parent.id = c.parent_id and parent.user_id = p_user_id
      ))
    union all
    select child.id, child.user_id, child.name, child.icon, child.type,
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
      'parent_id', c.parent_id, 'icon', c.icon, 'is_system', c.is_system,
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
    'goals', goal_context.goals,
    'rules', jsonb_build_object(
      'income', 'Requires destination_account_id and an income category_id.',
      'expense', 'Requires source_account_id and an expense category_id.',
      'transfer', 'Requires source_account_id and destination_account_id; category_id must be null.',
      'debt_payment', 'Requires source_account_id, destination_account_id for a debt wallet, and amount equal to principal_amount + interest_amount + extra_principal_amount. category_id is optional but must be an expense category when provided.'
    )
  ) from wallet_context, category_context, goal_context;
$$;

-- MCP savings-goal mutations share the same default invariant.
drop function if exists public.mcp_create_wallet_allocation(uuid, uuid, text, public.allocation_kind, numeric, numeric);
drop function if exists public.mcp_create_wallet_allocation(text, uuid, text, public.allocation_kind, numeric, numeric);
drop function if exists public.mcp_update_wallet_allocation(uuid, uuid, text, public.allocation_kind, numeric, numeric);
drop function if exists public.mcp_update_wallet_allocation(text, uuid, text, public.allocation_kind, numeric, numeric);
drop function if exists public.mcp_delete_wallet_allocation(uuid, uuid);
drop function if exists public.mcp_delete_wallet_allocation(text, uuid);

create function public.mcp_create_wallet_allocation(
  p_user_id uuid, p_wallet_id uuid, p_name text, p_kind public.allocation_kind,
  p_amount numeric, p_target_amount numeric, p_is_default boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare created public.wallet_allocations; wallet_balance numeric; reserved numeric; make_default boolean;
begin
  select balance into wallet_balance from public.wallets
  where id = p_wallet_id and user_id = p_user_id and type = 'saving' for update;
  if not found then raise exception 'Savings wallet not found or invalid.'; end if;
  select coalesce(sum(amount), 0) into reserved from public.wallet_allocations where wallet_id = p_wallet_id;
  if p_amount < 0 or reserved + p_amount > wallet_balance then raise exception 'Invalid savings goal amount.'; end if;
  if p_kind = 'goal_targeted' and (p_target_amount is null or p_target_amount <= 0) then raise exception 'Target amount is required.'; end if;
  if p_kind = 'goal_open' then p_target_amount := null; end if;
  make_default := p_is_default or not exists (select 1 from public.wallet_allocations where wallet_id = p_wallet_id);
  if make_default then update public.wallet_allocations set is_default = false where wallet_id = p_wallet_id; end if;
  insert into public.wallet_allocations(user_id, wallet_id, name, kind, amount, target_amount, is_default)
  values (p_user_id, p_wallet_id, trim(p_name), p_kind, p_amount, p_target_amount, make_default)
  returning * into created;
  return to_jsonb(created);
end $$;

create function public.mcp_update_wallet_allocation(
  p_user_id uuid, p_allocation_id uuid, p_name text, p_kind public.allocation_kind,
  p_amount numeric, p_target_amount numeric, p_is_default boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare existing public.wallet_allocations; wallet_balance numeric; reserved numeric; updated public.wallet_allocations;
begin
  select * into existing from public.wallet_allocations
  where id = p_allocation_id and user_id = p_user_id for update;
  if not found then raise exception 'Savings goal not found.'; end if;
  select balance into wallet_balance from public.wallets where id = existing.wallet_id for update;
  select coalesce(sum(amount), 0) into reserved from public.wallet_allocations
  where wallet_id = existing.wallet_id and id <> existing.id;
  if p_amount < 0 or reserved + p_amount > wallet_balance then raise exception 'Invalid savings goal amount.'; end if;
  if existing.is_default and not p_is_default then raise exception 'Choose another default goal first.'; end if;
  if p_kind = 'goal_targeted' and (p_target_amount is null or p_target_amount <= 0) then raise exception 'Target amount is required.'; end if;
  if p_kind = 'goal_open' then p_target_amount := null; end if;
  if p_is_default then update public.wallet_allocations set is_default = false where wallet_id = existing.wallet_id; end if;
  update public.wallet_allocations set name = trim(p_name), kind = p_kind, amount = p_amount,
    target_amount = p_target_amount, is_default = p_is_default, updated_at = now()
  where id = existing.id returning * into updated;
  return to_jsonb(updated);
end $$;

create function public.mcp_delete_wallet_allocation(
  p_user_id uuid, p_allocation_id uuid, p_replacement_allocation_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare existing public.wallet_allocations;
begin
  select * into existing from public.wallet_allocations
  where id = p_allocation_id and user_id = p_user_id for update;
  if not found then raise exception 'Savings goal not found.'; end if;
  if existing.is_default and exists (select 1 from public.wallet_allocations where wallet_id = existing.wallet_id and id <> existing.id) then
    if p_replacement_allocation_id is null or not exists (
      select 1 from public.wallet_allocations where id = p_replacement_allocation_id and wallet_id = existing.wallet_id and id <> existing.id
    ) then raise exception 'Choose a replacement default goal.'; end if;
    update public.wallet_allocations set is_default = false where id = existing.id;
    update public.wallet_allocations set is_default = true where id = p_replacement_allocation_id;
  end if;
  delete from public.wallet_allocations where id = existing.id;
  return jsonb_build_object('id', existing.id, 'wallet_id', existing.wallet_id, 'name', existing.name);
end $$;

create function public.mcp_create_wallet_allocation(
  p_key_hash text, p_wallet_id uuid, p_name text, p_kind public.allocation_kind,
  p_amount numeric, p_target_amount numeric, p_is_default boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare key_user_id uuid;
begin
  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then raise exception 'Invalid MCP API key'; end if;
  return public.mcp_create_wallet_allocation(key_user_id, p_wallet_id, p_name, p_kind, p_amount, p_target_amount, p_is_default);
end $$;

create function public.mcp_update_wallet_allocation(
  p_key_hash text, p_allocation_id uuid, p_name text, p_kind public.allocation_kind,
  p_amount numeric, p_target_amount numeric, p_is_default boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare key_user_id uuid;
begin
  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then raise exception 'Invalid MCP API key'; end if;
  return public.mcp_update_wallet_allocation(key_user_id, p_allocation_id, p_name, p_kind, p_amount, p_target_amount, p_is_default);
end $$;

create function public.mcp_delete_wallet_allocation(
  p_key_hash text, p_allocation_id uuid, p_replacement_allocation_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare key_user_id uuid;
begin
  select user_id into key_user_id from public.mcp_api_keys where key_hash = p_key_hash limit 1;
  if key_user_id is null then raise exception 'Invalid MCP API key'; end if;
  return public.mcp_delete_wallet_allocation(key_user_id, p_allocation_id, p_replacement_allocation_id);
end $$;

revoke all on function public.mcp_create_wallet_allocation(uuid, uuid, text, public.allocation_kind, numeric, numeric, boolean) from public, anon, authenticated;
revoke all on function public.mcp_update_wallet_allocation(uuid, uuid, text, public.allocation_kind, numeric, numeric, boolean) from public, anon, authenticated;
revoke all on function public.mcp_delete_wallet_allocation(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.mcp_create_wallet_allocation(uuid, uuid, text, public.allocation_kind, numeric, numeric, boolean) to service_role;
grant execute on function public.mcp_update_wallet_allocation(uuid, uuid, text, public.allocation_kind, numeric, numeric, boolean) to service_role;
grant execute on function public.mcp_delete_wallet_allocation(uuid, uuid, uuid) to service_role;
revoke all on function public.mcp_create_wallet_allocation(text, uuid, text, public.allocation_kind, numeric, numeric, boolean) from public;
revoke all on function public.mcp_update_wallet_allocation(text, uuid, text, public.allocation_kind, numeric, numeric, boolean) from public;
revoke all on function public.mcp_delete_wallet_allocation(text, uuid, uuid) from public;
grant execute on function public.mcp_create_wallet_allocation(text, uuid, text, public.allocation_kind, numeric, numeric, boolean) to anon, authenticated;
grant execute on function public.mcp_update_wallet_allocation(text, uuid, text, public.allocation_kind, numeric, numeric, boolean) to anon, authenticated;
grant execute on function public.mcp_delete_wallet_allocation(text, uuid, uuid) to anon, authenticated;
