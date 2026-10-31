-- Monthly category budgets. The base plan of a top-level expense category stays the
-- "[budget: N]" description prefix (applies to every month). This table layers on top of it:
--   scope 'month' : an override for exactly one month,
--   scope 'from'  : a new base that applies from that month onward (earlier months untouched).
-- Resolution for month M: month override for M, else latest 'from' row <= M, else the prefix.

create table if not exists public.finance_category_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.finance_categories(id) on delete cascade,
  month date not null,
  scope text not null check (scope in ('month', 'from')),
  amount numeric(14, 2),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  sync_version bigint not null default 1,
  constraint finance_category_budgets_month_first_day check (month = date_trunc('month', month)::date),
  constraint finance_category_budgets_amount_valid check (
    (scope = 'month' and amount is not null and amount >= 0)
    or (scope = 'from' and (amount is null or amount >= 0))
  ),
  constraint finance_category_budgets_unique unique (user_id, category_id, month, scope)
);

create index if not exists finance_category_budgets_user_category_idx
  on public.finance_category_budgets(user_id, category_id, month);

create or replace function public.finance_category_budgets_validate()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target public.finance_categories%rowtype;
begin
  select * into target
  from public.finance_categories
  where id = new.category_id and user_id = new.user_id;
  if not found then
    raise exception 'Category not found';
  end if;
  if coalesce(target.is_system, false) then
    raise exception 'System categories cannot be edited';
  end if;
  if target.type <> 'expense' or target.parent_id is not null then
    raise exception 'budget_amount can only be set on a top-level expense category';
  end if;
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists finance_category_budgets_validate on public.finance_category_budgets;
create trigger finance_category_budgets_validate
before insert or update on public.finance_category_budgets
for each row execute function public.finance_category_budgets_validate();

drop trigger if exists finance_category_budgets_bump_sync_version on public.finance_category_budgets;
create trigger finance_category_budgets_bump_sync_version
before update on public.finance_category_budgets
for each row execute function public.bump_sync_version();

alter table public.finance_category_budgets enable row level security;

drop policy if exists "finance_category_budgets_select_own" on public.finance_category_budgets;
create policy "finance_category_budgets_select_own" on public.finance_category_budgets
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "finance_category_budgets_insert_own" on public.finance_category_budgets;
create policy "finance_category_budgets_insert_own" on public.finance_category_budgets
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "finance_category_budgets_update_own" on public.finance_category_budgets;
create policy "finance_category_budgets_update_own" on public.finance_category_budgets
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "finance_category_budgets_delete_own" on public.finance_category_budgets;
create policy "finance_category_budgets_delete_own" on public.finance_category_budgets
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.finance_category_budgets from public, anon, authenticated;
grant select, insert, update, delete on table public.finance_category_budgets to authenticated;
grant all on table public.finance_category_budgets to service_role;
revoke all on function public.finance_category_budgets_validate() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'powersync')
    and not exists (
      select 1
      from pg_publication_rel relation
      join pg_publication publication on publication.oid = relation.prpubid
      where publication.pubname = 'powersync'
        and relation.prrelid = 'public.finance_category_budgets'::regclass
    ) then
    alter publication powersync add table public.finance_category_budgets;
  end if;
end;
$$;

-- All budget layers of the key owner. The caller resolves them per month with the same
-- rule the app uses, so MCP and the Budget screen cannot disagree.
create or replace function public.mcp_get_category_budgets(p_key_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'category_id', b.category_id,
      'month', to_char(b.month, 'YYYY-MM-DD'),
      'scope', b.scope,
      'amount', b.amount
    ) order by b.month, b.scope)
    from public.finance_category_budgets b
    where b.user_id = key_user_id
  ), '[]'::jsonb);
end;
$$;

drop function if exists public.mcp_set_category_budgets(text, jsonb);

