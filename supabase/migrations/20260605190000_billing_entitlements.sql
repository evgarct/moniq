create table if not exists public.user_billing_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text,
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  access_override text check (access_override is null or access_override in ('always_paid')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists user_billing_entitlements_subscription_status_idx
on public.user_billing_entitlements(subscription_status);

drop trigger if exists user_billing_entitlements_set_updated_at on public.user_billing_entitlements;
create trigger user_billing_entitlements_set_updated_at
before update on public.user_billing_entitlements
for each row
execute function public.set_updated_at();

alter table public.user_billing_entitlements enable row level security;

drop policy if exists "user_billing_entitlements_select_own" on public.user_billing_entitlements;
create policy "user_billing_entitlements_select_own"
on public.user_billing_entitlements
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.billing_has_mutation_access(
  p_subscription_status text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_access_override text
)
returns boolean
language sql
stable
as $$
  select
    p_access_override = 'always_paid'
    or (
      p_subscription_status in ('active', 'trialing')
      and (p_current_period_end is null or p_current_period_end > now())
    );
$$;

create or replace function public.user_has_mutation_entitlement(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select public.billing_has_mutation_access(
        e.subscription_status,
        e.current_period_end,
        e.cancel_at_period_end,
        e.access_override
      )
      from public.user_billing_entitlements e
      where e.user_id = p_user_id
        and auth.uid() = p_user_id
      limit 1
    ),
    false
  );
$$;

create or replace function public.mcp_key_has_mutation_entitlement(p_key_hash text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select public.billing_has_mutation_access(
        e.subscription_status,
        e.current_period_end,
        e.cancel_at_period_end,
        e.access_override
      )
      from public.mcp_api_keys k
      join public.user_billing_entitlements e on e.user_id = k.user_id
      where k.key_hash = p_key_hash
      limit 1
    ),
    false
  );
$$;

create or replace function public.ensure_e2e_billing_entitlement()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'moniq_e2e', 'false') <> 'true'
      and coalesce(auth.jwt() -> 'user_metadata' ->> 'purpose', '') <> 'moniq-e2e'
    )
  then
    raise exception 'Unauthorized';
  end if;

  insert into public.user_billing_entitlements (
    user_id,
    subscription_status,
    current_period_end,
    cancel_at_period_end,
    access_override
  )
  values (
    auth.uid(),
    'active',
    timezone('utc'::text, now()) + interval '30 days',
    false,
    null
  )
  on conflict (user_id) do update set
    subscription_status = excluded.subscription_status,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    access_override = excluded.access_override,
    updated_at = timezone('utc'::text, now());
end;
$$;

revoke all on function public.billing_has_mutation_access(text, timestamptz, boolean, text) from public, anon, authenticated;
revoke all on function public.user_has_mutation_entitlement(uuid) from public, anon, authenticated;
revoke all on function public.mcp_key_has_mutation_entitlement(text) from public, anon, authenticated;
revoke all on function public.ensure_e2e_billing_entitlement() from public, anon, authenticated;

grant execute on function public.user_has_mutation_entitlement(uuid) to authenticated;
grant execute on function public.mcp_key_has_mutation_entitlement(text) to anon, authenticated;
grant execute on function public.ensure_e2e_billing_entitlement() to authenticated;

insert into public.user_billing_entitlements (
  user_id,
  subscription_status,
  cancel_at_period_end,
  access_override
)
select
  id,
  'active',
  false,
  'always_paid'
from auth.users
where lower(email) = 'isafronovms@gmail.com'
on conflict (user_id) do update set
  subscription_status = excluded.subscription_status,
  cancel_at_period_end = excluded.cancel_at_period_end,
  access_override = excluded.access_override,
  updated_at = timezone('utc'::text, now());