create or replace function public.mcp_set_category_budgets(
  p_key_hash text,
  p_budgets jsonb,
  p_month text default null,
  p_scope text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  item jsonb;
  item_id uuid;
  item_budget numeric;
  current_row public.finance_categories%rowtype;
  budget_match text[];
  cur_text text;
  month_start date;
  row_scope text;
  results jsonb := '[]'::jsonb;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  if (p_month is null) <> (p_scope is null) then
    raise exception 'month and scope must be provided together';
  end if;
  if p_scope is not null then
    if p_scope not in ('month', 'from_month') then
      raise exception 'scope must be month or from_month';
    end if;
    if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
      raise exception 'month must be YYYY-MM';
    end if;
    month_start := to_date(p_month || '-01', 'YYYY-MM-DD');
    row_scope := case when p_scope = 'month' then 'month' else 'from' end;
  end if;

  if jsonb_typeof(p_budgets) <> 'array' or jsonb_array_length(p_budgets) = 0 then
    raise exception 'budgets must be a non-empty array';
  end if;
  if jsonb_array_length(p_budgets) > 100 then
    raise exception 'budgets accepts at most 100 items';
  end if;
  if (select count(distinct value->>'category_id') from jsonb_array_elements(p_budgets)) <> jsonb_array_length(p_budgets) then
    raise exception 'Each category can appear only once';
  end if;

  for item in select value from jsonb_array_elements(p_budgets)
  loop
    if jsonb_typeof(item) <> 'object' or not (item ? 'category_id') or not (item ? 'budget_amount') then
      raise exception 'Each budget needs category_id and budget_amount';
    end if;
    item_id := (item->>'category_id')::uuid;
    item_budget := nullif(item->>'budget_amount', '')::numeric;

    select * into current_row
    from public.finance_categories
    where id = item_id and user_id = key_user_id
    for update;
    if not found then
      raise exception 'Category not found';
    end if;
    if coalesce(current_row.is_system, false) then
      raise exception 'System categories cannot be edited';
    end if;
    if current_row.type <> 'expense' or current_row.parent_id is not null then
      raise exception 'budget_amount can only be set on a top-level expense category';
    end if;
    if item_budget is not null and item_budget < 0 then
      raise exception 'budget_amount must not be negative';
    end if;

    if row_scope is not null then
      if row_scope = 'month' and item_budget is null then
        raise exception 'A month override needs an amount; use clear_budget_override to remove it';
      end if;
      insert into public.finance_category_budgets(user_id, category_id, month, scope, amount)
      values (key_user_id, item_id, month_start, row_scope, item_budget)
      on conflict (user_id, category_id, month, scope)
      do update set amount = excluded.amount;
    else
      budget_match := regexp_match(coalesce(current_row.description, ''), '^\[budget:\s*([0-9.]+)\]\s*([\s\S]*)$');
      cur_text := case when budget_match is not null
        then nullif(btrim(budget_match[2]), '')
        else nullif(btrim(coalesce(current_row.description, '')), '') end;

      update public.finance_categories
      set description = case when item_budget is not null
        then nullif(btrim('[budget: ' || trim_scale(item_budget)::text || '] ' || coalesce(cur_text, '')), '')
        else cur_text end
      where id = item_id and user_id = key_user_id;
    end if;

    results := results || jsonb_build_array(jsonb_build_object(
      'category_id', current_row.id,
      'name', current_row.name,
      'budget_amount', item_budget,
      'month', p_month,
      'scope', p_scope
    ));
  end loop;

  return jsonb_build_object('budgets', results);
end;
$$;

create or replace function public.mcp_clear_budget_override(
  p_key_hash text,
  p_category_id uuid,
  p_month text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  month_start date;
  removed integer;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);
  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'month must be YYYY-MM';
  end if;
  month_start := to_date(p_month || '-01', 'YYYY-MM-DD');

  perform 1 from public.finance_categories where id = p_category_id and user_id = key_user_id;
  if not found then
    raise exception 'Category not found';
  end if;

  delete from public.finance_category_budgets
  where user_id = key_user_id and category_id = p_category_id and month = month_start and scope = 'month';
  get diagnostics removed = row_count;
  if removed = 0 then
    raise exception 'No budget override for this month';
  end if;

  return jsonb_build_object('category_id', p_category_id, 'month', p_month, 'cleared', true);
end;
$$;

revoke all on function public.mcp_get_category_budgets(text) from public, anon, authenticated;
revoke all on function public.mcp_set_category_budgets(text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.mcp_clear_budget_override(text, uuid, text) from public, anon, authenticated;
grant execute on function public.mcp_get_category_budgets(text) to anon, authenticated;
grant execute on function public.mcp_set_category_budgets(text, jsonb, text, text) to anon, authenticated;
grant execute on function public.mcp_clear_budget_override(text, uuid, text) to anon, authenticated;
